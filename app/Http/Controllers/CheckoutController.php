<?php

namespace App\Http\Controllers;

use App\Mail\NewOrderAdminMail;
use App\Mail\OrderConfirmationMail;
use App\Models\Address;
use App\Models\Cart;
use App\Models\CouponRedemption;
use App\Models\Currency;
use App\Models\Customer;
use App\Models\Language;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatus;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Shipment;
use App\Models\ShippingMethod;
use App\Models\ShippingZone;
use App\Services\CouponService;
use App\Services\InventoryService;
use App\Services\OrderStatusService;
use App\Services\Shipping\ShippingRateCalculatorService;
use App\Services\Payments\IfthenpayService;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class CheckoutController extends Controller
{
    public function index(
        string $locale,
        Request $request,
        CouponService $couponService,
        ShippingRateCalculatorService $shippingRateCalculatorService
    ): Response|RedirectResponse {
        $user = $request->user();
        abort_unless($user, 403);

        $cart = Cart::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->with([
                'items.product.translations',
                'items.product.prices.currency',
                'items.product.inventories',
                'items.variant.prices.currency',
                'items.variant.inventories',
                'items.variant.values.value.translations.language',
                'items.variant.values.attribute.translations.language',
            ])
            ->first();

        if (! $cart || $cart->items->isEmpty()) {
            return redirect()
                ->route('cart.index', ['locale' => $locale])
                ->with('error', __('ui.checkout.errors.empty_cart'));
        }

        [$localeLanguageId, $fallbackLanguageId] = $this->resolveLanguageIds($locale);

        $currency = Currency::query()
            ->where('is_default', true)
            ->where('is_active', true)
            ->first()
            ?? Currency::query()->where('is_active', true)->first();

        abort_unless($currency, 500, 'Não existe moeda ativa (currencies).');

        $cartNeedsShipping = $cart->items->contains(function ($item) {
            return (bool) ($item->product?->requires_shipping ?? false);
        });

        $shippingMethods = $cartNeedsShipping
            ? ShippingMethod::query()
                ->where('is_active', true)
                ->orderBy('id')
                ->get(['id', 'code', 'name'])
            : collect();

        $paymentMethods = PaymentMethod::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get(['id', 'code', 'name']);

        $shippingZones = $cartNeedsShipping
            ? ShippingZone::query()
                ->where('is_active', true)
                ->orderBy('priority')
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'country_code'])
            : collect();

        $customer = Customer::query()->firstOrCreate(['user_id' => $user->id]);

        $defaultShipping = $customer->addresses()
            ->where('type', 'shipping')
            ->where('is_default', true)
            ->first();

        $defaultBilling = $customer->addresses()
            ->where('type', 'billing')
            ->where('is_default', true)
            ->first();

        $defaultShippingZoneCode = $this->resolveDefaultShippingZoneCode(
            $defaultShipping?->country_code,
            $shippingZones
        );

        $defaultShippingPayload = [
            'name' => $defaultShipping?->name ?? '',
            'line1' => $defaultShipping?->line1 ?? '',
            'line2' => $defaultShipping?->line2 ?? '',
            'city' => $defaultShipping?->city ?? '',
            'postal_code' => $defaultShipping?->postal_code ?? '',
            'region' => $defaultShipping?->region ?? '',
            'country_code' => $defaultShipping?->country_code ?? 'PT',
            'shipping_zone_code' => $defaultShippingZoneCode,
        ];

        $defaultBillingPayload = [
            'name' => $defaultBilling?->name ?? '',
            'line1' => $defaultBilling?->line1 ?? '',
            'line2' => $defaultBilling?->line2 ?? '',
            'city' => $defaultBilling?->city ?? '',
            'postal_code' => $defaultBilling?->postal_code ?? '',
            'region' => $defaultBilling?->region ?? '',
            'country_code' => $defaultBilling?->country_code ?? 'PT',
        ];

        $shippingAmount = 0;

        if ($cartNeedsShipping && $defaultShippingZoneCode) {
            $defaultShippingMethod = $shippingMethods->first();

            if ($defaultShippingMethod) {
                $quote = $shippingRateCalculatorService->quoteForZone(
                    items: $cart->items,
                    shippingZoneCode: $defaultShippingZoneCode,
                    shippingMethodId: (int) $defaultShippingMethod->id,
                    shippingProfile: 'standard'
                );

                if (($quote['error'] ?? null) === null) {
                    $shippingAmount = (int) ($quote['price_cents'] ?? 0);
                }
            }
        }

        $couponCode = session('checkout_coupon_code');

        try {
            $pricing = $this->buildCheckoutPricing(
                cart: $cart,
                currency: $currency,
                localeLanguageId: $localeLanguageId,
                fallbackLanguageId: $fallbackLanguageId,
                user: $user,
                couponService: $couponService,
                couponCode: $couponCode,
                shippingAmount: $shippingAmount
            );
        } catch (\RuntimeException $e) {
            if ($couponCode) {
                session()->forget('checkout_coupon_code');
            }

            $pricing = $this->buildCheckoutPricing(
                cart: $cart,
                currency: $currency,
                localeLanguageId: $localeLanguageId,
                fallbackLanguageId: $fallbackLanguageId,
                user: $user,
                couponService: $couponService,
                couponCode: null,
                shippingAmount: $shippingAmount
            );
        }

        $checkoutToken = $request->session()->get('checkout_token');

        if (! $checkoutToken || ! Str::isUuid($checkoutToken)) {
            $checkoutToken = (string) Str::uuid();
            $request->session()->put('checkout_token', $checkoutToken);
        }

        return Inertia::render('Checkout/Index', [
            'cart' => [
                'id' => $cart->id,
            ],
            'currency' => [
                'code' => $currency->code,
                'symbol' => $currency->symbol,
                'decimal_places' => (int) $currency->decimal_places,
            ],
            'items' => $pricing['display_items'],
            'totals' => [
                'subtotal' => $pricing['subtotal'],
                'shipping' => $pricing['shipping'],
                'tax' => $pricing['tax'],
                'discount' => $pricing['discount'],
                'total' => $pricing['total'],
            ],
            'appliedCoupon' => $pricing['applied_coupon'],
            'shippingMethods' => $shippingMethods,
            'shippingZones' => $shippingZones,
            'paymentMethods' => $paymentMethods,
            'checkout_rules' => [
                'requires_shipping' => $cartNeedsShipping,
                'prices_include_tax' => $pricing['prices_include_tax'],
            ],
            'defaults' => [
                'customer' => [
                    'phone' => $customer->phone,
                    'vat_number' => $customer->vat_number,
                    'company_name' => $customer->company_name,
                ],
                'shipping' => $defaultShippingPayload,
                'billing' => $defaultBillingPayload,
                'checkout_token' => $checkoutToken,
            ],
        ]);
    }

    public function store(
        string $locale,
        Request $request,
        InventoryService $inventoryService,
        OrderStatusService $orderStatusService,
        CouponService $couponService,
        ShippingRateCalculatorService $shippingRateCalculatorService,
        IfthenpayService $ifthenpayService
    ): RedirectResponse {
        $user = $request->user();
        abort_unless($user, 403);

        $incomingCheckoutToken = (string) $request->input('checkout_token', '');

        if (Str::isUuid($incomingCheckoutToken)) {
            $existingOrder = Order::query()
                ->where('user_id', $user->id)
                ->where('checkout_token', $incomingCheckoutToken)
                ->first();

            if ($existingOrder) {
                return redirect()->route('orders.thankyou', [
                    'locale' => $locale,
                    'order' => $existingOrder->id,
                ]);
            }
        }

        $currency = Currency::query()
            ->where('is_default', true)
            ->where('is_active', true)
            ->first()
            ?? Currency::query()->where('is_active', true)->first();

        abort_unless($currency, 500, 'Não existe moeda ativa (currencies).');

        $cart = Cart::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->with([
                'items.product.translations',
                'items.product.prices.currency',
                'items.product.inventories',
                'items.variant.prices.currency',
                'items.variant.inventories',
                'items.variant.values.value.translations.language',
                'items.variant.values.attribute.translations.language',
            ])
            ->first();

        if (! $cart || $cart->items->isEmpty()) {
            return redirect()
                ->route('cart.index', ['locale' => $locale])
                ->with('error', __('ui.checkout.errors.empty_cart'));
        }

        $requiresShipping = $cart->items->contains(function ($item) {
            return (bool) ($item->product?->requires_shipping ?? false);
        });

        $rules = [
            'checkout_token' => ['required', 'uuid'],
            'phone' => ['nullable', 'string', 'max:30'],
            'vat_number' => ['nullable', 'string', 'max:30'],
            'company_name' => ['nullable', 'string', 'max:120'],

            'billing.name' => ['nullable', 'string', 'max:120'],
            'billing.line1' => ['required', 'string', 'max:160'],
            'billing.line2' => ['nullable', 'string', 'max:160'],
            'billing.city' => ['required', 'string', 'max:80'],
            'billing.postal_code' => ['required', 'string', 'max:30'],
            'billing.region' => ['nullable', 'string', 'max:80'],
            'billing.country_code' => ['required', 'string', 'size:2'],

            'payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'accept_legal' => ['accepted'],
        ];

        if ($requiresShipping) {
            $rules = array_merge($rules, [
                'shipping.name' => ['nullable', 'string', 'max:120'],
                'shipping.line1' => ['required', 'string', 'max:160'],
                'shipping.line2' => ['nullable', 'string', 'max:160'],
                'shipping.city' => ['required', 'string', 'max:80'],
                'shipping.postal_code' => ['required', 'string', 'max:30'],
                'shipping.region' => ['nullable', 'string', 'max:80'],
                'shipping.country_code' => ['required', 'string', 'size:2'],
                'shipping.shipping_zone_code' => ['required', 'string', 'exists:shipping_zones,code'],
                'shipping_method_id' => ['required', 'integer', 'exists:shipping_methods,id'],
            ]);
        }

        $messages = [
            'accept_legal.accepted' => __('ui.checkout.accept_legal_required'),
        ];

        $data = $request->validate($rules, $messages);

        $sessionCheckoutToken = (string) $request->session()->get('checkout_token', '');

        if (! $sessionCheckoutToken || ! hash_equals($sessionCheckoutToken, (string) $data['checkout_token'])) {
            return back()->withErrors([
                'checkout' => __('ui.checkout.errors.invalid_checkout_token'),
            ])->withInput();
        }

        $existingOrder = Order::query()
            ->where('user_id', $user->id)
            ->where('checkout_token', $data['checkout_token'])
            ->first();

        if ($existingOrder) {
            $request->session()->forget('checkout_token');

            return redirect()->route('orders.thankyou', [
                'locale' => $locale,
                'order' => $existingOrder->id,
            ]);
        }

        try {
            $order = DB::transaction(function () use (
                $user,
                $locale,
                $currency,
                $data,
                $inventoryService,
                $requiresShipping,
                $orderStatusService,
                $couponService,
                $shippingRateCalculatorService,
                $ifthenpayService,
            ) {
                $existingOrder = Order::query()
                    ->where('user_id', $user->id)
                    ->where('checkout_token', $data['checkout_token'])
                    ->first();

                if ($existingOrder) {
                    return $existingOrder;
                }

                $cart = Cart::query()
                    ->where('user_id', $user->id)
                    ->where('status', 'active')
                    ->lockForUpdate()
                    ->with([
                        'items.product.translations',
                        'items.product.prices.currency',
                        'items.product.inventories',
                        'items.variant.prices.currency',
                        'items.variant.inventories',
                        'items.variant.values.value.translations.language',
                        'items.variant.values.attribute.translations.language',
                    ])
                    ->first();

                if (! $cart || $cart->items->isEmpty()) {
                    throw new \RuntimeException(__('ui.checkout.errors.empty_cart'));
                }

                foreach ($cart->items as $item) {
                    $product = $item->product;
                    $variant = $item->variant;

                    if (! $product || ! $product->is_active || ! $product->isCurrentlyAvailable()) {
                        throw new \RuntimeException(__('ui.checkout.errors.unavailable_product'));
                    }

                    if ($variant && ! $variant->is_active) {
                        throw new \RuntimeException(__('ui.checkout.errors.unavailable_product'));
                    }

                    if (! $product->canSetQuantity((int) $item->qty)) {
                        throw new \RuntimeException(__('ui.checkout.errors.invalid_product_quantity', [
                            'sku' => $variant?->sku ?: $product->sku,
                        ]));
                    }

                    if ($product->managesInventory()) {
                        if ($variant) {
                            $available = $inventoryService->availableForVariant($variant);

                            if (($available ?? 0) < (int) $item->qty) {
                                $name = $variant->sku ?: ($product->sku ?: __('ui.common.item'));

                                throw new \RuntimeException(__('ui.checkout.errors.insufficient_stock_item', [
                                    'item' => $name,
                                ]));
                            }
                        } else {
                            $available = $product->availableStock();

                            if (($available ?? 0) < (int) $item->qty) {
                                $name = $product->sku ?: __('ui.common.item');

                                throw new \RuntimeException(__('ui.checkout.errors.insufficient_stock_item', [
                                    'item' => $name,
                                ]));
                            }
                        }
                    }
                }

                $customer = Customer::query()->firstOrCreate(['user_id' => $user->id]);

                $customer->fill([
                    'phone' => $data['phone'] ?? $customer->phone,
                    'vat_number' => $data['vat_number'] ?? $customer->vat_number,
                    'company_name' => $data['company_name'] ?? $customer->company_name,
                ])->save();

                if ($requiresShipping) {
                    $this->upsertDefaultAddress($customer->id, 'shipping', $data['shipping']);
                }

                $this->upsertDefaultAddress($customer->id, 'billing', $data['billing']);

                $resolvedShippingAmount = 0;
                $shippingMethod = null;

                if ($requiresShipping) {
                    $shippingMethod = ShippingMethod::query()
                        ->where('id', (int) $data['shipping_method_id'])
                        ->where('is_active', true)
                        ->first();

                    if (! $shippingMethod) {
                        throw new \RuntimeException('O método de envio selecionado já não está disponível.');
                    }

                    if ($shippingMethod->code === 'pickup') {
                        $resolvedShippingAmount = 0;
                    } else {
                        $quote = $shippingRateCalculatorService->quoteForZone(
                            items: $cart->items,
                            shippingZoneCode: (string) ($data['shipping']['shipping_zone_code'] ?? ''),
                            shippingMethodId: (int) $shippingMethod->id,
                            shippingProfile: 'standard'
                        );

                        if (($quote['error'] ?? null) !== null) {
                            $shippingErrors = [
                                'invalid_weight' => 'Existem produtos sem peso válido para calcular o envio.',
                                'weight_limit_exceeded' => 'A encomenda excede o limite automático de 30 kg. Contacta-nos para cotação manual.',
                                'zone_not_found' => 'Não foi possível determinar a zona de envio para este destino.',
                                'rate_not_found' => 'Não existe tarifa disponível para esta zona e peso.',
                            ];

                            throw new \RuntimeException(
                                $shippingErrors[$quote['error']] ?? 'Não foi possível calcular os portes neste momento.'
                            );
                        }

                        $resolvedShippingAmount = (int) ($quote['price_cents'] ?? 0);
                    }
                }

                $status = OrderStatus::query()
                    ->where('code', 'pending_payment')
                    ->first();

                if (! $status) {
                    throw new \RuntimeException(__('ui.checkout.errors.missing_pending_payment_status'));
                }

                [$localeLanguageId, $fallbackLanguageId] = $this->resolveLanguageIds($locale);

                $pricing = $this->buildCheckoutPricing(
                    cart: $cart,
                    currency: $currency,
                    localeLanguageId: $localeLanguageId,
                    fallbackLanguageId: $fallbackLanguageId,
                    user: $user,
                    couponService: $couponService,
                    couponCode: session('checkout_coupon_code'),
                    shippingAmount: $resolvedShippingAmount
                );

                $legalVersion = config('legal.version', now()->toDateString());

                $order = Order::create([
                    'order_number' => $this->generateOrderNumber(),
                    'user_id' => $user->id,
                    'customer_id' => $customer->id,
                    'currency_id' => $currency->id,
                    'status_id' => $status->id,
                    'coupon_id' => $pricing['coupon_model']?->id,
                    'coupon_code' => $pricing['coupon_model']?->code,
                    'checkout_token' => $data['checkout_token'],
                    'accepted_terms_at' => now(),
                    'accepted_privacy_at' => now(),
                    'accepted_terms_version' => $legalVersion,
                    'accepted_privacy_version' => $legalVersion,
                    'billing_address' => $data['billing'],
                    'shipping_address' => $requiresShipping
                        ? array_merge($data['shipping'], [
                            'shipping_method_id' => isset($shippingMethod) ? (int) $shippingMethod->id : null,
                            'shipping_method_code' => $shippingMethod->code ?? null,
                            'shipping_method_name' => $shippingMethod->name ?? null,
                        ])
                        : null,
                    'subtotal_amount' => $pricing['subtotal'],
                    'discount_amount' => $pricing['discount'],
                    'tax_amount' => $pricing['tax'],
                    'shipping_amount' => $pricing['shipping'],
                    'total_amount' => $pricing['total'],
                ]);

                if ($pricing['coupon_model']) {
                    CouponRedemption::query()->create([
                        'coupon_id' => $pricing['coupon_model']->id,
                        'order_id' => $order->id,
                        'user_id' => $user->id,
                        'coupon_code' => $pricing['coupon_model']->code,
                        'discount_amount' => $pricing['discount'],
                    ]);

                    $pricing['coupon_model']->increment('total_uses');
                }

                foreach ($pricing['order_items'] as $lineItem) {
                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $lineItem['product_id'],
                        'variant_id' => $lineItem['variant_id'],
                        'name' => $lineItem['name'],
                        'sku' => $lineItem['sku'],
                        'qty' => $lineItem['qty'],
                        'unit_amount' => $lineItem['unit_amount'],
                        'discount_amount' => $lineItem['discount_amount'],
                        'tax_amount' => $lineItem['tax_amount'],
                        'total_amount' => $lineItem['total_amount'],
                        'meta' => $lineItem['meta'],
                    ]);
                }

                foreach ($cart->items as $item) {
                    $product = $item->product;
                    $variant = $item->variant;

                    if (! $product) {
                        throw new \RuntimeException(__('ui.checkout.errors.cart_item_without_product'));
                    }

                    if ($product->managesInventory()) {
                        if ($variant) {
                            $inventoryService->decrementVariantStock($variant, (int) $item->qty);
                        } else {
                            $inventoryService->decrementStock($product, (int) $item->qty);
                        }
                    }
                }

                if ($requiresShipping && $shippingMethod && $shippingMethod->code !== 'pickup') {
                    $shipment = Shipment::create([
                        'order_id' => $order->id,
                        'shipping_method_id' => (int) $data['shipping_method_id'],
                        'status' => 'pending',
                    ]);

                    $order->loadMissing('items');

                    foreach ($order->items as $orderItem) {
                        $shipment->items()->create([
                            'order_item_id' => $orderItem->id,
                            'qty' => (int) $orderItem->qty,
                        ]);
                    }
                }

                $paymentMethod = PaymentMethod::query()
                    ->whereKey((int) $data['payment_method_id'])
                    ->firstOrFail();

                $payment = Payment::create([
                    'order_id' => $order->id,
                    'payment_method_id' => (int) $data['payment_method_id'],
                    'amount' => $order->total_amount,
                    'status' => 'pending',
                ]);

                if ($paymentMethod->code === 'ifthenpay_mb') {
                    $response = $ifthenpayService->createMultibancoReference($payment);
                    $ifthenpayService->applyMultibancoResponseToPayment($payment, $response);
                }

                if ($paymentMethod->code === 'ifthenpay_mbway') {
                    $phone = preg_replace('/\D+/', '', (string) ($data['phone'] ?? ''));

                    if ($phone === '') {
                        throw new \RuntimeException('Indica um número de telefone válido para pagamento por MB WAY.');
                    }

                    $response = $ifthenpayService->createMbwayPayment($payment, $phone);
                    $ifthenpayService->applyMbwayResponseToPayment($payment, $response, $phone);
                }

                $orderStatusService->recordInitialStatus(
                    order: $order,
                    changedByUserId: $user->id,
                    notes: __('ui.checkout.notes.order_created_in_checkout')
                );

                $cart->update(['status' => 'converted']);
                $cart->items()->delete();

                Cart::create([
                    'user_id' => $user->id,
                    'currency_id' => $currency->id,
                    'status' => 'active',
                ]);

                return $order;
            });
        } catch (QueryException $e) {
            $order = Order::query()
                ->where('user_id', $user->id)
                ->where('checkout_token', $data['checkout_token'])
                ->first();

            if ($order) {
                $request->session()->forget('checkout_token');

                return redirect()->route('orders.thankyou', [
                    'locale' => $locale,
                    'order' => $order->id,
                ]);
            }

            throw $e;
        } catch (\RuntimeException $e) {
            return back()->withErrors([
                'checkout' => $e->getMessage(),
            ])->withInput();
        }

        $request->session()->forget('checkout_token');
        session()->forget('checkout_coupon_code');

        $order->load([
            'status',
            'currency',
            'items',
            'customer.user',
            'payment.method',
            'shipment.method',
            'coupon',
            'couponRedemption',
        ]);

        $customerEmail = $user->email;
        $customerLocale = in_array($locale, config('app.supported_locales', ['pt', 'en']), true)
            ? $locale
            : config('app.fallback_locale', 'pt');

        try {
            if ($customerEmail) {
                Mail::to($customerEmail)->queue(
                    new OrderConfirmationMail($order, $customerLocale)
                );
            }
        } catch (\Throwable $e) {
            Log::error('Failed to queue order confirmation email.', [
                'order_id' => $order->id,
                'email' => $customerEmail,
                'error' => $e->getMessage(),
            ]);
        }

        $adminEmail = config('mail.order_notification_to');
        $adminLocale = config('mail.order_notification_locale', config('app.fallback_locale', 'pt'));

        try {
            if ($adminEmail) {
                Mail::to($adminEmail)->later(
                    now()->addSeconds(15),
                    new NewOrderAdminMail($order, $adminLocale)
                );
            }
        } catch (\Throwable $e) {
            Log::error('Failed to queue admin new order email.', [
                'order_id' => $order->id,
                'email' => $adminEmail,
                'error' => $e->getMessage(),
            ]);
        }

        return redirect()->route('orders.thankyou', [
            'locale' => $locale,
            'order' => $order->id,
        ]);
    }

    private function buildCheckoutPricing(
        Cart $cart,
        Currency $currency,
        int $localeLanguageId,
        int $fallbackLanguageId,
        $user,
        CouponService $couponService,
        ?string $couponCode = null,
        int $shippingAmount = 0
    ): array {
        $rawLines = collect($cart->items)->map(function ($item) use ($currency, $localeLanguageId, $fallbackLanguageId) {
            $product = $item->product;
            $variant = $item->variant;

            if (! $product) {
                throw new \RuntimeException(__('ui.checkout.errors.cart_item_without_product'));
            }

            $translation = $product->translations->firstWhere('language_id', $localeLanguageId)
                ?? $product->translations->firstWhere('language_id', $fallbackLanguageId)
                ?? $product->translations->first();

            $price = null;

            if ($variant) {
                $price = $variant->prices->firstWhere('currency_id', $currency->id)
                    ?? $variant->prices->first();
            } else {
                $price = $product->prices->firstWhere('currency_id', $currency->id)
                    ?? $product->prices->first();
            }

            if (! $price) {
                throw new \RuntimeException(__('ui.checkout.errors.missing_price_for_currency', [
                    'currency' => $currency->code,
                ]));
            }

            $qty = (int) $item->qty;
            $storedUnitAmount = (int) $price->amount;
            $taxRate = (float) ($product->tax_rate ?? 0);
            $taxBasisPoints = $this->taxRateToBasisPoints($taxRate);
            $priceIncludesTax = (bool) $product->price_includes_tax;

            $lineNetBeforeDiscount = $storedUnitAmount * $qty;
            $lineGrossBeforeDiscount = $priceIncludesTax
                ? $lineNetBeforeDiscount
                : $this->grossFromNet($lineNetBeforeDiscount, $taxBasisPoints);

            $lineNetBeforeDiscount = $this->extractNetFromGross($lineGrossBeforeDiscount, $taxBasisPoints);
            $lineTaxBeforeDiscount = $lineGrossBeforeDiscount - $lineNetBeforeDiscount;

            $displayUnitAmount = $qty > 0
                ? (int) round($lineGrossBeforeDiscount / $qty)
                : 0;

            $variantLabel = null;

            if ($variant && $variant->relationLoaded('values')) {
                $parts = collect($variant->values)
                    ->map(function ($row) use ($localeLanguageId, $fallbackLanguageId) {
                        $attributeTranslation = $row->attribute?->translations?->firstWhere('language_id', $localeLanguageId)
                            ?? $row->attribute?->translations?->firstWhere('language_id', $fallbackLanguageId)
                            ?? $row->attribute?->translations?->first();

                        $valueTranslation = $row->value?->translations?->firstWhere('language_id', $localeLanguageId)
                            ?? $row->value?->translations?->firstWhere('language_id', $fallbackLanguageId)
                            ?? $row->value?->translations?->first();

                        $attributeName = $attributeTranslation?->name ?? $row->attribute?->code;
                        $valueName = $valueTranslation?->name ?? $row->value?->code;

                        if (! $attributeName || ! $valueName) {
                            return null;
                        }

                        return "{$attributeName}: {$valueName}";
                    })
                    ->filter()
                    ->values();

                $variantLabel = $parts->isNotEmpty() ? $parts->implode(' · ') : null;
            }

            return [
                'product_id' => $product->id,
                'variant_id' => $variant?->id,
                'name' => $translation?->name ?? $product->slug,
                'variant_label' => $variantLabel,
                'sku' => $variant?->sku ?: $product->sku,
                'qty' => $qty,
                'unit_amount' => $displayUnitAmount,
                'stored_unit_amount' => $storedUnitAmount,
                'price_includes_tax' => $priceIncludesTax,
                'tax_rate' => $taxRate,
                'tax_basis_points' => $taxBasisPoints,
                'pre_discount_net_amount' => $lineNetBeforeDiscount,
                'pre_discount_tax_amount' => $lineTaxBeforeDiscount,
                'pre_discount_total_amount' => $lineGrossBeforeDiscount,
                'meta' => [
                    'business_type' => $product->business_type,
                    'requires_shipping' => (bool) $product->requires_shipping,
                    'manages_inventory' => (bool) $product->manages_inventory,
                    'allow_quantity' => (bool) $product->allow_quantity,
                    'tax_rate' => $taxRate,
                    'price_includes_tax' => $priceIncludesTax,
                    'variant_label' => $variantLabel,
                    'variant_id' => $variant?->id,
                ],
            ];
        })->values();

        $grossMerchandiseTotal = (int) $rawLines->sum('pre_discount_total_amount');
        $netSubtotalBeforeDiscount = (int) $rawLines->sum('pre_discount_net_amount');

        $coupon = null;
        $grossDiscountAmount = 0;

        if ($couponCode) {
            $coupon = $couponService->findByCode((string) $couponCode);

            if (! $coupon) {
                throw new \RuntimeException(__('ui.coupons.not_found'));
            }

            try {
                $couponService->validateForUserAndSubtotal($coupon, $user, $grossMerchandiseTotal);
            } catch (\Illuminate\Validation\ValidationException $e) {
                throw new \RuntimeException($e->validator->errors()->first('coupon_code'));
            }

            $grossDiscountAmount = $couponService->calculateDiscountAmount($coupon, $grossMerchandiseTotal);
            $grossDiscountAmount = max(0, min($grossDiscountAmount, $grossMerchandiseTotal));
        }

        $allocatedGrossDiscounts = $this->allocateProportionalAmount(
            $rawLines->pluck('pre_discount_total_amount')->all(),
            $grossDiscountAmount
        );

        $pricedLines = $rawLines->values()->map(function ($line, $index) use ($allocatedGrossDiscounts) {
            $grossDiscount = (int) ($allocatedGrossDiscounts[$index] ?? 0);
            $grossAfterDiscount = max(0, (int) $line['pre_discount_total_amount'] - $grossDiscount);
            $netAfterDiscount = $this->extractNetFromGross($grossAfterDiscount, (int) $line['tax_basis_points']);
            $taxAfterDiscount = $grossAfterDiscount - $netAfterDiscount;
            $netDiscount = max(0, (int) $line['pre_discount_net_amount'] - $netAfterDiscount);

            return [
                'product_id' => $line['product_id'],
                'variant_id' => $line['variant_id'],
                'name' => $line['name'],
                'variant_label' => $line['variant_label'],
                'sku' => $line['sku'],
                'qty' => $line['qty'],
                'unit_amount' => $line['unit_amount'],
                'discount_amount' => $netDiscount,
                'tax_amount' => $taxAfterDiscount,
                'total_amount' => $grossAfterDiscount,
                'meta' => $line['meta'],
                'display_line_total' => (int) $line['pre_discount_total_amount'],
                'display_unit_amount' => (int) $line['unit_amount'],
                'requires_shipping' => (bool) ($line['meta']['requires_shipping'] ?? false),
            ];
        })->values();

        $discountAmount = (int) $pricedLines->sum('discount_amount');
        $taxAmount = (int) $pricedLines->sum('tax_amount');
        $total = max(0, $netSubtotalBeforeDiscount + $shippingAmount + $taxAmount - $discountAmount);

        $pricesIncludeTax = $rawLines->isNotEmpty() && $rawLines->every(function ($line) {
            return (bool) $line['price_includes_tax'];
        });

        return [
            'display_items' => $pricedLines->map(function ($line) {
                return [
                    'id' => $line['variant_id'] ?: $line['product_id'],
                    'product_id' => $line['product_id'],
                    'variant_id' => $line['variant_id'],
                    'qty' => $line['qty'],
                    'name' => $line['name'],
                    'variant_label' => $line['variant_label'],
                    'sku' => $line['sku'],
                    'unit_amount' => $line['display_unit_amount'],
                    'line_total' => $line['display_line_total'],
                    'requires_shipping' => $line['requires_shipping'],
                ];
            })->values(),
            'order_items' => $pricedLines->map(function ($line) {
                return [
                    'product_id' => $line['product_id'],
                    'variant_id' => $line['variant_id'],
                    'name' => $line['variant_label']
                        ? "{$line['name']} ({$line['variant_label']})"
                        : $line['name'],
                    'sku' => $line['sku'],
                    'qty' => $line['qty'],
                    'unit_amount' => $line['unit_amount'],
                    'discount_amount' => $line['discount_amount'],
                    'tax_amount' => $line['tax_amount'],
                    'total_amount' => $line['total_amount'],
                    'meta' => $line['meta'],
                ];
            })->values()->all(),
            'subtotal' => $netSubtotalBeforeDiscount,
            'shipping' => $shippingAmount,
            'tax' => $taxAmount,
            'discount' => $discountAmount,
            'total' => $total,
            'applied_coupon' => $coupon ? [
                'id' => $coupon->id,
                'code' => $coupon->code,
                'name' => $coupon->name,
                'type' => $coupon->type,
                'amount' => $coupon->amount !== null ? (int) $coupon->amount : null,
                'percentage' => $coupon->percentage !== null ? (float) $coupon->percentage : null,
            ] : null,
            'coupon_model' => $coupon,
            'prices_include_tax' => $pricesIncludeTax,
        ];
    }

    private function taxRateToBasisPoints(float $rate): int
    {
        return (int) round($rate * 100);
    }

    private function calculateTaxFromNet(int $netAmount, int $taxBasisPoints): int
    {
        if ($taxBasisPoints <= 0 || $netAmount <= 0) {
            return 0;
        }

        return (int) round(($netAmount * $taxBasisPoints) / 10000);
    }

    private function grossFromNet(int $netAmount, int $taxBasisPoints): int
    {
        return $netAmount + $this->calculateTaxFromNet($netAmount, $taxBasisPoints);
    }

    private function extractNetFromGross(int $grossAmount, int $taxBasisPoints): int
    {
        if ($taxBasisPoints <= 0 || $grossAmount <= 0) {
            return max(0, $grossAmount);
        }

        return (int) round(($grossAmount * 10000) / (10000 + $taxBasisPoints));
    }

    private function allocateProportionalAmount(array $bases, int $amount): array
    {
        $count = count($bases);
        $allocations = array_fill(0, $count, 0);

        $bases = array_map(fn ($value) => max(0, (int) $value), $bases);
        $amount = max(0, (int) $amount);

        $totalBase = array_sum($bases);

        if ($count === 0 || $amount === 0 || $totalBase === 0) {
            return $allocations;
        }

        $amount = min($amount, $totalBase);
        $remainders = [];

        foreach ($bases as $index => $base) {
            if ($base <= 0) {
                $remainders[$index] = -1;
                continue;
            }

            $raw = ($amount * $base) / $totalBase;
            $allocated = min($base, (int) floor($raw));

            $allocations[$index] = $allocated;
            $remainders[$index] = $raw - $allocated;
        }

        $remaining = $amount - array_sum($allocations);

        while ($remaining > 0) {
            $bestIndex = null;
            $bestRemainder = -1;

            foreach ($bases as $index => $base) {
                if ($allocations[$index] >= $base) {
                    continue;
                }

                if ($remainders[$index] > $bestRemainder) {
                    $bestRemainder = $remainders[$index];
                    $bestIndex = $index;
                }
            }

            if ($bestIndex === null) {
                foreach ($bases as $index => $base) {
                    if ($allocations[$index] < $base) {
                        $bestIndex = $index;
                        break;
                    }
                }
            }

            if ($bestIndex === null) {
                break;
            }

            $allocations[$bestIndex]++;
            $remaining--;
        }

        return $allocations;
    }

    private function upsertDefaultAddress(int $customerId, string $type, array $addr): void
    {
        Address::query()
            ->where('customer_id', $customerId)
            ->where('type', $type)
            ->update(['is_default' => false]);

        Address::create([
            'customer_id' => $customerId,
            'type' => $type,
            'name' => $addr['name'] ?? null,
            'line1' => $addr['line1'],
            'line2' => $addr['line2'] ?? null,
            'city' => $addr['city'],
            'postal_code' => $addr['postal_code'],
            'region' => $addr['region'] ?? null,
            'country_code' => strtoupper($addr['country_code'] ?? 'PT'),
            'is_default' => true,
        ]);
    }

    private function generateOrderNumber(): string
    {
        for ($i = 0; $i < 5; $i++) {
            $number = 'ORD-' . now()->format('Ymd') . '-' . Str::upper(Str::random(6));

            if (! Order::query()->where('order_number', $number)->exists()) {
                return $number;
            }
        }

        return 'ORD-' . now()->format('YmdHis') . '-' . Str::upper(Str::random(8));
    }

    private function resolveLanguageIds(string $locale): array
    {
        $supported = config('app.supported_locales', ['pt', 'en']);
        $fallbackLocale = config('app.fallback_locale', 'pt');
        $locale = in_array($locale, $supported, true) ? $locale : $fallbackLocale;

        $languages = Language::query()
            ->whereIn('code', [$fallbackLocale, $locale])
            ->get()
            ->keyBy('code');

        $fallbackLanguageId = (int) ($languages[$fallbackLocale]->id ?? 0);
        $localeLanguageId = (int) ($languages[$locale]->id ?? $fallbackLanguageId);

        return [$localeLanguageId, $fallbackLanguageId];
    }

    private function resolveDefaultShippingZoneCode(?string $countryCode, $shippingZones): ?string
    {
        if (! $countryCode) {
            return null;
        }

        $countryCode = strtoupper(trim($countryCode));

        if ($countryCode === 'PT') {
            return $shippingZones->firstWhere('code', 'PT_CONTINENTAL')?->code;
        }

        if ($countryCode === 'ES') {
            return $shippingZones->firstWhere('code', 'ES_PENINSULA')?->code;
        }

        return $shippingZones->firstWhere('country_code', $countryCode)?->code;
    }
}

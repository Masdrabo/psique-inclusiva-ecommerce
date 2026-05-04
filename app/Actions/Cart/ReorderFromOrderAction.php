<?php

namespace App\Actions\Cart;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Currency;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ReorderFromOrderAction
{
    /**
     * @return array{cart_id:int, added_lines:int, skipped: array<int, array{item_id:int, sku:?string, name:?string, reason:string}>}
     */
    public function execute(User $user, Order $order): array
    {
        return DB::transaction(function () use ($user, $order) {
            $cart = $this->getOrCreateActiveCart($user, $order);

            $order->loadMissing(['items']); // garante items carregados

            $addedLines = 0;
            $skipped = [];

            foreach ($order->items as $item) {
                $productId = $item->product_id ? (int) $item->product_id : null;
                $variantId = $item->variant_id ? (int) $item->variant_id : null;

                // A tua regra no CartController: OU product_id OU variant_id (não ambos)
                $hasProduct = !empty($productId);
                $hasVariant = !empty($variantId);

                if (($hasProduct && $hasVariant) || (!$hasProduct && !$hasVariant)) {
                    $skipped[] = [
                        'item_id' => (int) $item->id,
                        'sku' => $item->sku ?? null,
                        'name' => $item->name ?? null,
                        'reason' => 'Item inválido (sem product_id/variant_id ou com ambos).',
                    ];
                    continue;
                }

                // Validação mínima de produto (se for product_id)
                if ($hasProduct) {
                    $product = Product::query()
                        ->where('id', $productId)
                        ->first();

                    if (!$product) {
                        $skipped[] = [
                            'item_id' => (int) $item->id,
                            'sku' => $item->sku ?? null,
                            'name' => $item->name ?? null,
                            'reason' => 'Produto já não existe.',
                        ];
                        continue;
                    }

                    // Se quiseres bloquear produtos inativos:
                    if (property_exists($product, 'is_active') && !$product->is_active) {
                        $skipped[] = [
                            'item_id' => (int) $item->id,
                            'sku' => $item->sku ?? null,
                            'name' => $item->name ?? null,
                            'reason' => 'Produto indisponível.',
                        ];
                        continue;
                    }
                }

                // Quantidade (mínimo 1)
                $qtyToAdd = max(1, (int) $item->qty);

                // Se já existir no carrinho, soma qty
                $query = CartItem::query()->where('cart_id', $cart->id);
                if ($hasVariant) {
                    $query->where('variant_id', $variantId);
                } else {
                    $query->where('product_id', $productId);
                }

                $existing = $query->first();

                if ($existing) {
                    $existing->qty += $qtyToAdd;
                    $existing->save();
                } else {
                    CartItem::create([
                        'cart_id' => $cart->id,
                        'product_id' => $hasProduct ? $productId : null,
                        'variant_id' => $hasVariant ? $variantId : null,
                        'qty' => $qtyToAdd,
                        'unit_amount' => null, // snapshot de preço mais tarde
                        'meta' => [
                            'reordered_from_order_id' => (int) $order->id,
                            'reordered_from_order_item_id' => (int) $item->id,
                        ],
                    ]);
                }

                $addedLines++;
            }

            return [
                'cart_id' => (int) $cart->id,
                'added_lines' => (int) $addedLines,
                'skipped' => $skipped,
            ];
        });
    }

    private function getOrCreateActiveCart(User $user, Order $order): Cart
    {
        $cart = Cart::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if ($cart) {
            return $cart;
        }

        // Preferência: usar a moeda da encomenda, se existir
        $currencyId = $order->currency_id;

        if (!$currencyId) {
            $currency = Currency::query()
                ->where('is_default', true)
                ->where('is_active', true)
                ->first()
                ?? Currency::query()->where('is_active', true)->first();

            if (!$currency) {
                Currency::query()->update(['is_default' => false]);
                $currency = Currency::query()->create([
                    'code' => 'EUR',
                    'symbol' => '€',
                    'decimal_places' => 2,
                    'is_default' => true,
                    'is_active' => true,
                ]);
            }

            $currencyId = $currency->id;
        }

        return Cart::create([
            'user_id' => $user->id,
            'currency_id' => (int) $currencyId,
            'status' => 'active',
        ]);
    }
}

<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Http\Requests\Manager\StoreProductRequest;
use App\Http\Requests\Manager\UpdateProductRequest;
use App\Models\Attribute;
use App\Models\Category;
use App\Models\Currency;
use App\Models\Language;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductPrice;
use App\Models\ProductTranslation;
use App\Models\SlugRedirect;
use App\Models\AttributeValue;
use App\Services\InventoryService;
use App\Services\ProductVariantService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductController extends Controller
{
    public function index(Request $request, string $locale): Response
{
    $supported = config('app.supported_locales', ['pt', 'en']);
    $fallbackLocale = config('app.fallback_locale', 'pt');
    $locale = in_array($locale, $supported, true) ? $locale : $fallbackLocale;

    $languages = Language::query()
        ->whereIn('code', array_values(array_unique([$fallbackLocale, $locale, 'pt', 'en'])))
        ->get()
        ->keyBy('code');

    $fallbackLanguageId = (int) ($languages[$fallbackLocale]->id ?? 0);
    $localeLanguageId = (int) ($languages[$locale]->id ?? $fallbackLanguageId);
    $ptLanguageId = (int) ($languages['pt']->id ?? 0);
    $enLanguageId = (int) ($languages['en']->id ?? 0);

    $allowedSorts = ['latest', 'name', 'category', 'price', 'stock'];
    $sortBy = $request->string('sort')->toString();
    $sortBy = in_array($sortBy, $allowedSorts, true) ? $sortBy : 'latest';

    $direction = strtolower($request->string('direction')->toString()) === 'asc' ? 'asc' : 'desc';

    $allowedPerPage = [10, 15, 25, 50, 100];
    $perPage = (int) $request->integer('per_page', 15);
    $perPage = in_array($perPage, $allowedPerPage, true) ? $perPage : 15;

    $search = trim($request->string('q')->toString());

    $eur = Currency::query()->where('code', 'EUR')->first();
    $eurId = (int) ($eur?->id ?? 0);

    $productsQuery = $this->buildIndexQuery(
        localeLanguageId: $localeLanguageId,
        fallbackLanguageId: $fallbackLanguageId,
        eurId: $eurId,
        search: $search
    );

    $this->applyIndexSorting($productsQuery, $sortBy, $direction);

    $products = $productsQuery
        ->paginate($perPage)
        ->withQueryString()
        ->through(function (Product $product) use ($localeLanguageId, $fallbackLanguageId) {
            $translations = $product->translations->map(function ($tr) {
                return [
                    'id' => $tr->id,
                    'language_id' => $tr->language_id,
                    'language' => $tr->language ? [
                        'id' => $tr->language->id,
                        'code' => $tr->language->code,
                        'name' => $tr->language->name,
                    ] : null,
                    'name' => $tr->name,
                    'description' => $tr->description,
                    'meta_title' => $tr->meta_title,
                    'meta_description' => $tr->meta_description,
                ];
            })->values();

            $categories = $product->categories->map(function ($category) use ($localeLanguageId, $fallbackLanguageId) {
                $ct = $category->translations->firstWhere('language_id', $localeLanguageId)
                    ?? $category->translations->firstWhere('language_id', $fallbackLanguageId)
                    ?? $category->translations->first();

                return [
                    'id' => $category->id,
                    'slug' => $category->slug,
                    'parent_id' => $category->parent_id,
                    'is_active' => (bool) $category->is_active,
                    'position' => $category->position,
                    'translations' => $category->translations->map(function ($tr) {
                        return [
                            'id' => $tr->id,
                            'language_id' => $tr->language_id,
                            'language' => $tr->language ? [
                                'id' => $tr->language->id,
                                'code' => $tr->language->code,
                                'name' => $tr->language->name,
                            ] : null,
                            'name' => $tr->name,
                        ];
                    })->values(),
                    'name' => $ct?->name ?? $category->slug,
                ];
            })->values();

            $images = $product->images
                ->sortBy([
                    ['is_main', 'desc'],
                    ['position', 'asc'],
                    ['id', 'asc'],
                ])
                ->values()
                ->map(function ($img) use ($localeLanguageId, $fallbackLanguageId) {
                    $imgTr = $img->translations->firstWhere('language_id', $localeLanguageId)
                        ?? $img->translations->firstWhere('language_id', $fallbackLanguageId)
                        ?? $img->translations->first();

                    return [
                        'id' => $img->id,
                        'url' => $img->path ? "/storage/{$img->path}" : null,
                        'path' => $img->path,
                        'is_main' => (bool) $img->is_main,
                        'position' => (int) ($img->position ?? 0),
                        'alt' => $imgTr?->alt,
                        'translations' => $img->translations->map(function ($tr) {
                            return [
                                'id' => $tr->id,
                                'language_id' => $tr->language_id,
                                'language' => $tr->language ? [
                                    'id' => $tr->language->id,
                                    'code' => $tr->language->code,
                                    'name' => $tr->language->name,
                                ] : null,
                                'alt' => $tr->alt,
                            ];
                        })->values(),
                    ];
                })
                ->values();

            $availableStock = $product->managesInventory()
                ? $product->availableStock()
                : null;

            $allEurPrices = collect();

            if ($product->isVariable()) {
                $allEurPrices = $product->variants
                    ->flatMap(function ($variant) {
                        return collect($variant->prices ?? [])
                            ->filter(fn ($price) => $price->currency?->code === 'EUR')
                            ->pluck('amount');
                    })
                    ->filter(fn ($amount) => $amount !== null)
                    ->map(fn ($amount) => (int) $amount)
                    ->values();
            } else {
                $allEurPrices = collect($product->prices ?? [])
                    ->filter(fn ($price) => $price->currency?->code === 'EUR' && $price->variant_id === null)
                    ->pluck('amount')
                    ->filter(fn ($amount) => $amount !== null)
                    ->map(fn ($amount) => (int) $amount)
                    ->values();
            }

            $minPriceAmount = $allEurPrices->isNotEmpty() ? $allEurPrices->min() : null;
            $maxPriceAmount = $allEurPrices->isNotEmpty() ? $allEurPrices->max() : null;

            return [
                'id' => $product->id,
                'sku' => $product->sku,
                'slug' => $product->slug,
                'type' => $product->type,
                'business_type' => $product->business_type,
                'is_active' => (bool) $product->is_active,
                'tax_rate' => $product->tax_rate,
                'price_includes_tax' => (bool) $product->price_includes_tax,
                'requires_shipping' => (bool) $product->requires_shipping,
                'manages_inventory' => (bool) $product->manages_inventory,
                'allow_quantity' => (bool) $product->allow_quantity,
                'max_per_order' => $product->max_per_order,
                'available_stock' => $availableStock,
                'is_out_of_stock' => $product->managesInventory() ? (($availableStock ?? 0) <= 0) : false,
                'is_low_stock' => $product->managesInventory() ? (($availableStock ?? 0) > 0 && ($availableStock ?? 0) <= 5) : false,
                'min_price_amount' => $minPriceAmount,
                'max_price_amount' => $maxPriceAmount,
                'inventories' => $product->inventories->map(fn ($inv) => [
                    'id' => $inv->id,
                    'warehouse_id' => $inv->warehouse_id,
                    'warehouse_name' => $inv->warehouse?->name,
                    'product_id' => $inv->product_id,
                    'variant_id' => $inv->variant_id,
                    'qty_on_hand' => (int) $inv->qty_on_hand,
                    'qty_reserved' => (int) $inv->qty_reserved,
                    'available_qty' => max(0, (int) $inv->qty_on_hand - (int) $inv->qty_reserved),
                ])->values(),
                'translations' => $translations,
                'categories' => $categories,
                'prices' => $product->prices->map(function ($price) {
                    return [
                        'id' => $price->id,
                        'currency_id' => $price->currency_id,
                        'product_id' => $price->product_id,
                        'variant_id' => $price->variant_id,
                        'amount' => $price->amount,
                        'compare_at_amount' => $price->compare_at_amount,
                        'currency' => $price->currency ? [
                            'id' => $price->currency->id,
                            'code' => $price->currency->code,
                            'symbol' => $price->currency->symbol,
                            'decimal_places' => (int) $price->currency->decimal_places,
                        ] : null,
                    ];
                })->values(),
                'images' => $images,
                'business_detail' => $product->businessDetail,
            ];
        });

    $stockCardsQuery = $this->buildIndexQuery(
        localeLanguageId: $localeLanguageId,
        fallbackLanguageId: $fallbackLanguageId,
        eurId: $eurId,
        search: $search,
        withRelations: false
    );

    $stockRows = $stockCardsQuery->get(['products.id']);

    $stockCards = [
        'total_products' => (int) $stockRows->count(),
        'in_stock_products' => (int) $stockRows->filter(function (Product $product) {
            if (!$product->managesInventory()) {
                return false;
            }

            return ($product->availableStock() ?? 0) > 0;
        })->count(),
        'out_of_stock_products' => (int) $stockRows->filter(function (Product $product) {
            if (!$product->managesInventory()) {
                return false;
            }

            return ($product->availableStock() ?? 0) <= 0;
        })->count(),
        'low_stock_products' => (int) $stockRows->filter(function (Product $product) {
            if (!$product->managesInventory()) {
                return false;
            }

            $available = $product->availableStock() ?? 0;

            return $available > 0 && $available <= 5;
        })->count(),
        'total_units' => (int) $stockRows->sum(function (Product $product) {
            if (!$product->managesInventory()) {
                return 0;
            }

            return max(0, (int) ($product->availableStock() ?? 0));
        }),
        'low_stock_threshold' => 5,
    ];

    $attributeManager = [
        'attributes' => Attribute::query()
            ->with([
                'translations.language',
                'values.translations.language',
            ])
            ->orderBy('code')
            ->get()
            ->map(function (Attribute $attribute) {
                return [
                    'id' => $attribute->id,
                    'code' => $attribute->code,
                    'is_active' => (bool) $attribute->is_active,
                    'translations' => $attribute->translations->map(function ($translation) {
                        return [
                            'id' => $translation->id,
                            'language_id' => $translation->language_id,
                            'language_code' => $translation->language?->code,
                            'language' => $translation->language ? [
                                'id' => $translation->language->id,
                                'code' => $translation->language->code,
                                'name' => $translation->language->name,
                            ] : null,
                            'name' => $translation->name,
                        ];
                    })->values(),
                    'values_count' => $attribute->values->count(),
                    'values' => $attribute->values->map(function ($value) {
                        return [
                            'id' => $value->id,
                            'attribute_id' => $value->attribute_id,
                            'code' => $value->code,
                            'translations' => $value->translations->map(function ($translation) {
                                return [
                                    'id' => $translation->id,
                                    'language_id' => $translation->language_id,
                                    'language_code' => $translation->language?->code,
                                    'language' => $translation->language ? [
                                        'id' => $translation->language->id,
                                        'code' => $translation->language->code,
                                        'name' => $translation->language->name,
                                    ] : null,
                                    'name' => $translation->name,
                                ];
                            })->values(),
                        ];
                    })->values(),
                ];
            })
            ->values(),
        'languages' => [
            'pt' => $ptLanguageId ?: null,
            'en' => $enLanguageId ?: null,
        ],
    ];

    return Inertia::render('Manager/Products/Index', [
        'products' => $products,
        'stockCards' => $stockCards,
        'filters' => [
            'q' => $search,
            'per_page' => $perPage,
        ],
        'sort' => [
            'by' => $sortBy,
            'direction' => $direction,
        ],
        'attributeManager' => $attributeManager,
    ]);
}

    public function export(Request $request, string $locale): StreamedResponse
    {
        $supported = config('app.supported_locales', ['pt', 'en']);
        $fallbackLocale = config('app.fallback_locale', 'pt');
        $locale = in_array($locale, $supported, true) ? $locale : $fallbackLocale;

        $languages = Language::query()
            ->whereIn('code', array_values(array_unique([$fallbackLocale, $locale])))
            ->get()
            ->keyBy('code');

        $fallbackLanguageId = (int) ($languages[$fallbackLocale]->id ?? 0);
        $localeLanguageId = (int) ($languages[$locale]->id ?? $fallbackLanguageId);

        $allowedSorts = ['latest', 'name', 'category', 'price', 'stock'];
        $sortBy = $request->string('sort')->toString();
        $sortBy = in_array($sortBy, $allowedSorts, true) ? $sortBy : 'latest';

        $direction = strtolower($request->string('direction')->toString()) === 'asc' ? 'asc' : 'desc';

        $search = trim($request->string('q')->toString());

        $eur = Currency::query()->where('code', 'EUR')->first();
        $eurId = (int) ($eur?->id ?? 0);

        $query = $this->buildIndexQuery(
            localeLanguageId: $localeLanguageId,
            fallbackLanguageId: $fallbackLanguageId,
            eurId: $eurId,
            search: $search
        );

        $this->applyIndexSorting($query, $sortBy, $direction);

        $filename = 'manager_products_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($query, $localeLanguageId, $fallbackLanguageId) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, [
                __('ui.manager_products_export.sku'),
                __('ui.manager_products_export.slug'),
                __('ui.manager_products_export.name'),
                __('ui.manager_products_export.categories'),
                __('ui.manager_products_export.price_eur'),
                __('ui.manager_products_export.tax_rate'),
                __('ui.manager_products_export.price_includes_tax'),
                __('ui.manager_products_export.requires_shipping'),
                __('ui.manager_products_export.manages_inventory'),
                __('ui.manager_products_export.available_stock'),
                __('ui.manager_products_export.is_active'),
                __('ui.manager_products_export.created_at'),
                __('ui.manager_products_export.updated_at'),
            ]);

            $query->chunkById(500, function ($products) use ($out, $localeLanguageId, $fallbackLanguageId) {
                foreach ($products as $product) {
                    $translation = $product->translations->firstWhere('language_id', $localeLanguageId)
                        ?? $product->translations->firstWhere('language_id', $fallbackLanguageId)
                        ?? $product->translations->first();

                    $categoryNames = $product->categories
                        ->map(function ($category) use ($localeLanguageId, $fallbackLanguageId) {
                            $ct = $category->translations->firstWhere('language_id', $localeLanguageId)
                                ?? $category->translations->firstWhere('language_id', $fallbackLanguageId)
                                ?? $category->translations->first();

                            return $ct?->name ?? $category->slug ?? '—';
                        })
                        ->filter()
                        ->values()
                        ->implode(' | ');

                    $eurPrice = $product->prices
                        ->first(function ($price) {
                            return $price->variant_id === null && $price->currency?->code === 'EUR';
                        });

                    if (!$eurPrice && $product->isVariable()) {
                        $eurPrice = $product->variants
                            ->flatMap(fn ($variant) => $variant->prices)
                            ->first(function ($price) {
                                return $price->currency?->code === 'EUR';
                            });
                    }

                    $priceDecimal = $eurPrice
                        ? $this->toDecimalString((int) $eurPrice->amount, (int) ($eurPrice->currency?->decimal_places ?? 2))
                        : '';

                    $availableStock = $product->managesInventory()
                        ? ($product->availableStock() ?? 0)
                        : '';

                    fputcsv($out, [
                        $product->sku,
                        $product->slug,
                        $translation?->name ?? $product->slug,
                        $categoryNames,
                        $priceDecimal,
                        $product->tax_rate !== null ? (string) $product->tax_rate : '',
                        $product->price_includes_tax ? __('ui.common.yes') : __('ui.common.no'),
                        $product->requires_shipping ? __('ui.common.yes') : __('ui.common.no'),
                        $product->manages_inventory ? __('ui.common.yes') : __('ui.common.no'),
                        $availableStock,
                        $product->is_active ? __('ui.common.active') : __('ui.common.inactive'),
                        optional($product->created_at)->toISOString(),
                        optional($product->updated_at)->toISOString(),
                    ]);
                }
            });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function create(string $locale): Response
    {
        $categories = Category::query()
            ->with(['translations.language'])
            ->orderBy('position')
            ->orderBy('id')
            ->get();

        $attributes = Attribute::query()
            ->with([
                'translations.language',
                'values.translations.language',
            ])
            ->where('is_active', true)
            ->orderBy('id')
            ->get();

        $languages = Language::query()
            ->whereIn('code', ['pt', 'en'])
            ->orderBy('code')
            ->get(['id', 'code', 'name']);

        $eur = Currency::query()->where('code', 'EUR')->first();

        return Inertia::render('Manager/Products/Create', [
            'categories' => $categories,
            'attributes' => $attributes,
            'languages' => $languages,
            'currency' => $eur ? [
                'id' => $eur->id,
                'code' => $eur->code,
                'symbol' => $eur->symbol,
                'decimal_places' => (int) $eur->decimal_places,
            ] : null,
        ]);
    }

    public function store(
        StoreProductRequest $request,
        string $locale,
        InventoryService $inventoryService,
        ProductVariantService $productVariantService
    ): RedirectResponse {
        DB::transaction(function () use ($request, $inventoryService, $productVariantService) {
            $eur = Currency::query()->where('code', 'EUR')->firstOrFail();

            $product = Product::create([
                'sku' => $request->string('sku')->toString(),
                'slug' => $request->string('slug')->toString(),
                'type' => $request->string('type')->toString(),
                'business_type' => $request->string('business_type')->toString(),
                'is_active' => $request->boolean('is_active', true),
                'barcode' => $request->input('barcode'),
                'weight_grams' => $request->input('weight_grams'),
                'tax_rate' => $request->input('tax_rate'),
                'price_includes_tax' => $request->boolean('price_includes_tax', true),
                'requires_shipping' => $request->boolean('requires_shipping'),
                'manages_inventory' => $request->boolean('manages_inventory'),
                'allow_quantity' => $request->boolean('allow_quantity'),
                'requires_customer_notes' => $request->boolean('requires_customer_notes'),
                'max_per_order' => $request->filled('max_per_order') ? (int) $request->input('max_per_order') : null,
                'available_from' => $request->input('available_from'),
                'available_until' => $request->input('available_until'),
            ]);

            $languages = Language::query()
                ->whereIn('code', ['pt', 'en'])
                ->get()
                ->keyBy('code');

            $translations = $request->input('translations', []);
            foreach (['pt', 'en'] as $code) {
                $data = $translations[$code] ?? [];

                ProductTranslation::create([
                    'product_id' => $product->id,
                    'language_id' => $languages[$code]->id,
                    'name' => $data['name'] ?? '',
                    'description' => $data['description'] ?? null,
                    'meta_title' => $data['meta_title'] ?? null,
                    'meta_description' => $data['meta_description'] ?? null,
                    'is_machine_translated' => false,
                ]);
            }

            $categoryIds = $request->input('categories', []);
            $product->categories()->sync($categoryIds);

            if ($product->isSimple()) {
                $amount = $this->toMinorUnits((string) $request->input('price'), (int) $eur->decimal_places);
                $compareAt = $request->filled('compare_at_price')
                    ? $this->toMinorUnits((string) $request->input('compare_at_price'), (int) $eur->decimal_places)
                    : null;

                ProductPrice::updateOrCreate(
                    [
                        'currency_id' => $eur->id,
                        'product_id' => $product->id,
                        'variant_id' => null,
                    ],
                    [
                        'amount' => $amount,
                        'compare_at_amount' => $compareAt,
                    ]
                );

                $productVariantService->sync(
                    product: $product,
                    payload: $request->validated(),
                    currency: $eur,
                    inventoryService: $inventoryService
                );

                if ($product->managesInventory()) {
                    $inventoryService->setProductStock(
                        $product,
                        (int) $request->input('stock_qty', 0)
                    );
                }
            } else {
                ProductPrice::query()
                    ->where('product_id', $product->id)
                    ->whereNull('variant_id')
                    ->delete();

                try {
                    $productVariantService->sync(
                        product: $product,
                        payload: $request->validated(),
                        currency: $eur,
                        inventoryService: $inventoryService
                    );
                } catch (\Throwable $e) {
                    dd([
                        'message' => $e->getMessage(),
                        'class' => get_class($e),
                        'validated_variants' => $request->validated()['variants'] ?? null,
                        'all_request_variants' => $request->input('variants'),
                    ]);
                }

                $product->refresh();
                $product->syncActiveFromInventory();
            }

            $this->syncBusinessDetail($product, $request->input('business_detail', []));

            $files = $request->file('images', []);

            foreach ($files as $index => $file) {
                $path = $file->store("products/{$product->id}", 'public');

                ProductImage::create([
                    'product_id' => $product->id,
                    'path' => $path,
                    'position' => $index + 1,
                    'is_main' => $index === 0,
                ]);
            }
        });

        return redirect()
            ->route('manager.products.index', ['locale' => $locale])
            ->with('success', __('ui.manager.product_created'));
    }

    public function edit(string $locale, Product $product): Response
    {
        $product->load([
            'translations.language',
            'categories',
            'prices.currency',
            'images.translations.language',
            'businessDetail',
            'inventories',
            'variants.values.value.translations.language',
            'variants.values.attribute.translations.language',
            'variants.prices.currency',
            'variants.inventories',
        ]);

        $categories = Category::query()
            ->with(['translations.language'])
            ->orderBy('position')
            ->orderBy('id')
            ->get();

        $attributes = Attribute::query()
            ->with([
                'translations.language',
                'values.translations.language',
            ])
            ->where('is_active', true)
            ->orderBy('id')
            ->get();

        $languages = Language::query()
            ->whereIn('code', ['pt', 'en'])
            ->orderBy('code')
            ->get(['id', 'code', 'name']);

        $eur = Currency::query()->where('code', 'EUR')->first();

        $stockQty = $product->isSimple() && $product->managesInventory()
            ? (int) $product->inventories->sum('qty_on_hand')
            : 0;

        return Inertia::render('Manager/Products/Edit', [
            'product' => $product,
            'stockQty' => $stockQty,
            'categories' => $categories,
            'attributes' => $attributes,
            'languages' => $languages,
            'currency' => $eur ? [
                'id' => $eur->id,
                'code' => $eur->code,
                'symbol' => $eur->symbol,
                'decimal_places' => (int) $eur->decimal_places,
            ] : null,
        ]);
    }

    public function update(
        UpdateProductRequest $request,
        string $locale,
        Product $product,
        InventoryService $inventoryService,
        ProductVariantService $productVariantService
    ): RedirectResponse {
        DB::transaction(function () use ($request, $product, $inventoryService, $productVariantService) {
            $eur = Currency::query()->where('code', 'EUR')->firstOrFail();

            $oldSlug = (string) $product->slug;
            $newSlug = $request->string('slug')->toString();

            $product->update([
                'sku' => $request->string('sku')->toString(),
                'slug' => $newSlug,
                'type' => $request->string('type')->toString(),
                'business_type' => $request->string('business_type')->toString(),
                'is_active' => $request->boolean('is_active', true),
                'barcode' => $request->input('barcode'),
                'weight_grams' => $request->input('weight_grams'),
                'tax_rate' => $request->input('tax_rate'),
                'price_includes_tax' => $request->boolean('price_includes_tax', true),
                'requires_shipping' => $request->boolean('requires_shipping'),
                'manages_inventory' => $request->boolean('manages_inventory'),
                'allow_quantity' => $request->boolean('allow_quantity'),
                'requires_customer_notes' => $request->boolean('requires_customer_notes'),
                'max_per_order' => $request->filled('max_per_order') ? (int) $request->input('max_per_order') : null,
                'available_from' => $request->input('available_from'),
                'available_until' => $request->input('available_until'),
            ]);

            if ($oldSlug !== '' && $oldSlug !== $newSlug) {
                SlugRedirect::query()
                    ->where('redirectable_type', Product::class)
                    ->where('new_slug', $oldSlug)
                    ->update(['new_slug' => $newSlug]);

                SlugRedirect::query()->firstOrCreate(
                    [
                        'redirectable_type' => Product::class,
                        'old_slug' => $oldSlug,
                    ],
                    [
                        'redirectable_id' => $product->id,
                        'new_slug' => $newSlug,
                        'http_code' => 301,
                        'created_by' => optional($request->user())->id,
                    ]
                );
            }

            $languages = Language::query()
                ->whereIn('code', ['pt', 'en'])
                ->get()
                ->keyBy('code');

            $translations = $request->input('translations', []);
            foreach (['pt', 'en'] as $code) {
                $data = $translations[$code] ?? [];

                ProductTranslation::updateOrCreate(
                    [
                        'product_id' => $product->id,
                        'language_id' => $languages[$code]->id,
                    ],
                    [
                        'name' => $data['name'] ?? '',
                        'description' => $data['description'] ?? null,
                        'meta_title' => $data['meta_title'] ?? null,
                        'meta_description' => $data['meta_description'] ?? null,
                    ]
                );
            }

            $categoryIds = $request->input('categories', []);
            $product->categories()->sync($categoryIds);

            if ($product->isSimple()) {
                $amount = $this->toMinorUnits((string) $request->input('price'), (int) $eur->decimal_places);
                $compareAt = $request->filled('compare_at_price')
                    ? $this->toMinorUnits((string) $request->input('compare_at_price'), (int) $eur->decimal_places)
                    : null;

                ProductPrice::updateOrCreate(
                    [
                        'currency_id' => $eur->id,
                        'product_id' => $product->id,
                        'variant_id' => null,
                    ],
                    [
                        'amount' => $amount,
                        'compare_at_amount' => $compareAt,
                    ]
                );

                $productVariantService->sync(
                    product: $product,
                    payload: $request->validated(),
                    currency: $eur,
                    inventoryService: $inventoryService
                );

                if ($product->managesInventory()) {
                    $inventoryService->setProductStock(
                        $product,
                        (int) $request->input('stock_qty', 0)
                    );
                }
            } else {
                ProductPrice::query()
                    ->where('product_id', $product->id)
                    ->whereNull('variant_id')
                    ->delete();

                $productVariantService->sync(
                    product: $product,
                    payload: $request->validated(),
                    currency: $eur,
                    inventoryService: $inventoryService
                );

                $product->refresh();
                $product->load('variants');
                $product->syncActiveFromInventory();
            }

            $this->syncBusinessDetail($product, $request->input('business_detail', []));
        });

        return redirect()
            ->route('manager.products.index', ['locale' => $locale])
            ->with('success', __('ui.manager.product_updated'));
    }

    public function destroy(string $locale, Product $product): RedirectResponse
    {
        $product->delete();

        return redirect()
            ->route('manager.products.index', ['locale' => $locale])
            ->with('success', __('ui.manager.product_deleted'));
    }

    private function buildIndexQuery(
        int $localeLanguageId,
        int $fallbackLanguageId,
        int $eurId,
        string $search = '',
        bool $withRelations = true
    ): Builder {
        $query = Product::query()
            ->select('products.*')
            ->selectSub(
                ProductTranslation::query()
                    ->select('name')
                    ->whereColumn('product_id', 'products.id')
                    ->whereIn('language_id', [$localeLanguageId, $fallbackLanguageId])
                    ->orderByRaw(
                        'CASE WHEN language_id = ? THEN 0 WHEN language_id = ? THEN 1 ELSE 2 END',
                        [$localeLanguageId, $fallbackLanguageId]
                    )
                    ->limit(1),
                'localized_name'
            )
            ->selectSub(
                DB::table('category_product as cp')
                    ->join('categories', 'categories.id', '=', 'cp.category_id')
                    ->leftJoin('category_translations as ctl', function ($join) use ($localeLanguageId) {
                        $join->on('ctl.category_id', '=', 'categories.id')
                            ->where('ctl.language_id', '=', $localeLanguageId);
                    })
                    ->leftJoin('category_translations as ctf', function ($join) use ($fallbackLanguageId) {
                        $join->on('ctf.category_id', '=', 'categories.id')
                            ->where('ctf.language_id', '=', $fallbackLanguageId);
                    })
                    ->whereColumn('cp.product_id', 'products.id')
                    ->selectRaw(
                        "GROUP_CONCAT(DISTINCT COALESCE(ctl.name, ctf.name, categories.slug) ORDER BY COALESCE(ctl.name, ctf.name, categories.slug) SEPARATOR ' | ')"
                    ),
                'category_sort_text'
            )
            ->selectSub(
                ProductPrice::query()
                    ->selectRaw('MIN(amount)')
                    ->where(function ($q) {
                        $q->whereColumn('product_id', 'products.id')
                            ->orWhereIn('variant_id', function ($sub) {
                                $sub->select('id')
                                    ->from('product_variants')
                                    ->whereColumn('product_id', 'products.id');
                            });
                    })
                    ->when($eurId > 0, fn ($q) => $q->where('currency_id', $eurId))
                    ->limit(1),
                'price_amount'
            );

        if ($withRelations) {
            $query->with([
                'translations.language',
                'categories.translations.language',
                'prices.currency',
                'inventories.warehouse',
                'businessDetail',
                'images.translations.language',
                'variants.inventories',
                'variants.prices.currency',
            ]);
        }

        if ($search !== '') {
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $search) . '%';

            $query->where(function (Builder $q) use ($like) {
                $q->where('products.sku', 'like', $like)
                    ->orWhere('products.slug', 'like', $like)
                    ->orWhereHas('translations', function (Builder $tr) use ($like) {
                        $tr->where('name', 'like', $like);
                    })
                    ->orWhereHas('categories.translations', function (Builder $tr) use ($like) {
                        $tr->where('name', 'like', $like);
                    })
                    ->orWhereHas('categories', function (Builder $cat) use ($like) {
                        $cat->where('slug', 'like', $like);
                    });
            });
        }

        return $query;
    }

    private function applyIndexSorting(Builder $query, string $sortBy, string $direction): void
    {
        $direction = strtolower($direction) === 'asc' ? 'asc' : 'desc';

        switch ($sortBy) {
            case 'name':
                $query
                    ->orderByRaw('CASE WHEN localized_name IS NULL OR localized_name = "" THEN 1 ELSE 0 END ASC')
                    ->orderBy('localized_name', $direction)
                    ->orderBy('products.id', 'desc');
                break;

            case 'category':
                $query
                    ->orderByRaw('CASE WHEN category_sort_text IS NULL OR category_sort_text = "" THEN 1 ELSE 0 END ASC')
                    ->orderBy('category_sort_text', $direction)
                    ->orderBy('products.id', 'desc');
                break;

            case 'price':
                $query
                    ->orderByRaw('CASE WHEN price_amount IS NULL THEN 1 ELSE 0 END ASC')
                    ->orderBy('price_amount', $direction)
                    ->orderBy('products.id', 'desc');
                break;

            case 'stock':
                $query->orderBy('products.id', 'desc');
                break;

            case 'latest':
            default:
                $query->orderBy('products.id', 'desc');
                break;
        }
    }

    /**
     * Converte "19.99" para cents (int), sem floats.
     */
    private function toMinorUnits(string $value, int $decimalPlaces = 2): int
    {
        $value = trim((string) $value);
        if ($value === '') {
            return 0;
        }

        $value = str_replace(',', '.', $value);

        [$intPart, $decPart] = array_pad(explode('.', $value, 2), 2, '');
        $intPart = preg_replace('/\D+/', '', $intPart) ?: '0';
        $decPart = preg_replace('/\D+/', '', $decPart) ?: '';

        if (strlen($decPart) > $decimalPlaces) {
            $decPart = substr($decPart, 0, $decimalPlaces);
        }

        $decPart = str_pad($decPart, $decimalPlaces, '0');

        return (int) ($intPart . $decPart);
    }

    private function toDecimalString(int $cents, int $decimalPlaces): string
    {
        $div = 10 ** max(0, $decimalPlaces);
        $value = $cents / $div;

        return number_format($value, $decimalPlaces, '.', '');
    }

    private function syncBusinessDetail(Product $product, array $businessDetail): void
    {
        $payload = [
            'membership_period_unit' => $businessDetail['membership_period_unit'] ?? null,
            'membership_period_value' => $businessDetail['membership_period_value'] ?? null,
            'membership_renews_manually' => array_key_exists('membership_renews_manually', $businessDetail)
                ? (bool) $businessDetail['membership_renews_manually']
                : true,
            'delivery_mode' => $businessDetail['delivery_mode'] ?? null,
            'service_kind' => $businessDetail['service_kind'] ?? null,
            'access_instructions' => $businessDetail['access_instructions'] ?? null,
            'capacity' => $businessDetail['capacity'] ?? null,
            'starts_at' => $businessDetail['starts_at'] ?? null,
            'ends_at' => $businessDetail['ends_at'] ?? null,
            'location' => $businessDetail['location'] ?? null,
            'meeting_url' => $businessDetail['meeting_url'] ?? null,
        ];

        $hasMeaningfulData = collect($payload)->contains(function ($value) {
            return !is_null($value) && $value !== '';
        });

        if (!$hasMeaningfulData) {
            $product->businessDetail()->delete();
            return;
        }

        $product->businessDetail()->updateOrCreate(
            ['product_id' => $product->id],
            $payload
        );
    }
}

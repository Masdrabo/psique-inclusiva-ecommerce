<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\Language;
use App\Models\Product;
use App\Models\ProductTranslation;
use App\Services\InventoryService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    private const LOW_STOCK_THRESHOLD = 5;

    public function index(Request $request, string $locale): Response
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

        $allowedQuickFilters = ['all', 'critical', 'out', 'low'];
        $quickFilter = $request->string('quick_filter')->toString();
        $quickFilter = in_array($quickFilter, $allowedQuickFilters, true) ? $quickFilter : 'all';

        $allowedSorts = ['latest', 'sku', 'name', 'stock', 'status', 'warehouse'];
        $sortBy = $request->string('sort')->toString();
        $sortBy = in_array($sortBy, $allowedSorts, true) ? $sortBy : 'stock';

        $direction = strtolower($request->string('direction')->toString()) === 'desc' ? 'desc' : 'asc';

        $allowedPerPage = [10, 15, 25, 50, 100];
        $perPage = (int) $request->integer('per_page', 15);
        $perPage = in_array($perPage, $allowedPerPage, true) ? $perPage : 15;

        $search = trim($request->string('q')->toString());

        $productsQuery = $this->buildIndexQuery(
            localeLanguageId: $localeLanguageId,
            fallbackLanguageId: $fallbackLanguageId,
            search: $search,
            quickFilter: $quickFilter
        );

        $this->applyIndexSorting($productsQuery, $sortBy, $direction);

        $products = $productsQuery
            ->paginate($perPage)
            ->withQueryString()
            ->through(function (Product $product) use ($locale, $fallbackLocale) {
                $qtyOnHand = (int) ($product->qty_on_hand_total ?? 0);
                $qtyReserved = (int) ($product->qty_reserved_total ?? 0);
                $availableStock = (int) ($product->available_stock_total ?? 0);

                $variantsSummary = collect();

                if ($product->isVariable()) {
                    $variantsSummary = $product->variants->map(function ($variant) use ($locale, $fallbackLocale) {
                        $availableQty = (int) $variant->inventories->sum(function ($inventory) {
                            return max(0, (int) $inventory->qty_on_hand - (int) $inventory->qty_reserved);
                        });

                        $valueLabels = collect($variant->values ?? [])->map(function ($row) use ($locale, $fallbackLocale) {
                            $attributeName =
                                $row->attribute?->translations?->firstWhere('language.code', $locale)?->name
                                ?? $row->attribute?->translations?->firstWhere('language.code', $fallbackLocale)?->name
                                ?? $row->attribute?->translations?->first()?->name
                                ?? $row->attribute?->code
                                ?? null;

                            $valueName =
                                $row->value?->translations?->firstWhere('language.code', $locale)?->name
                                ?? $row->value?->translations?->firstWhere('language.code', $fallbackLocale)?->name
                                ?? $row->value?->translations?->first()?->name
                                ?? $row->value?->code
                                ?? null;

                            if (!$attributeName && !$valueName) {
                                return null;
                            }

                            if (!$attributeName) {
                                return $valueName;
                            }

                            if (!$valueName) {
                                return $attributeName;
                            }

                            return $attributeName . ': ' . $valueName;
                        })->filter()->values();

                        return [
                            'id' => (int) $variant->id,
                            'sku' => $variant->sku,
                            'is_active' => (bool) $variant->is_active,
                            'available_stock' => $availableQty,
                            'is_out_of_stock' => $availableQty <= 0,
                            'is_low_stock' => $availableQty > 0 && $availableQty <= self::LOW_STOCK_THRESHOLD,
                            'label' => $valueLabels->isNotEmpty() ? $valueLabels->implode(' · ') : ($variant->sku ?: '—'),
                        ];
                    })->values();
                }

                return [
                    'id' => $product->id,
                    'sku' => $product->sku,
                    'slug' => $product->slug,
                    'name' => $product->localized_name ?? $product->slug,
                    'type' => $product->type,
                    'is_variable' => $product->isVariable(),
                    'is_active' => (bool) $product->is_active,

                    'qty_on_hand_total' => $qtyOnHand,
                    'qty_reserved_total' => $qtyReserved,
                    'available_stock' => $availableStock,
                    'is_out_of_stock' => $availableStock <= 0,
                    'is_low_stock' => $availableStock > 0 && $availableStock <= self::LOW_STOCK_THRESHOLD,

                    'translations' => $product->translations->map(function ($translation) {
                        return [
                            'id' => $translation->id,
                            'language_id' => $translation->language_id,
                            'language' => $translation->language ? [
                                'id' => $translation->language->id,
                                'code' => $translation->language->code,
                                'name' => $translation->language->name,
                            ] : null,
                            'name' => $translation->name,
                            'description' => $translation->description,
                            'meta_title' => $translation->meta_title,
                            'meta_description' => $translation->meta_description,
                        ];
                    })->values(),

                    'images' => $product->images
                        ->sortBy([
                            ['is_main', 'desc'],
                            ['position', 'asc'],
                            ['id', 'asc'],
                        ])
                        ->values()
                        ->map(function ($img) {
                            return [
                                'id' => $img->id,
                                'url' => $img->path ? "/storage/{$img->path}" : null,
                                'path' => $img->path,
                                'is_main' => (bool) $img->is_main,
                                'position' => (int) ($img->position ?? 0),
                                'alt' => $img->translations->first()?->alt,
                                'translations' => $img->translations->map(function ($translation) {
                                    return [
                                        'id' => $translation->id,
                                        'language_id' => $translation->language_id,
                                        'language' => $translation->language ? [
                                            'id' => $translation->language->id,
                                            'code' => $translation->language->code,
                                            'name' => $translation->language->name,
                                        ] : null,
                                        'alt' => $translation->alt,
                                    ];
                                })->values(),
                            ];
                        })
                        ->values(),

                    'inventories' => $product->inventories->map(fn ($inv) => [
                        'id' => $inv->id,
                        'warehouse_name' => $inv->warehouse?->name,
                        'qty_on_hand' => (int) $inv->qty_on_hand,
                        'qty_reserved' => (int) $inv->qty_reserved,
                        'available_qty' => max(0, (int) $inv->qty_on_hand - (int) $inv->qty_reserved),
                    ])->values(),

                    'warehouse_name_sort' => $product->warehouse_name_sort,
                    'variants_summary' => $variantsSummary,
                ];
            });

        $cardsQuery = $this->buildIndexQuery(
            localeLanguageId: $localeLanguageId,
            fallbackLanguageId: $fallbackLanguageId,
            search: $search,
            quickFilter: $quickFilter,
            withRelations: false
        );

        $cardRows = $cardsQuery->get(['products.id']);

        $cards = [
            'total_products' => (int) $cardRows->count(),
            'in_stock_products' => (int) $cardRows->filter(function ($p) {
                return (int) ($p->available_stock_total ?? 0) > 0;
            })->count(),
            'out_of_stock_products' => (int) $cardRows->filter(function ($p) {
                return (int) ($p->available_stock_total ?? 0) <= 0;
            })->count(),
            'low_stock_products' => (int) $cardRows->filter(function ($p) {
                $available = (int) ($p->available_stock_total ?? 0);
                return $available > 0 && $available <= self::LOW_STOCK_THRESHOLD;
            })->count(),
            'total_units' => (int) $cardRows->sum(function ($p) {
                return (int) ($p->available_stock_total ?? 0);
            }),
            'low_stock_threshold' => self::LOW_STOCK_THRESHOLD,
        ];

        return Inertia::render('Manager/Inventories/Index', [
            'products' => $products,
            'cards' => $cards,
            'filters' => [
                'q' => $search,
                'quick_filter' => $quickFilter,
                'per_page' => $perPage,
            ],
            'sort' => [
                'by' => $sortBy,
                'direction' => $direction,
            ],
        ]);
    }

    public function update(string $locale, Request $request, Product $product, InventoryService $inventoryService): RedirectResponse
    {
        $data = $request->validate([
            'qty_on_hand' => ['required', 'integer', 'min:0'],
        ]);

        $inventoryService->setProductStock($product, (int) $data['qty_on_hand']);

        return back()->with('success', __('ui.manager.inventory_updated'));
    }

    private function buildIndexQuery(
        int $localeLanguageId,
        int $fallbackLanguageId,
        string $search = '',
        string $quickFilter = 'all',
        bool $withRelations = true
    ): Builder {
        $qtyOnHandSubSql = "(
            case
                when products.type = 'variable' then (
                    select coalesce(sum(i.qty_on_hand), 0)
                    from inventories i
                    inner join product_variants pv on pv.id = i.variant_id
                    where pv.product_id = products.id
                )
                else (
                    select coalesce(sum(i.qty_on_hand), 0)
                    from inventories i
                    where i.product_id = products.id
                )
            end
        )";

        $qtyReservedSubSql = "(
            case
                when products.type = 'variable' then (
                    select coalesce(sum(i.qty_reserved), 0)
                    from inventories i
                    inner join product_variants pv on pv.id = i.variant_id
                    where pv.product_id = products.id
                )
                else (
                    select coalesce(sum(i.qty_reserved), 0)
                    from inventories i
                    where i.product_id = products.id
                )
            end
        )";

        $availableStockSql = "GREATEST(($qtyOnHandSubSql) - ($qtyReservedSubSql), 0)";

        $statusRankSql = "CASE
            WHEN {$availableStockSql} <= 0 THEN 0
            WHEN {$availableStockSql} <= " . self::LOW_STOCK_THRESHOLD . " THEN 1
            ELSE 2
        END";

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
                DB::table('inventories')
                    ->leftJoin('warehouses', 'warehouses.id', '=', 'inventories.warehouse_id')
                    ->whereColumn('inventories.product_id', 'products.id')
                    ->select('warehouses.name')
                    ->orderBy('inventories.id')
                    ->limit(1),
                'warehouse_name_sort'
            )
            ->addSelect(DB::raw("{$qtyOnHandSubSql} as qty_on_hand_total"))
            ->addSelect(DB::raw("{$qtyReservedSubSql} as qty_reserved_total"))
            ->addSelect(DB::raw("{$availableStockSql} as available_stock_total"))
            ->addSelect(DB::raw("{$statusRankSql} as stock_status_rank"));

        if ($withRelations) {
            $query->with([
                'translations.language',
                'inventories.warehouse',
                'images.translations.language',
                'variants.inventories',
                'variants.values.attribute.translations.language',
                'variants.values.value.translations.language',
            ]);
        }

        if ($search !== '') {
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $search) . '%';

            $query->where(function (Builder $q) use ($like) {
                $q->where('products.sku', 'like', $like)
                    ->orWhere('products.slug', 'like', $like)
                    ->orWhereHas('translations', function (Builder $tr) use ($like) {
                        $tr->where('name', 'like', $like);
                    });
            });
        }

        switch ($quickFilter) {
            case 'critical':
                $query->whereRaw("({$availableStockSql} <= ?)", [self::LOW_STOCK_THRESHOLD]);
                break;

            case 'out':
                $query->whereRaw("({$availableStockSql} <= 0)");
                break;

            case 'low':
                $query->whereRaw("({$availableStockSql} > 0 AND {$availableStockSql} <= ?)", [self::LOW_STOCK_THRESHOLD]);
                break;

            case 'all':
            default:
                break;
        }

        return $query;
    }

    private function applyIndexSorting(Builder $query, string $sortBy, string $direction): void
    {
        $direction = strtolower($direction) === 'desc' ? 'desc' : 'asc';

        $qtyOnHandSubSql = "(
            case
                when products.type = 'variable' then (
                    select coalesce(sum(i.qty_on_hand), 0)
                    from inventories i
                    inner join product_variants pv on pv.id = i.variant_id
                    where pv.product_id = products.id
                )
                else (
                    select coalesce(sum(i.qty_on_hand), 0)
                    from inventories i
                    where i.product_id = products.id
                )
            end
        )";

        $qtyReservedSubSql = "(
            case
                when products.type = 'variable' then (
                    select coalesce(sum(i.qty_reserved), 0)
                    from inventories i
                    inner join product_variants pv on pv.id = i.variant_id
                    where pv.product_id = products.id
                )
                else (
                    select coalesce(sum(i.qty_reserved), 0)
                    from inventories i
                    where i.product_id = products.id
                )
            end
        )";

        $availableStockSql = "GREATEST(($qtyOnHandSubSql) - ($qtyReservedSubSql), 0)";

        switch ($sortBy) {
            case 'sku':
                $query
                    ->orderByRaw('CASE WHEN products.sku IS NULL OR products.sku = "" THEN 1 ELSE 0 END ASC')
                    ->orderBy('products.sku', $direction)
                    ->orderBy('products.id', 'desc');
                break;

            case 'name':
                $query
                    ->orderByRaw('CASE WHEN localized_name IS NULL OR localized_name = "" THEN 1 ELSE 0 END ASC')
                    ->orderBy('localized_name', $direction)
                    ->orderBy('products.id', 'desc');
                break;

            case 'warehouse':
                $query
                    ->orderByRaw('CASE WHEN warehouse_name_sort IS NULL OR warehouse_name_sort = "" THEN 1 ELSE 0 END ASC')
                    ->orderBy('warehouse_name_sort', $direction)
                    ->orderBy('products.id', 'desc');
                break;

            case 'status':
                $query
                    ->orderBy('stock_status_rank', $direction)
                    ->orderByRaw("{$availableStockSql} asc")
                    ->orderBy('products.id', 'desc');
                break;

            case 'latest':
                $query->orderBy('products.id', 'desc');
                break;

            case 'stock':
            default:
                $query
                    ->orderByRaw("{$availableStockSql} {$direction}")
                    ->orderBy('products.id', 'desc');
                break;
        }
    }
}

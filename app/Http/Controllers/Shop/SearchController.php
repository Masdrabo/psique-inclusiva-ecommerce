<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Language;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;

class SearchController extends Controller
{
    public function index(string $locale, Request $request)
    {
        $q = trim((string) $request->query('q', ''));

        if ($q === '' || mb_strlen($q) < 2) {
            return response()->json([
                'products' => [],
                'categories' => [],
            ]);
        }

        $currentLocale = App::getLocale();

        $localeLanguageId = Language::query()
            ->where('code', $currentLocale)
            ->value('id');

        $fallbackLanguageId = Language::query()
            ->where('code', config('app.fallback_locale', 'pt'))
            ->value('id');

        $products = Product::query()
            ->whereHas('translations', function ($query) use ($q) {
                $query->where('name', 'like', "%{$q}%");
            })
            ->with([
                'translations',
                'images.translations',
                'prices.currency',
            ])
            ->limit(5)
            ->get()
            ->map(function ($product) use ($localeLanguageId, $fallbackLanguageId) {
                $translation = $product->translations->firstWhere('language_id', $localeLanguageId)
                    ?? $product->translations->firstWhere('language_id', $fallbackLanguageId)
                    ?? $product->translations->first();

                $mainImage = $product->images?->firstWhere('is_main', true)
                    ?? $product->images?->first();

                $imageTranslation = $mainImage?->translations?->firstWhere('language_id', $localeLanguageId)
                    ?? $mainImage?->translations?->firstWhere('language_id', $fallbackLanguageId)
                    ?? $mainImage?->translations?->first();

                $price = $product->prices?->sortByDesc('id')->first();
                $priceCurrency = $price?->currency;

                return [
                    'id' => $product->id,
                    'name' => $translation?->name ?? '—',
                    'slug' => $product->slug,
                    'image' => $mainImage ? [
                        'url' => $mainImage->path ? asset('storage/' . ltrim($mainImage->path, '/')) : null,
                        'alt' => $imageTranslation?->alt ?? $translation?->name ?? '—',
                    ] : null,
                    'price' => $price ? [
                        'amount' => (int) ($price->amount ?? 0),
                        'currency' => [
                            'code' => $priceCurrency?->code ?? 'EUR',
                            'symbol' => $priceCurrency?->symbol ?? '€',
                            'decimal_places' => (int) ($priceCurrency?->decimal_places ?? 2),
                        ],
                    ] : null,
                ];
            })
            ->values();

        $categories = Category::query()
            ->whereHas('translations', function ($query) use ($q) {
                $query->where('name', 'like', "%{$q}%");
            })
            ->with('translations')
            ->limit(3)
            ->get()
            ->map(function ($category) use ($localeLanguageId, $fallbackLanguageId) {
                $translation = $category->translations->firstWhere('language_id', $localeLanguageId)
                    ?? $category->translations->firstWhere('language_id', $fallbackLanguageId)
                    ?? $category->translations->first();

                return [
                    'id' => $category->id,
                    'name' => $translation?->name ?? '—',
                    'slug' => $category->slug,
                ];
            })
            ->values();

        return response()->json([
            'products' => $products,
            'categories' => $categories,
        ]);
    }
}

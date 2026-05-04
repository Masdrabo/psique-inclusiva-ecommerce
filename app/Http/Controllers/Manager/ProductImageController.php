<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Http\Requests\Manager\ReorderProductImagesRequest;
use App\Http\Requests\Manager\StoreProductImagesRequest;
use App\Http\Requests\Manager\UpdateProductImageAltRequest;
use App\Models\Language;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductImageTranslation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ProductImageController extends Controller
{
    public function store(StoreProductImagesRequest $request, string $locale, Product $product): RedirectResponse
    {
        DB::transaction(function () use ($request, $product) {
            $existingMaxPos = (int) ($product->images()->max('position') ?? 0);
            $hasMain = $product->images()->where('is_main', true)->exists();

            foreach ($request->file('images', []) as $i => $file) {
                $path = $file->store("products/{$product->id}", 'public');

                $image = ProductImage::create([
                    'product_id' => $product->id,
                    'path' => $path,
                    'alt' => null,
                    'position' => $existingMaxPos + $i + 1,
                    'is_main' => false,
                ]);

                // Se ainda não existe main, a primeira imagem do upload vira main.
                // (e fica coerente: é a primeira "principal", mas não mexemos no position aqui)
                if (!$hasMain && $i === 0) {
                    $this->makeMain($product, $image);
                    $hasMain = true;
                }
            }
        });

        return redirect()
            ->route('manager.products.edit', ['locale' => $locale, 'product' => $product->id])
            ->with('success', __('ui.manager.product_image_uploaded'));
    }

    /**
     * ✅ Polish: "Definir como principal" move a imagem para posição #1
     * e aplica auto-main (posição #1 = is_main).
     */
    public function setMain(string $locale, Product $product, ProductImage $image): RedirectResponse
    {
        abort_unless($image->product_id === $product->id, 404);

        DB::transaction(function () use ($product, $image) {
            // Buscar imagens ordenadas
            $imgs = $product->images()->get()->values();
            if ($imgs->isEmpty()) {
                return;
            }

            // Se já for a primeira, só garante main (idempotente)
            $first = $imgs->first();
            if ($first && (int) $first->id === (int) $image->id) {
                $this->applyAutoMainByFirstId($product, (int) $image->id);
                return;
            }

            // Reordenar: imagem escolhida passa a primeira
            $newOrder = collect([$image->id])
                ->merge($imgs->pluck('id')->filter(fn ($id) => (int) $id !== (int) $image->id))
                ->values()
                ->all();

            // Atualizar posições
            foreach ($newOrder as $index => $id) {
                ProductImage::query()
                    ->where('product_id', $product->id)
                    ->where('id', (int) $id)
                    ->update(['position' => $index + 1]);
            }

            // Auto-main pela primeira
            $this->applyAutoMainByFirstId($product, (int) $newOrder[0]);
        });

        return redirect()
            ->route('manager.products.edit', ['locale' => $locale, 'product' => $product->id])
            ->with('success', __('ui.manager.product_image_set_main'));
    }

    public function reorder(ReorderProductImagesRequest $request, string $locale, Product $product): RedirectResponse
    {
        $ids = $request->input('order', []);

        DB::transaction(function () use ($product, $ids) {
            $existing = $product->images()->pluck('id')->all();
            sort($existing);

            $incoming = array_map('intval', $ids);
            sort($incoming);

            // garante que a lista enviada corresponde exatamente às imagens do produto
            if ($incoming !== $existing) {
                abort(422, 'Invalid image order payload.');
            }

            // atualizar posições
            foreach ($ids as $index => $id) {
                ProductImage::query()
                    ->where('id', (int) $id)
                    ->where('product_id', $product->id)
                    ->update(['position' => $index + 1]);
            }

            // ✅ AUTO-MAIN: imagem na posição #1 passa a ser a principal
            $firstId = (int) ($ids[0] ?? 0);
            $this->applyAutoMainByFirstId($product, $firstId);
        });

        return redirect()
            ->route('manager.products.edit', ['locale' => $locale, 'product' => $product->id])
            ->with('success', __('ui.manager.product_images_reordered'));
    }

    public function updateAlt(UpdateProductImageAltRequest $request, string $locale, Product $product, ProductImage $image): RedirectResponse
    {
        abort_unless($image->product_id === $product->id, 404);

        DB::transaction(function () use ($request, $image) {
            $languages = Language::query()
                ->whereIn('code', ['pt', 'en'])
                ->get()
                ->keyBy('code');

            $translations = $request->input('translations', []);

            foreach (['pt', 'en'] as $code) {
                $alt = $translations[$code]['alt'] ?? null;
                $alt = is_string($alt) ? trim($alt) : null;

                ProductImageTranslation::updateOrCreate(
                    [
                        'product_image_id' => $image->id,
                        'language_id' => $languages[$code]->id,
                    ],
                    [
                        'alt' => ($alt !== '') ? $alt : null,
                    ]
                );
            }
        });

        return redirect()
            ->route('manager.products.edit', ['locale' => $locale, 'product' => $product->id])
            ->with('success', __('ui.manager.product_image_alt_updated'));
    }

    public function destroy(string $locale, Product $product, ProductImage $image): RedirectResponse
    {
        abort_unless($image->product_id === $product->id, 404);

        DB::transaction(function () use ($product, $image) {
            $wasMain = (bool) $image->is_main;
            $path = $image->path;

            $image->delete();

            if ($path) {
                Storage::disk('public')->delete($path);
            }

            // reordenar posições (compactar 1..n)
            $imgs = $product->images()->get()->values();
            $imgs->each(function ($img, $idx) {
                $img->update(['position' => $idx + 1]);
            });

            // Se apagou a main, a primeira vira main.
            // Mesmo que não tenha apagado a main, garantimos consistência: posição #1 = main.
            $first = $product->images()->first();
            $this->applyAutoMainByFirstId($product, (int) ($first?->id ?? 0));
        });

        return redirect()
            ->route('manager.products.edit', ['locale' => $locale, 'product' => $product->id])
            ->with('success', __('ui.manager.product_image_deleted'));
    }

    /**
     * Garante: apenas a imagem $firstId fica is_main=true.
     */
    private function applyAutoMainByFirstId(Product $product, int $firstId): void
    {
        ProductImage::query()
            ->where('product_id', $product->id)
            ->update(['is_main' => false]);

        if ($firstId) {
            ProductImage::query()
                ->where('product_id', $product->id)
                ->where('id', $firstId)
                ->update(['is_main' => true]);
        }
    }

    // Mantido por compatibilidade, mas agora usamos applyAutoMainByFirstId para coerência.
    private function makeMain(Product $product, ProductImage $image): void
    {
        $this->applyAutoMainByFirstId($product, (int) $image->id);
    }
}

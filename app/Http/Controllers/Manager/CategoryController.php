<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Http\Requests\Manager\StoreCategoryRequest;
use App\Http\Requests\Manager\UpdateCategoryRequest;
use App\Models\Category;
use App\Models\CategoryTranslation;
use App\Models\Language;
use App\Models\SlugRedirect;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class CategoryController extends Controller
{
    public function index(string $locale): Response
    {
        return Inertia::render('Manager/Categories/Index', [
            'categories' => Category::query()
                ->with(['translations.language', 'parent'])
                ->orderBy('position')
                ->orderBy('id')
                ->get(),
        ]);
    }

    public function create(string $locale): Response
    {
        return Inertia::render('Manager/Categories/Create', [
            'categories' => Category::query()
                ->with(['translations.language'])
                ->orderBy('position')
                ->orderBy('id')
                ->get(),

            'languages' => Language::query()
                ->whereIn('code', ['pt', 'en'])
                ->orderBy('code')
                ->get(['id', 'code', 'name']),
        ]);
    }

    public function edit(string $locale, Category $category): Response
    {
        $category->load(['translations.language', 'parent']);

        $category->image_url = $category->image
            ? Storage::url($category->image)
            : null;

        return Inertia::render('Manager/Categories/Edit', [
            'category' => $category,

            'categories' => Category::query()
                ->where('id', '!=', $category->id)
                ->with(['translations.language'])
                ->orderBy('position')
                ->orderBy('id')
                ->get(),

            'languages' => Language::query()
                ->whereIn('code', ['pt', 'en'])
                ->orderBy('code')
                ->get(['id', 'code', 'name']),
        ]);
    }

    public function store(StoreCategoryRequest $request, string $locale): RedirectResponse
    {
        DB::transaction(function () use ($request) {
            $imagePath = null;

            if ($request->hasFile('image')) {
                $imagePath = $request->file('image')->store('categories', 'public');
            }

            $parentId = $request->input('parent_id');

            $category = Category::create([
                'slug' => $request->string('slug')->toString(),
                'parent_id' => $parentId,
                'is_active' => $request->boolean('is_active', true),
                'position' => Category::nextPositionForParent($parentId),
                'image' => $imagePath,
            ]);

            $languages = Language::query()
                ->whereIn('code', ['pt', 'en'])
                ->get()
                ->keyBy('code');

            $translations = $request->input('translations', []);

            foreach (['pt', 'en'] as $code) {
                $data = $translations[$code] ?? [];

                CategoryTranslation::create([
                    'category_id' => $category->id,
                    'language_id' => $languages[$code]->id,
                    'name' => $data['name'] ?? '',
                    'description' => $data['description'] ?? null,
                    'meta_title' => $data['meta_title'] ?? null,
                    'meta_description' => $data['meta_description'] ?? null,
                ]);
            }
        });

        return redirect()
            ->route('manager.categories.index', ['locale' => $locale])
            ->with('success', __('ui.manager.category_created'));
    }

    public function update(UpdateCategoryRequest $request, string $locale, Category $category): RedirectResponse
    {
        DB::transaction(function () use ($request, $category) {
            $oldSlug = (string) $category->slug;
            $newSlug = $request->string('slug')->toString();

            $oldParentId = $category->parent_id;
            $newParentId = $request->input('parent_id');
            $parentChanged = (int) ($oldParentId ?? 0) !== (int) ($newParentId ?? 0);

            $imagePath = $category->image;

            if ($request->boolean('remove_image') && $imagePath) {
                Storage::disk('public')->delete($imagePath);
                $imagePath = null;
            }

            if ($request->hasFile('image')) {
                if ($imagePath) {
                    Storage::disk('public')->delete($imagePath);
                }

                $imagePath = $request->file('image')->store('categories', 'public');
            }

            $updateData = [
                'slug' => $newSlug,
                'parent_id' => $newParentId,
                'is_active' => $request->boolean('is_active', true),
                'image' => $imagePath,
            ];

            if ($parentChanged) {
                $updateData['position'] = Category::nextPositionForParent($newParentId);
            }

            $category->update($updateData);

            if ($oldSlug !== '' && $oldSlug !== $newSlug) {
                SlugRedirect::query()
                    ->where('redirectable_type', Category::class)
                    ->where('new_slug', $oldSlug)
                    ->update(['new_slug' => $newSlug]);

                SlugRedirect::query()->firstOrCreate(
                    [
                        'redirectable_type' => Category::class,
                        'old_slug' => $oldSlug,
                    ],
                    [
                        'redirectable_id' => $category->id,
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

                CategoryTranslation::updateOrCreate(
                    [
                        'category_id' => $category->id,
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
        });

        return redirect()
            ->route('manager.categories.index', ['locale' => $locale])
            ->with('success', __('ui.manager.category_updated'));
    }

    public function destroy(string $locale, Category $category): RedirectResponse
    {
        if ($category->image) {
            Storage::disk('public')->delete($category->image);
        }

        $category->delete();

        return redirect()
            ->route('manager.categories.index', ['locale' => $locale])
            ->with('success', __('ui.manager.category_deleted'));
    }
}

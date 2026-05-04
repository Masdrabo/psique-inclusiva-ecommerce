<?php

namespace Tests\Feature;

use App\Models\Currency;
use App\Models\Language;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductTranslation;
use App\Models\User;
use App\Models\WishlistItem;
use Database\Seeders\EcommerceBaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WishlistFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('queue.default', 'sync');
        config()->set('mail.default', 'array');
        config()->set('app.locale', 'pt');
        config()->set('app.fallback_locale', 'en');

        $this->seed(EcommerceBaseSeeder::class);
    }

    public function test_authenticated_user_can_add_product_to_wishlist(): void
    {
        $user = User::factory()->create();
        $product = $this->createWishlistProduct('WISH-001');

        $response = $this->actingAs($user)->post(route('wishlist.store', [
            'locale' => 'pt',
            'product' => $product->id,
        ]));

        $response->assertRedirect();

        $this->assertDatabaseHas('wishlist_items', [
            'user_id' => $user->id,
            'product_id' => $product->id,
        ]);

        $this->assertSame(
            1,
            WishlistItem::query()
                ->where('user_id', $user->id)
                ->where('product_id', $product->id)
                ->count()
        );
    }

    public function test_adding_same_product_twice_does_not_duplicate_wishlist_item(): void
    {
        $user = User::factory()->create();
        $product = $this->createWishlistProduct('WISH-002');

        $this->actingAs($user)->post(route('wishlist.store', [
            'locale' => 'pt',
            'product' => $product->id,
        ]));

        $this->actingAs($user)->post(route('wishlist.store', [
            'locale' => 'pt',
            'product' => $product->id,
        ]));

        $this->assertDatabaseHas('wishlist_items', [
            'user_id' => $user->id,
            'product_id' => $product->id,
        ]);

        $this->assertSame(
            1,
            WishlistItem::query()
                ->where('user_id', $user->id)
                ->where('product_id', $product->id)
                ->count()
        );
    }

    public function test_authenticated_user_can_remove_product_from_wishlist(): void
    {
        $user = User::factory()->create();
        $product = $this->createWishlistProduct('WISH-003');

        WishlistItem::query()->create([
            'user_id' => $user->id,
            'product_id' => $product->id,
        ]);

        $response = $this->actingAs($user)->delete(route('wishlist.destroy', [
            'locale' => 'pt',
            'product' => $product->id,
        ]));

        $response->assertRedirect();

        $this->assertDatabaseMissing('wishlist_items', [
            'user_id' => $user->id,
            'product_id' => $product->id,
        ]);
    }

    public function test_guest_cannot_add_product_to_wishlist(): void
    {
        $product = $this->createWishlistProduct('WISH-004');

        $response = $this->post(route('wishlist.store', [
            'locale' => 'pt',
            'product' => $product->id,
        ]));

        $response->assertRedirect(route('login', ['locale' => 'pt']));

        $this->assertDatabaseCount('wishlist_items', 0);
    }

    public function test_wishlist_page_shows_only_products_of_authenticated_user(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $productA = $this->createWishlistProduct('WISH-005');
        $productB = $this->createWishlistProduct('WISH-006');

        WishlistItem::query()->create([
            'user_id' => $userA->id,
            'product_id' => $productA->id,
        ]);

        WishlistItem::query()->create([
            'user_id' => $userB->id,
            'product_id' => $productB->id,
        ]);

        $response = $this->actingAs($userA)->get(route('wishlist.index', [
            'locale' => 'en',
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Wishlist/Index')
            ->has('items', 1)
            ->where('items.0.product.id', $productA->id)
            ->where('items.0.product.sku', 'WISH-005')
            ->where('items.0.product.slug', 'wish-005-slug')
        );
    }

    private function createWishlistProduct(string $sku): Product
    {
        $product = Product::query()->create([
            'sku' => $sku,
            'slug' => strtolower($sku) . '-slug',
            'type' => 'simple',
            'business_type' => 'physical',
            'is_active' => true,
            'barcode' => null,
            'weight_grams' => null,
            'requires_shipping' => true,
            'manages_inventory' => false,
            'allow_quantity' => true,
            'requires_customer_notes' => false,
            'max_per_order' => null,
            'available_from' => null,
            'available_until' => null,
        ]);

        $pt = Language::query()->where('code', 'pt')->firstOrFail();
        $en = Language::query()->where('code', 'en')->firstOrFail();
        $eur = Currency::query()->where('code', 'EUR')->firstOrFail();

        ProductTranslation::query()->create([
            'product_id' => $product->id,
            'language_id' => $pt->id,
            'name' => 'Produto ' . $sku,
            'description' => 'Descrição PT',
            'meta_title' => 'Meta PT',
            'meta_description' => 'Meta desc PT',
            'is_machine_translated' => false,
        ]);

        ProductTranslation::query()->create([
            'product_id' => $product->id,
            'language_id' => $en->id,
            'name' => 'Product ' . $sku,
            'description' => 'Description EN',
            'meta_title' => 'Meta EN',
            'meta_description' => 'Meta desc EN',
            'is_machine_translated' => false,
        ]);

        ProductPrice::query()->create([
            'currency_id' => $eur->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'amount' => 1999,
            'compare_at_amount' => null,
        ]);

        return $product->fresh([
            'translations',
            'prices.currency',
        ]);
    }
}

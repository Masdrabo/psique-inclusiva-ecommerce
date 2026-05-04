<?php

namespace Tests\Feature;

use App\Models\Currency;
use App\Models\Customer;
use App\Models\Language;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatus;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductReview;
use App\Models\ProductTranslation;
use App\Models\User;
use Database\Seeders\EcommerceBaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductReviewFlowTest extends TestCase
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

    public function test_user_with_delivered_order_can_create_review(): void
    {
        $user = User::factory()->create();
        $product = $this->createReviewProduct('REV-001');

        $this->createDeliveredOrderForProduct($user, $product);

        $response = $this->actingAs($user)->post(route('shop.reviews.store', [
            'locale' => 'pt',
            'product' => $product->id,
        ]), [
            'rating' => 5,
            'title' => 'Excelente',
            'body' => 'Produto muito bom.',
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('product_reviews', [
            'product_id' => $product->id,
            'user_id' => $user->id,
            'rating' => 5,
            'title' => 'Excelente',
            'body' => 'Produto muito bom.',
            'is_verified_purchase' => 1,
            'is_visible' => 1,
        ]);

        $this->assertSame(
            1,
            ProductReview::query()
                ->where('product_id', $product->id)
                ->where('user_id', $user->id)
                ->count()
        );
    }

    public function test_user_without_purchase_cannot_create_review(): void
    {
        $user = User::factory()->create();
        $product = $this->createReviewProduct('REV-002');

        $response = $this->from(route('shop.products.show', [
            'locale' => 'pt',
            'product' => $product->slug,
        ]))->actingAs($user)->post(route('shop.reviews.store', [
            'locale' => 'pt',
            'product' => $product->id,
        ]), [
            'rating' => 4,
            'title' => 'Bom',
            'body' => 'Mas não comprei.',
        ]);

        $response->assertRedirect();

        $response->assertSessionHasErrors('review');

        $this->assertDatabaseCount('product_reviews', 0);
    }

    public function test_user_with_non_delivered_order_cannot_create_review(): void
    {
        $user = User::factory()->create();
        $product = $this->createReviewProduct('REV-003');

        $this->createOrderForProductWithStatus($user, $product, 'paid');

        $response = $this->from(route('shop.products.show', [
            'locale' => 'pt',
            'product' => $product->slug,
        ]))->actingAs($user)->post(route('shop.reviews.store', [
            'locale' => 'pt',
            'product' => $product->id,
        ]), [
            'rating' => 3,
            'title' => 'Ainda cedo',
            'body' => 'Encomenda ainda não entregue.',
        ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('review');

        $this->assertDatabaseCount('product_reviews', 0);
    }

    public function test_second_review_submission_updates_existing_review_instead_of_creating_duplicate(): void
    {
        $user = User::factory()->create();
        $product = $this->createReviewProduct('REV-004');

        $this->createDeliveredOrderForProduct($user, $product);

        $this->actingAs($user)->post(route('shop.reviews.store', [
            'locale' => 'pt',
            'product' => $product->id,
        ]), [
            'rating' => 4,
            'title' => 'Primeira',
            'body' => 'Primeira versão.',
        ]);

        $this->actingAs($user)->post(route('shop.reviews.store', [
            'locale' => 'pt',
            'product' => $product->id,
        ]), [
            'rating' => 5,
            'title' => 'Atualizada',
            'body' => 'Versão final.',
        ]);

        $this->assertSame(
            1,
            ProductReview::query()
                ->where('product_id', $product->id)
                ->where('user_id', $user->id)
                ->count()
        );

        $this->assertDatabaseHas('product_reviews', [
            'product_id' => $product->id,
            'user_id' => $user->id,
            'rating' => 5,
            'title' => 'Atualizada',
            'body' => 'Versão final.',
            'is_verified_purchase' => 1,
        ]);
    }

    public function test_user_can_delete_own_review(): void
    {
        $user = User::factory()->create();
        $product = $this->createReviewProduct('REV-005');

        $this->createDeliveredOrderForProduct($user, $product);

        ProductReview::query()->create([
            'product_id' => $product->id,
            'user_id' => $user->id,
            'rating' => 5,
            'title' => 'Excelente',
            'body' => 'A apagar.',
            'is_verified_purchase' => true,
            'is_visible' => true,
        ]);

        $response = $this->actingAs($user)->delete(route('shop.reviews.destroy', [
            'locale' => 'pt',
            'product' => $product->id,
        ]));

        $response->assertRedirect();

        $this->assertDatabaseMissing('product_reviews', [
            'product_id' => $product->id,
            'user_id' => $user->id,
        ]);
    }

    public function test_product_show_exposes_can_review_my_review_reviews_and_summary_for_verified_buyer(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        $product = $this->createReviewProduct('REV-006');

        $this->createDeliveredOrderForProduct($user, $product);
        $this->createDeliveredOrderForProduct($otherUser, $product);

        ProductReview::query()->create([
            'product_id' => $product->id,
            'user_id' => $user->id,
            'rating' => 5,
            'title' => 'Excelente',
            'body' => 'Muito bom.',
            'is_verified_purchase' => true,
            'is_visible' => true,
        ]);

        ProductReview::query()->create([
            'product_id' => $product->id,
            'user_id' => $otherUser->id,
            'rating' => 3,
            'title' => 'Razoável',
            'body' => 'Foi ok.',
            'is_verified_purchase' => true,
            'is_visible' => true,
        ]);

        $response = $this->actingAs($user)->get(route('shop.products.show', [
            'locale' => 'en',
            'product' => $product->slug,
        ]));

        $response->assertOk();

        $response->assertInertia(fn ($page) => $page
            ->component('Shop/ProductShow')
            ->where('product.id', $product->id)
            ->where('can_review', true)
            ->where('my_review.rating', 5)
            ->where('my_review.title', 'Excelente')
            ->where('reviews_summary.count', 2)
            ->where('reviews_summary.average_rating', 4)
            ->has('reviews', 2)
            ->where('reviews.0.is_verified_purchase', true)
        );
    }

    private function createReviewProduct(string $sku): Product
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

    private function createDeliveredOrderForProduct(User $user, Product $product): Order
    {
        return $this->createOrderForProductWithStatus($user, $product, 'delivered');
    }

    private function createOrderForProductWithStatus(User $user, Product $product, string $statusCode): Order
    {
        $customer = Customer::query()->firstOrCreate(
            ['user_id' => $user->id],
            [
                'phone' => '910000000',
                'vat_number' => '123456789',
                'company_name' => 'Review Test Lda',
            ]
        );

        $currency = Currency::query()->where('code', 'EUR')->firstOrFail();
        $status = OrderStatus::query()->where('code', $statusCode)->firstOrFail();

        $order = Order::query()->create([
            'order_number' => 'REV-ORD-' . strtoupper(bin2hex(random_bytes(4))),
            'user_id' => $user->id,
            'customer_id' => $customer->id,
            'currency_id' => $currency->id,
            'status_id' => $status->id,
            'billing_address' => [
                'name' => 'Billing Test',
                'line1' => 'Rua Billing 1',
                'line2' => null,
                'city' => 'Lisboa',
                'postal_code' => '1000-001',
                'region' => 'Lisboa',
                'country_code' => 'PT',
            ],
            'shipping_address' => [
                'name' => 'Shipping Test',
                'line1' => 'Rua Shipping 1',
                'line2' => null,
                'city' => 'Porto',
                'postal_code' => '4000-001',
                'region' => 'Porto',
                'country_code' => 'PT',
            ],
            'subtotal_amount' => 1999,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_amount' => 0,
            'total_amount' => 1999,
            'paid_at' => now(),
        ]);

        OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'name' => 'Review Product Item',
            'sku' => $product->sku,
            'qty' => 1,
            'unit_amount' => 1999,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 1999,
            'meta' => null,
        ]);

        return $order;
    }
}

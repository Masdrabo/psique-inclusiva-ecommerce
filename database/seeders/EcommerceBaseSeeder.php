<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\CategoryTranslation;
use App\Models\Currency;
use App\Models\Language;
use App\Models\OrderStatus;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductTranslation;
use App\Models\ShippingMethod;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class EcommerceBaseSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            // -------------------------
            // LANGUAGES
            // -------------------------
            $pt = Language::firstOrCreate(
                ['code' => 'pt'],
                ['name' => 'Português', 'is_default' => true, 'is_active' => true]
            );

            $en = Language::firstOrCreate(
                ['code' => 'en'],
                ['name' => 'English', 'is_default' => false, 'is_active' => true]
            );

            // Garantir que só PT é default
            Language::where('id', $pt->id)->update(['is_default' => true, 'is_active' => true]);
            Language::where('id', '!=', $pt->id)->update(['is_default' => false]);

            // -------------------------
            // CURRENCY (EUR)
            // -------------------------
            Currency::query()->update(['is_default' => false]);

            $eur = Currency::firstOrCreate(
                ['code' => 'EUR'],
                [
                    'symbol' => '€',
                    'decimal_places' => 2,
                    'is_default' => true,
                    'is_active' => true,
                ]
            );

            $eur->update(['is_default' => true, 'is_active' => true]);

            // -------------------------
            // WAREHOUSE (base)
            // -------------------------
            Warehouse::query()->update(['is_default' => false]);

            Warehouse::firstOrCreate(
                ['name' => 'Main Warehouse'],
                ['is_default' => true]
            );

            Warehouse::query()
                ->where('name', 'Main Warehouse')
                ->update(['is_default' => true]);

            // -------------------------
            // CATEGORY (base)
            // -------------------------
            $category = Category::firstOrCreate(
                ['slug' => 'demo-category'],
                [
                    'parent_id' => null,
                    'is_active' => true,
                    'position' => 1,
                ]
            );

            // CATEGORY TRANSLATIONS
            CategoryTranslation::updateOrCreate(
                ['category_id' => $category->id, 'language_id' => $pt->id],
                [
                    'name' => 'Categoria Demo',
                    'description' => 'Categoria de teste',
                    'meta_title' => 'Categoria Demo',
                    'meta_description' => 'Categoria demo para testes',
                ]
            );

            CategoryTranslation::updateOrCreate(
                ['category_id' => $category->id, 'language_id' => $en->id],
                [
                    'name' => 'Demo Category',
                    'description' => 'Test category',
                    'meta_title' => 'Demo Category',
                    'meta_description' => 'Demo category for testing',
                ]
            );

            // -------------------------
            // PRODUCT (base)
            // -------------------------
            $product = Product::firstOrCreate(
                ['sku' => 'DEMO-001'],
                [
                    'slug' => 'demo-product',
                    'type' => 'simple',
                    'is_active' => true,
                    'barcode' => null,
                    'weight_grams' => null,
                ]
            );

            if ($product->slug !== 'demo-product') {
                // mantém o existente
            }

            // PRODUCT TRANSLATIONS
            ProductTranslation::updateOrCreate(
                ['product_id' => $product->id, 'language_id' => $pt->id],
                [
                    'name' => 'Produto Demo',
                    'description' => 'Produto de teste',
                    'meta_title' => 'Produto Demo',
                    'meta_description' => 'Produto demo para testes',
                    'is_machine_translated' => false,
                ]
            );

            ProductTranslation::updateOrCreate(
                ['product_id' => $product->id, 'language_id' => $en->id],
                [
                    'name' => 'Demo Product',
                    'description' => 'Test product',
                    'meta_title' => 'Demo Product',
                    'meta_description' => 'Demo product for testing',
                    'is_machine_translated' => false,
                ]
            );

            // -------------------------
            // PIVOT category_product
            // -------------------------
            $category->products()->syncWithoutDetaching([$product->id]);

            // -------------------------
            // PRODUCT PRICE (EUR) — em cêntimos
            // -------------------------
            ProductPrice::updateOrCreate(
                [
                    'currency_id' => $eur->id,
                    'product_id' => $product->id,
                    'variant_id' => null,
                ],
                [
                    'amount' => 1999,
                    'compare_at_amount' => 2499,
                ]
            );

            // -------------------------
            // ORDER STATUSES (base)
            // -------------------------
            OrderStatus::firstOrCreate(
                ['code' => 'pending_payment'],
                ['name' => 'A aguardar pagamento']
            );

            OrderStatus::firstOrCreate(
                ['code' => 'paid'],
                ['name' => 'Pago']
            );

            OrderStatus::firstOrCreate(
                ['code' => 'cancelled'],
                ['name' => 'Cancelado']
            );

            OrderStatus::firstOrCreate(['code' => 'processing'], ['name' => 'A processar']);
            OrderStatus::firstOrCreate(['code' => 'shipped'], ['name' => 'Enviado']);
            OrderStatus::firstOrCreate(['code' => 'delivered'], ['name' => 'Entregue']);
            OrderStatus::firstOrCreate(['code' => 'partially_refunded'], ['name' => 'Parcialmente reembolsada']);
            OrderStatus::firstOrCreate(['code' => 'refunded'], ['name' => 'Reembolsada']);

            // -------------------------
            // SHIPPING METHODS (base)
            // -------------------------
            ShippingMethod::firstOrCreate(
                ['code' => 'standard'],
                ['name' => 'Envio standard', 'is_active' => true]
            );

            ShippingMethod::firstOrCreate(
                ['code' => 'pickup'],
                ['name' => 'Levantamento em loja', 'is_active' => true]
            );

            // -------------------------
            // SHIPPING ZONES / RATES
            // -------------------------
            $this->call([
                ShippingZoneSeeder::class,
                ShippingRateSeeder::class,
            ]);

            // -------------------------
            // PAYMENT METHODS (base)
            // -------------------------
            PaymentMethod::firstOrCreate(
                ['code' => 'manual'],
                ['name' => 'Pagamento manual (MVP)', 'is_active' => true]
            );

            PaymentMethod::firstOrCreate(
                ['code' => 'ifthenpay_mb'],
                ['name' => 'Multibanco', 'is_active' => true]
            );

            PaymentMethod::firstOrCreate(
                ['code' => 'ifthenpay_mbway'],
                ['name' => 'MB WAY', 'is_active' => true]
            );
        });
    }
}

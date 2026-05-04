<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\User;
use Database\Seeders\EcommerceBaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminCouponCrudTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('app.locale', 'pt');
        config()->set('app.fallback_locale', 'en');

        $this->seed(EcommerceBaseSeeder::class);
    }

    public function test_admin_can_open_coupons_index(): void
    {
        $admin = $this->makeUserWithRole('admin');

        $response = $this->actingAs($admin)->get(route('admin.coupons.index', [
            'locale' => 'pt',
        ]));

        $response->assertOk();

        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Coupons/Index')
            ->has('filters')
            ->has('statusOptions')
            ->has('coupons')
        );
    }

    public function test_admin_can_create_fixed_amount_coupon(): void
    {
        $admin = $this->makeUserWithRole('admin');

        $response = $this->actingAs($admin)->post(route('admin.coupons.store', [
            'locale' => 'pt',
        ]), [
            'code' => 'SAVE10',
            'name' => 'Poupa 10€',
            'type' => 'fixed_amount',
            'amount' => '10.00',
            'percentage' => '',
            'minimum_subtotal_amount' => '25.00',
            'max_total_uses' => 100,
            'max_uses_per_user' => 2,
            'is_active' => true,
            'starts_at' => '',
            'ends_at' => '',
        ]);

        $response->assertRedirect(route('admin.coupons.index', [
            'locale' => 'pt',
        ]));

        $this->assertDatabaseHas('coupons', [
            'code' => 'SAVE10',
            'name' => 'Poupa 10€',
            'type' => 'fixed_amount',
            'amount' => 1000,
            'percentage' => null,
            'minimum_subtotal_amount' => 2500,
            'max_total_uses' => 100,
            'max_uses_per_user' => 2,
            'is_active' => 1,
            'total_uses' => 0,
        ]);
    }

    public function test_admin_can_create_percentage_coupon(): void
    {
        $admin = $this->makeUserWithRole('admin');

        $response = $this->actingAs($admin)->post(route('admin.coupons.store', [
            'locale' => 'pt',
        ]), [
            'code' => 'PERC15',
            'name' => 'Desconto 15%',
            'type' => 'percentage',
            'amount' => '',
            'percentage' => '15',
            'minimum_subtotal_amount' => '0',
            'max_total_uses' => '',
            'max_uses_per_user' => '',
            'is_active' => true,
            'starts_at' => '',
            'ends_at' => '',
        ]);

        $response->assertRedirect(route('admin.coupons.index', [
            'locale' => 'pt',
        ]));

        $this->assertDatabaseHas('coupons', [
            'code' => 'PERC15',
            'name' => 'Desconto 15%',
            'type' => 'percentage',
            'amount' => null,
            'percentage' => 15.00,
            'minimum_subtotal_amount' => 0,
            'is_active' => 1,
        ]);
    }

    public function test_validation_fails_when_fixed_amount_coupon_has_no_amount(): void
    {
        $admin = $this->makeUserWithRole('admin');

        $response = $this->from(route('admin.coupons.create', [
            'locale' => 'pt',
        ]))->actingAs($admin)->post(route('admin.coupons.store', [
            'locale' => 'pt',
        ]), [
            'code' => 'BROKENFIXED',
            'name' => 'Cupão inválido',
            'type' => 'fixed_amount',
            'amount' => '',
            'percentage' => '',
            'minimum_subtotal_amount' => '10.00',
            'max_total_uses' => '',
            'max_uses_per_user' => '',
            'is_active' => true,
            'starts_at' => '',
            'ends_at' => '',
        ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('amount');

        $this->assertDatabaseMissing('coupons', [
            'code' => 'BROKENFIXED',
        ]);
    }

    public function test_validation_fails_when_percentage_coupon_has_no_percentage(): void
    {
        $admin = $this->makeUserWithRole('admin');

        $response = $this->from(route('admin.coupons.create', [
            'locale' => 'pt',
        ]))->actingAs($admin)->post(route('admin.coupons.store', [
            'locale' => 'pt',
        ]), [
            'code' => 'BROKENPERC',
            'name' => 'Cupão inválido',
            'type' => 'percentage',
            'amount' => '',
            'percentage' => '',
            'minimum_subtotal_amount' => '10.00',
            'max_total_uses' => '',
            'max_uses_per_user' => '',
            'is_active' => true,
            'starts_at' => '',
            'ends_at' => '',
        ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('percentage');

        $this->assertDatabaseMissing('coupons', [
            'code' => 'BROKENPERC',
        ]);
    }

    public function test_admin_can_update_coupon(): void
    {
        $admin = $this->makeUserWithRole('admin');

        $coupon = Coupon::query()->create([
            'code' => 'SAVE20',
            'name' => 'Old name',
            'type' => 'fixed_amount',
            'amount' => 2000,
            'percentage' => null,
            'minimum_subtotal_amount' => 5000,
            'max_total_uses' => 10,
            'max_uses_per_user' => 1,
            'total_uses' => 0,
            'is_active' => true,
            'starts_at' => null,
            'ends_at' => null,
        ]);

        $response = $this->actingAs($admin)->put(route('admin.coupons.update', [
            'locale' => 'pt',
            'coupon' => $coupon->id,
        ]), [
            'code' => 'SAVE25',
            'name' => 'Updated name',
            'type' => 'fixed_amount',
            'amount' => '25.00',
            'percentage' => '',
            'minimum_subtotal_amount' => '40.00',
            'max_total_uses' => 50,
            'max_uses_per_user' => 3,
            'is_active' => true,
            'starts_at' => '',
            'ends_at' => '',
        ]);

        $response->assertRedirect(route('admin.coupons.index', [
            'locale' => 'pt',
        ]));

        $this->assertDatabaseHas('coupons', [
            'id' => $coupon->id,
            'code' => 'SAVE25',
            'name' => 'Updated name',
            'type' => 'fixed_amount',
            'amount' => 2500,
            'minimum_subtotal_amount' => 4000,
            'max_total_uses' => 50,
            'max_uses_per_user' => 3,
            'is_active' => 1,
        ]);
    }

    public function test_admin_can_toggle_coupon_active_state(): void
    {
        $admin = $this->makeUserWithRole('admin');

        $coupon = Coupon::query()->create([
            'code' => 'TOGGLE1',
            'name' => 'Toggle coupon',
            'type' => 'fixed_amount',
            'amount' => 500,
            'percentage' => null,
            'minimum_subtotal_amount' => 0,
            'max_total_uses' => null,
            'max_uses_per_user' => null,
            'total_uses' => 0,
            'is_active' => true,
            'starts_at' => null,
            'ends_at' => null,
        ]);

        $this->actingAs($admin)->patch(route('admin.coupons.toggle', [
            'locale' => 'pt',
            'coupon' => $coupon->id,
        ]))->assertRedirect();

        $this->assertDatabaseHas('coupons', [
            'id' => $coupon->id,
            'is_active' => 0,
        ]);

        $this->actingAs($admin)->patch(route('admin.coupons.toggle', [
            'locale' => 'pt',
            'coupon' => $coupon->id,
        ]))->assertRedirect();

        $this->assertDatabaseHas('coupons', [
            'id' => $coupon->id,
            'is_active' => 1,
        ]);
    }

    public function test_manager_cannot_access_admin_coupon_crud(): void
    {
        $manager = $this->makeUserWithRole('manager');

        $response = $this->actingAs($manager)->get(route('admin.coupons.index', [
            'locale' => 'pt',
        ]));

        $response->assertRedirect(route('fallback.page', [
            'locale' => 'pt',
        ]));
    }

    public function test_customer_cannot_access_admin_coupon_crud(): void
    {
        $customer = $this->makeUserWithRole('customer');

        $response = $this->actingAs($customer)->get(route('admin.coupons.index', [
            'locale' => 'pt',
        ]));

        $response->assertRedirect(route('fallback.page', [
            'locale' => 'pt',
        ]));
    }

    private function makeUserWithRole(string $role): User
    {
        return User::factory()->create([
            'role' => $role,
        ]);
    }
}

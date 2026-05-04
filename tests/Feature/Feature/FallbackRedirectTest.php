<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FallbackRedirectTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_without_admin_role_is_redirected_to_fallback_on_admin_route(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $response = $this->actingAs($user)
            ->get(route('admin.dashboard', ['locale' => 'pt']));

        $response->assertRedirect(route('fallback.page', ['locale' => 'pt']));
    }

    public function test_authenticated_user_is_redirected_to_fallback_when_order_is_not_found(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
        ]);

        $response = $this->actingAs($user)
            ->get(route('panel.orders.show', [
                'locale' => 'pt',
                'order' => 999999,
            ]));

        $response->assertRedirect(route('fallback.page', ['locale' => 'pt']));
    }
}

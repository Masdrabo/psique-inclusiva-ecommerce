<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderStatusService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class OrderStatusController extends Controller
{
    public function update(
        string $locale,
        Request $request,
        Order $order,
        OrderStatusService $orderStatusService
    ): RedirectResponse {
        $data = $request->validate([
            'status_code' => ['required', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        if (in_array($data['status_code'], ['partially_refunded', 'refunded'], true)) {
            return back()->withErrors([
                'status' => __('ui.refunds.errors.use_refund_flow'),
            ]);
        }

        try {
            $orderStatusService->transition(
                order: $order,
                toCode: $data['status_code'],
                changedByUserId: $request->user()?->id,
                notes: $data['notes'] ?? null,
                restoreInventoryOnCancel: true
            );
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        return back()->with('success', __('ui.orders.status_updated'));
    }
}

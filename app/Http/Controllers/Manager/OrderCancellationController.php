<?php

namespace App\Http\Controllers\Manager;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderStatusService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class OrderCancellationController extends Controller
{
    public function store(
        string $locale,
        Request $request,
        Order $order,
        OrderStatusService $orderStatusService
    ): RedirectResponse {
        try {
            $orderStatusService->transition(
                order: $order,
                toCode: 'cancelled',
                changedByUserId: $request->user()?->id,
                notes: 'Cancelada manualmente no backoffice.',
                restoreInventoryOnCancel: true
            );
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        return back()->with('success', 'Encomenda cancelada e stock reposto ✅');
    }
}

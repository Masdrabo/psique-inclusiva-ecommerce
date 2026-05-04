<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderStatusService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderShipmentController extends Controller
{
    public function update(
        string $locale,
        Request $request,
        Order $order,
        OrderStatusService $orderStatusService
    ): RedirectResponse {
        $order->load(['shipment', 'status']);

        abort_unless($order->shipment, 404, 'Shipment not found.');

        $data = $request->validate([
            'tracking_number' => ['nullable', 'string', 'max:120'],
            'status' => ['required', 'string', 'in:pending,shipped,delivered,returned,cancelled'],
        ]);

        $shipment = $order->shipment;
        $currentShipmentStatus = (string) $shipment->status;
        $nextShipmentStatus = (string) $data['status'];
        $currentOrderStatus = (string) ($order->status?->code ?? '');

        if ($currentOrderStatus === 'cancelled' && in_array($nextShipmentStatus, ['shipped', 'delivered'], true)) {
            return back()->withErrors([
                'shipment' => __('ui.shipments.errors.cannot_ship_cancelled_order'),
            ]);
        }

        if ($currentShipmentStatus === 'delivered' && $nextShipmentStatus !== 'delivered') {
            return back()->withErrors([
                'shipment' => __('ui.shipments.errors.cannot_regress_delivered'),
            ]);
        }

        if ($currentShipmentStatus === 'pending' && $nextShipmentStatus === 'delivered') {
            return back()->withErrors([
                'shipment' => __('ui.shipments.errors.delivered_requires_shipped'),
            ]);
        }

        try {
            DB::transaction(function () use (
                $request,
                $order,
                $shipment,
                $data,
                $nextShipmentStatus,
                $currentShipmentStatus,
                $currentOrderStatus,
                $orderStatusService
            ) {
                $trackingNumber = $data['tracking_number'] ?: null;

                $shipment->update([
                    'tracking_number' => $trackingNumber,
                ]);

                if ($nextShipmentStatus === $currentShipmentStatus) {
                    return;
                }

                if ($nextShipmentStatus === 'shipped') {
                    if ($currentOrderStatus !== 'shipped') {
                        $orderStatusService->transition(
                            order: $order,
                            toCode: 'shipped',
                            changedByUserId: $request->user()?->id,
                            notes: __('ui.shipments.notes.marked_as_shipped_manual'),
                            restoreInventoryOnCancel: false
                        );
                    } else {
                        $payload = ['status' => 'shipped'];

                        if (!$shipment->shipped_at) {
                            $payload['shipped_at'] = now();
                        }

                        $shipment->update($payload);
                    }

                    return;
                }

                if ($nextShipmentStatus === 'delivered') {
                    if ($currentOrderStatus !== 'delivered') {
                        $orderStatusService->transition(
                            order: $order,
                            toCode: 'delivered',
                            changedByUserId: $request->user()?->id,
                            notes: __('ui.shipments.notes.marked_as_delivered_manual'),
                            restoreInventoryOnCancel: false
                        );
                    } else {
                        $payload = ['status' => 'delivered'];

                        if (!$shipment->shipped_at) {
                            $payload['shipped_at'] = now();
                        }

                        if (!$shipment->delivered_at) {
                            $payload['delivered_at'] = now();
                        }

                        $shipment->update($payload);
                    }

                    return;
                }

                if ($nextShipmentStatus === 'pending') {
                    $shipment->update([
                        'status' => 'pending',
                        'shipped_at' => null,
                        'delivered_at' => null,
                    ]);

                    return;
                }

                if ($nextShipmentStatus === 'cancelled') {
                    $shipment->update([
                        'status' => 'cancelled',
                        'delivered_at' => null,
                    ]);

                    return;
                }

                if ($nextShipmentStatus === 'returned') {
                    $shipment->update([
                        'status' => 'returned',
                    ]);

                    return;
                }
            });
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        return back()->with('success', __('ui.shipments.updated_success'));
    }
}

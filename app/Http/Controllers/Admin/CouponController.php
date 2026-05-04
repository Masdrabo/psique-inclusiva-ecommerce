<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCouponRequest;
use App\Http\Requests\Admin\UpdateCouponRequest;
use App\Models\Coupon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CouponController extends Controller
{
    public function index(string $locale, Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', ''));

        $coupons = Coupon::query()
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($qq) use ($q) {
                    $qq->where('code', 'like', "%{$q}%")
                        ->orWhere('name', 'like', "%{$q}%");
                });
            })
            ->when($status !== '', function ($query) use ($status) {
                if ($status === 'active') {
                    $query->where('is_active', true);
                }

                if ($status === 'inactive') {
                    $query->where('is_active', false);
                }
            })
            ->latest('id')
            ->paginate(15)
            ->withQueryString()
            ->through(function (Coupon $coupon) {
                return [
                    'id' => $coupon->id,
                    'code' => $coupon->code,
                    'name' => $coupon->name,
                    'type' => $coupon->type,
                    'amount' => $coupon->amount !== null ? (int) $coupon->amount : null,
                    'percentage' => $coupon->percentage !== null ? (float) $coupon->percentage : null,
                    'minimum_subtotal_amount' => (int) $coupon->minimum_subtotal_amount,
                    'max_total_uses' => $coupon->max_total_uses !== null ? (int) $coupon->max_total_uses : null,
                    'max_uses_per_user' => $coupon->max_uses_per_user !== null ? (int) $coupon->max_uses_per_user : null,
                    'total_uses' => (int) $coupon->total_uses,
                    'is_active' => (bool) $coupon->is_active,
                    'starts_at' => optional($coupon->starts_at)->toISOString(),
                    'ends_at' => optional($coupon->ends_at)->toISOString(),
                    'created_at' => optional($coupon->created_at)->toISOString(),
                ];
            });

        return Inertia::render('Admin/Coupons/Index', [
            'coupons' => $coupons,
            'filters' => [
                'q' => $q,
                'status' => $status,
            ],
            'statusOptions' => [
                ['value' => '', 'label' => 'Todos'],
                ['value' => 'active', 'label' => 'Ativos'],
                ['value' => 'inactive', 'label' => 'Inativos'],
            ],
        ]);
    }

    public function create(string $locale): Response
    {
        return Inertia::render('Admin/Coupons/Create');
    }

    public function store(StoreCouponRequest $request, string $locale): RedirectResponse
    {
        Coupon::query()->create([
            'code' => strtoupper((string) $request->input('code')),
            'name' => (string) $request->input('name'),
            'type' => (string) $request->input('type'),
            'amount' => $request->filled('amount') ? (int) round(((float) $request->input('amount')) * 100) : null,
            'percentage' => $request->filled('percentage') ? round((float) $request->input('percentage'), 2) : null,
            'minimum_subtotal_amount' => $request->filled('minimum_subtotal_amount')
                ? (int) round(((float) $request->input('minimum_subtotal_amount')) * 100)
                : 0,
            'max_total_uses' => $request->filled('max_total_uses') ? (int) $request->input('max_total_uses') : null,
            'max_uses_per_user' => $request->filled('max_uses_per_user') ? (int) $request->input('max_uses_per_user') : null,
            'total_uses' => 0,
            'is_active' => (bool) $request->boolean('is_active', true),
            'starts_at' => $request->input('starts_at') ?: null,
            'ends_at' => $request->input('ends_at') ?: null,
        ]);

        return redirect()
            ->route('admin.coupons.index', ['locale' => $locale])
            ->with('success', __('ui.coupons.admin.created'));
    }

    public function edit(string $locale, Coupon $coupon): Response
    {
        return Inertia::render('Admin/Coupons/Edit', [
            'coupon' => [
                'id' => $coupon->id,
                'code' => $coupon->code,
                'name' => $coupon->name,
                'type' => $coupon->type,
                'amount' => $coupon->amount !== null ? number_format(((int) $coupon->amount) / 100, 2, '.', '') : '',
                'percentage' => $coupon->percentage !== null ? (string) $coupon->percentage : '',
                'minimum_subtotal_amount' => number_format(((int) $coupon->minimum_subtotal_amount) / 100, 2, '.', ''),
                'max_total_uses' => $coupon->max_total_uses,
                'max_uses_per_user' => $coupon->max_uses_per_user,
                'total_uses' => (int) $coupon->total_uses,
                'is_active' => (bool) $coupon->is_active,
                'starts_at' => optional($coupon->starts_at)?->format('Y-m-d\TH:i'),
                'ends_at' => optional($coupon->ends_at)?->format('Y-m-d\TH:i'),
            ],
        ]);
    }

    public function update(UpdateCouponRequest $request, string $locale, Coupon $coupon): RedirectResponse
    {
        $coupon->update([
            'code' => strtoupper((string) $request->input('code')),
            'name' => (string) $request->input('name'),
            'type' => (string) $request->input('type'),
            'amount' => $request->filled('amount') ? (int) round(((float) $request->input('amount')) * 100) : null,
            'percentage' => $request->filled('percentage') ? round((float) $request->input('percentage'), 2) : null,
            'minimum_subtotal_amount' => $request->filled('minimum_subtotal_amount')
                ? (int) round(((float) $request->input('minimum_subtotal_amount')) * 100)
                : 0,
            'max_total_uses' => $request->filled('max_total_uses') ? (int) $request->input('max_total_uses') : null,
            'max_uses_per_user' => $request->filled('max_uses_per_user') ? (int) $request->input('max_uses_per_user') : null,
            'is_active' => (bool) $request->boolean('is_active', true),
            'starts_at' => $request->input('starts_at') ?: null,
            'ends_at' => $request->input('ends_at') ?: null,
        ]);

        return redirect()
            ->route('admin.coupons.index', ['locale' => $locale])
            ->with('success', __('ui.coupons.admin.updated'));
    }

    public function toggle(string $locale, Coupon $coupon): RedirectResponse
    {
        $coupon->update([
            'is_active' => !$coupon->is_active,
        ]);

        return back()->with('success', __('ui.coupons.admin.toggled'));
    }
}

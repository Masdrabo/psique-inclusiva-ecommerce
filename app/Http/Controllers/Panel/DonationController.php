<?php

namespace App\Http\Controllers\Panel;

use App\Http\Controllers\Controller;
use App\Models\Donation;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DonationController extends Controller
{
    public function index(Request $request): Response
    {
        $donations = Donation::query()
            ->where('user_id', $request->user()->id)
            ->with(['paymentMethod', 'currency'])
            ->latest()
            ->paginate(10)
            ->through(fn (Donation $donation) => [
                'id' => $donation->id,
                'number' => $donation->donation_number,
                'amount' => (int) $donation->amount,
                'status' => $donation->status,
                'method' => [
                    'code' => $donation->paymentMethod?->code,
                    'name' => $donation->paymentMethod?->name,
                ],
                'created_at' => optional($donation->created_at)?->toISOString(),
                'paid_at' => optional($donation->paid_at)?->toISOString(),
                'public_token' => $donation->public_token,
            ]);

        return Inertia::render('Panel/Donations/Index', [
            'donations' => $donations,
        ]);
    }
}

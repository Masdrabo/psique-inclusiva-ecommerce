<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class EmailVerificationNotificationController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            $locale = $request->route('locale')
                ?? $request->cookie('locale')
                ?? config('app.fallback_locale', 'pt');

            return redirect()->intended(
                route('dashboard', ['locale' => $locale], absolute: false)
            );
        }

        $request->user()->sendEmailVerificationNotification();

        return back()->with('status', 'verification-link-sent');
    }
}

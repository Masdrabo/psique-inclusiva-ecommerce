<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class ConfirmablePasswordController extends Controller
{
    public function show(Request $request): Response
    {
        return Inertia::render('Auth/ConfirmPassword');
    }

    public function store(Request $request): RedirectResponse
    {
        if (! Auth::guard('web')->validate([
            'email' => $request->user()->email,
            'password' => $request->password,
        ])) {
            return back()->withErrors([
                'password' => __('auth.password'),
            ]);
        }

        $request->session()->put('auth.password_confirmed_at', time());

        $locale = $request->route('locale')
            ?? $request->cookie('locale')
            ?? config('app.fallback_locale', 'pt');

        return redirect()->intended(
            route('dashboard', ['locale' => $locale], absolute: false)
        );
    }
}

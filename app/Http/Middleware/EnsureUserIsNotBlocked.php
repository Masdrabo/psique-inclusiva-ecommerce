<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsNotBlocked
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return $next($request);
        }

        $user->syncStatusIfSuspensionExpired();

        if (!$user->isBlocked()) {
            return $next($request);
        }

        $message = $user->isBanned()
            ? trans('auth.account_banned')
            : trans('auth.account_suspended', [
                'until' => $user->suspensionEndsAtForHumans(trans('auth.suspension_until_manual_unlock')),
            ]);

        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $locale = $request->route('locale')
            ?? $request->cookie('locale')
            ?? config('app.fallback_locale', 'pt');

        return redirect()
            ->route('login', ['locale' => $locale])
            ->with('error', $message);
    }
}

<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RedirectIfAuthenticatedLocale
{
    public function handle(Request $request, Closure $next, ...$guards)
    {
        foreach ($guards as $guard) {

            if (Auth::guard($guard)->check()) {

                $locale = $request->route('locale')
                    ?? $request->cookie('locale')
                    ?? config('app.fallback_locale', 'pt');

                return redirect()->route('dashboard', ['locale' => $locale]);
            }
        }

        return $next($request);
    }
}

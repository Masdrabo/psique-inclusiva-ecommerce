<?php

namespace App\Providers;

use App\Models\Category;
use Illuminate\Auth\Middleware\RedirectIfAuthenticated;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Gate;
use App\Models\Order;
use App\Policies\OrderPolicy;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Força URLs HTTPS
        if (app()->environment('production') || request()->getScheme() === 'https') {
        URL::forceScheme('https');
        }
    // ✅ performance
        Vite::prefetch(concurrency: 3);

        $locale = $this->resolveLocale(request());

        // ✅ garante que route() gera URLs com {locale} por default
        URL::defaults([
            'locale' => $locale,
        ]);

        // ✅ garante traduções / notifications no locale certo
        App::setLocale($locale);

        Gate::policy(Order::class, OrderPolicy::class);

        // ✅ Corrige redirect quando user autenticado tenta aceder a rotas "guest"
        RedirectIfAuthenticated::redirectUsing(function (Request $request) {
            $locale = $this->resolveLocale($request);

            return route('dashboard', ['locale' => $locale]);
        });
    }

    /**
     * Resolve o locale atual a partir da rota/cookie/config.
     */
    private function resolveLocale(Request $request): string
    {
        $supported = config('app.supported_locales', ['pt', 'en']);
        $fallback  = config('app.fallback_locale', 'pt');

        $locale = $request->route('locale')
            ?? $request->cookie('locale')
            ?? $fallback;

        // normaliza (ex: "pt-PT" -> "pt")
        $locale = strtolower(substr((string) $locale, 0, 2));

        return in_array($locale, $supported, true) ? $locale : $fallback;
    }
}

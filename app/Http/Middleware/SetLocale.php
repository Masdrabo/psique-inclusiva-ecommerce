<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Config;

class SetLocale
{
    public function handle(Request $request, Closure $next)
    {
        // línguas suportadas vindas do config/app.php
        $supported = Config::get('app.supported_locales', ['pt']);

        // locale vindo da rota /{locale}
        $locale = $request->route('locale');

        // valida se existe
        if (! in_array($locale, $supported, true)) {
            $locale = Config::get('app.fallback_locale', 'pt');
        }

        // define locale do Laravel
        App::setLocale($locale);

        // guarda cookie (para lembrar escolha)
        cookie()->queue(cookie('locale', $locale, 60*24*365));

        return $next($request);
    }
}

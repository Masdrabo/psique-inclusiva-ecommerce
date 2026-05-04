<?php

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
            \App\Http\Middleware\EnsureUserIsNotBlocked::class,
        ]);

        $middleware->validateCsrfTokens(except: [
            'payments/ifthenpay/callback',
        ]);

        $middleware->alias([
            'auth' => \App\Http\Middleware\Authenticate::class,
            'setlocale' => \App\Http\Middleware\SetLocale::class,
            'guest.locale' => \App\Http\Middleware\RedirectIfAuthenticatedLocale::class,
            'role' => \App\Http\Middleware\RoleMiddleware::class,
            'slug.redirect' => \App\Http\Middleware\ResolveSlugRedirect::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Throwable $e, $request) {
            if (!$request) {
                return null;
            }

            if ($request->expectsJson()) {
                return null;
            }

            if ($e instanceof AuthenticationException) {
                return null;
            }

            $shouldRedirectToFallback =
                $e instanceof AuthorizationException ||
                $e instanceof ModelNotFoundException ||
                $e instanceof NotFoundHttpException ||
                ($e instanceof HttpExceptionInterface && in_array($e->getStatusCode(), [403, 404], true));

            if (!$shouldRedirectToFallback) {
                return null;
            }

            if ($request->routeIs('fallback.page')) {
                return null;
            }

            $supported = config('app.supported_locales', ['pt', 'en']);
            $fallback = config('app.fallback_locale', 'pt');

            $locale = $request->route('locale')
                ?? $request->cookie('locale')
                ?? $fallback;

            $locale = strtolower(substr((string) $locale, 0, 2));

            if (!in_array($locale, $supported, true)) {
                $locale = $fallback;
            }

            return redirect()->route('fallback.page', [
                'locale' => $locale,
            ]);
        });
    })
    ->create();

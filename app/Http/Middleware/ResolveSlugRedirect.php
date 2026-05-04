<?php

namespace App\Http\Middleware;

use App\Models\Category;
use App\Models\Product;
use App\Models\SlugRedirect;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ResolveSlugRedirect
{
    /**
     * Uso:
     *  ->middleware('slug.redirect:category,category')
     *  ->middleware('slug.redirect:product,product')
     *
     * Arg1: entity ("category" | "product")
     * Arg2: route param name (ex: "category" ou "product")
     */
    public function handle(Request $request, Closure $next, string $entity, string $paramName): mixed
    {
        $paramValue = $request->route($paramName);

        // se já foi resolvido para Model (route model binding), segue
        if (is_object($paramValue)) {
            return $next($request);
        }

        $slug = is_string($paramValue) ? $paramValue : null;
        if (!$slug) {
            return $next($request);
        }

        $type = match ($entity) {
            'category' => Category::class,
            'product' => Product::class,
            default => null,
        };

        if (!$type) {
            return $next($request);
        }

        $redirect = SlugRedirect::query()
            ->where('redirectable_type', $type)
            ->where('old_slug', $slug)
            ->first();

        if (!$redirect) {
            return $next($request);
        }

        // tenta obter o slug atual do registo (se já não existir, não redireciona)
        $model = $type::query()->find($redirect->redirectable_id);
        if (!$model) {
            return $next($request);
        }

        $route = $request->route();
        $routeName = $route?->getName();

        // se não houver route name, fallback simples (não arrisco replace de string)
        if (!$routeName) {
            return $next($request);
        }

        $params = $route->parameters();
        $params[$paramName] = $model->slug;

        // mantém query string
        $url = route($routeName, $params);
        $query = $request->getQueryString();
        if ($query) {
            $url .= (str_contains($url, '?') ? '&' : '?') . $query;
        }

        return redirect()->to($url, (int) ($redirect->http_code ?? 301));
    }
}

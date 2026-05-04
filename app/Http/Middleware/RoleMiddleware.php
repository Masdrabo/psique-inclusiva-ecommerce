<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Uso:
     *  ->middleware('role:admin')
     *  ->middleware('role:admin,manager')
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = $request->user();

        // Precisa estar autenticado para ter role
        if (!$user) {
            // Isto deixa o middleware 'auth' tratar do redirect para login
            abort(401);
        }

        $userRole = $user->role ?? null;

        if (!$userRole) {
            abort(403);
        }

        // Normaliza roles passadas (trim + lowercase)
        $allowed = array_map(
            fn ($r) => strtolower(trim($r)),
            $roles
        );

        if (!in_array(strtolower($userRole), $allowed, true)) {
            abort(403);
        }

        return $next($request);
    }
}

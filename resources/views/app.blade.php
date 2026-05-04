<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title inertia>{{ config('app.name', 'Psique Inclusiva') }}</title>

        <meta name="application-name" content="Psique Inclusiva">
        <meta name="apple-mobile-web-app-title" content="Psique Inclusiva">
        <meta name="description" content="Psique Inclusiva — loja, eventos, workshops e serviços digitais.">

        <link rel="icon" type="image/x-icon" href="/icon.ico">

        <meta name="csrf-token" content="{{ csrf_token() }}">

        {{-- Open Graph defaults --}}
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="Psique Inclusiva">
        <meta property="og:title" content="Psique Inclusiva">
        <meta property="og:description" content="Psique Inclusiva — loja, eventos, workshops e serviços digitais.">
        <meta property="og:image" content="{{ asset('og-default.jpg') }}">
        <meta property="og:url" content="{{ url()->current() }}">

        {{-- Twitter card defaults --}}
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="Psique Inclusiva">
        <meta name="twitter:description" content="Psique Inclusiva — loja, eventos, workshops e serviços digitais.">
        <meta name="twitter:image" content="{{ asset('og-default.jpg') }}">

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />

        @routes
        @if (app()->environment('local'))
        @viteReactRefresh
        @vite([
            'resources/js/app.jsx',
            "resources/js/Pages/{$page['component']}.jsx"
        ])
        @else
        @vite([
        'resources/js/app.jsx',
        "resources/js/Pages/{$page['component']}.jsx"
        ], 'build')
        @endif
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>

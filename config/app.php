<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Application Name
    |--------------------------------------------------------------------------
    */

    'name' => env('APP_NAME', 'Laravel'),

    /*
    |--------------------------------------------------------------------------
    | Application Environment
    |--------------------------------------------------------------------------
    */

    'env' => env('APP_ENV', 'production'),

    /*
    |--------------------------------------------------------------------------
    | Debug Mode
    |--------------------------------------------------------------------------
    */

    'debug' => (bool) env('APP_DEBUG', false),

    /*
    |--------------------------------------------------------------------------
    | Application URL
    |--------------------------------------------------------------------------
    */

    'url' => env('APP_URL', 'http://localhost'),

    /*
    |--------------------------------------------------------------------------
    | Timezone
    |--------------------------------------------------------------------------
    | Para Portugal recomenda-se Europe/Lisbon
    */

    'timezone' => env('APP_TIMEZONE', 'Europe/Lisbon'),

    /*
    |--------------------------------------------------------------------------
    | Locale Configuration (MULTI-LINGUA PROFISSIONAL)
    |--------------------------------------------------------------------------
    */

    // idioma default (usado apenas se middleware não definir)
    'locale' => env('APP_LOCALE', 'pt'),

    // fallback se tradução não existir
    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'en'),

    // lista oficial de idiomas suportados
    'supported_locales' => [
        'pt',
        'en',
    ],

    // faker locale para seeders/tests
    'faker_locale' => env('APP_FAKER_LOCALE', 'pt_PT'),

    /*
    |--------------------------------------------------------------------------
    | Encryption Key
    |--------------------------------------------------------------------------
    */

    'cipher' => 'AES-256-CBC',

    'key' => env('APP_KEY'),

    'previous_keys' => [
        ...array_filter(
            explode(',', (string) env('APP_PREVIOUS_KEYS', ''))
        ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Maintenance Mode
    |--------------------------------------------------------------------------
    */

    'maintenance' => [
        'driver' => env('APP_MAINTENANCE_DRIVER', 'file'),
        'store' => env('APP_MAINTENANCE_STORE', 'database'),
    ],

];

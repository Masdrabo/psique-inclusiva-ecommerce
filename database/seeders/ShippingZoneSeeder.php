<?php

namespace Database\Seeders;

use App\Models\ShippingZone;
use Illuminate\Database\Seeder;

class ShippingZoneSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $zones = [
            [
                'code' => 'PT_CONTINENTAL',
                'name' => 'Portugal Continental',
                'country_code' => 'PT',
                'is_active' => true,
                'priority' => 1,
            ],
            [
                'code' => 'PT_MADEIRA',
                'name' => 'Madeira',
                'country_code' => 'PT',
                'is_active' => true,
                'priority' => 2,
            ],
            [
                'code' => 'PT_ACORES',
                'name' => 'Açores',
                'country_code' => 'PT',
                'is_active' => true,
                'priority' => 3,
            ],
            [
                'code' => 'ES_PENINSULAR',
                'name' => 'Espanha Peninsular',
                'country_code' => 'ES',
                'is_active' => true,
                'priority' => 4,
            ],
            [
                'code' => 'ES_BALEARES',
                'name' => 'Baleares',
                'country_code' => 'ES',
                'is_active' => true,
                'priority' => 5,
            ],
        ];

        foreach ($zones as $zone) {
            ShippingZone::query()->updateOrCreate(
                ['code' => $zone['code']],
                [
                    'name' => $zone['name'],
                    'country_code' => $zone['country_code'],
                    'is_active' => $zone['is_active'],
                    'priority' => $zone['priority'],
                ]
            );
        }
    }
}

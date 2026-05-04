<?php

namespace Database\Seeders;

use App\Models\ShippingMethod;
use App\Models\ShippingRate;
use App\Models\ShippingZone;
use Illuminate\Database\Seeder;

class ShippingRateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $standardMethod = ShippingMethod::query()
            ->where('code', 'standard')
            ->first();

        if (! $standardMethod) {
            throw new \RuntimeException('Shipping method "standard" não encontrada.');
        }

        $zones = ShippingZone::query()
            ->whereIn('code', [
                'PT_CONTINENTAL',
                'PT_MADEIRA',
                'PT_ACORES',
                'ES_PENINSULAR',
                'ES_BALEARES',
            ])
            ->get()
            ->keyBy('code');

        $rates = [
            'PT_CONTINENTAL' => [
                [0, 500, 530, 2, 5],
                [501, 2000, 530, 2, 5],
                [2001, 5000, 686, 2, 5],
                [5001, 10000, 888, 2, 5],
                [10001, 20000, 1104, 2, 5],
                [20001, 30000, 1399, 2, 5],
            ],
            'PT_MADEIRA' => [
                [0, 500, 1252, 3, 5],
                [501, 2000, 1571, 3, 5],
                [2001, 5000, 1771, 3, 5],
                [5001, 10000, 2624, 3, 5],
                [10001, 20000, 3652, 3, 5],
                [20001, 30000, 5386, 3, 5],
            ],
            'PT_ACORES' => [
                [0, 500, 1252, 3, 5],
                [501, 2000, 1571, 3, 5],
                [2001, 5000, 1771, 3, 5],
                [5001, 10000, 2624, 3, 5],
                [10001, 20000, 3652, 3, 5],
                [20001, 30000, 5386, 3, 5],
            ],
            'ES_PENINSULAR' => [
                [0, 500, 536, 3, 5],
                [501, 2000, 559, 3, 5],
                [2001, 5000, 639, 3, 5],
                [5001, 10000, 792, 3, 5],
                [10001, 20000, 1075, 3, 5],
                [20001, 30000, 1500, 3, 5],
            ],
            'ES_BALEARES' => [
                [0, 500, 4463, 3, 5],
                [501, 2000, 4472, 3, 5],
                [2001, 5000, 4499, 3, 5],
                [5001, 10000, 4559, 3, 5],
                [10001, 20000, 5715, 3, 5],
                [20001, 30000, 7234, 3, 5],
            ],
        ];

        foreach ($rates as $zoneCode => $zoneRates) {
            $zone = $zones->get($zoneCode);

            if (! $zone) {
                throw new \RuntimeException("Shipping zone '{$zoneCode}' não encontrada.");
            }

            foreach ($zoneRates as [$minWeight, $maxWeight, $priceCents, $daysMin, $daysMax]) {
                ShippingRate::query()->updateOrCreate(
                    [
                        'shipping_zone_id' => $zone->id,
                        'shipping_method_id' => $standardMethod->id,
                        'shipping_profile' => 'standard',
                        'min_weight_grams' => $minWeight,
                        'max_weight_grams' => $maxWeight,
                    ],
                    [
                        'price_cents' => $priceCents,
                        'estimated_days_min' => $daysMin,
                        'estimated_days_max' => $daysMax,
                        'is_active' => true,
                    ]
                );
            }
        }
    }
}

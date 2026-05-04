<?php

namespace App\Services\Shipping;

use App\Models\ShippingRate;
use App\Models\ShippingZone;

class ShippingRateCalculatorService
{
    /**
     * Verifica se o carrinho tem pelo menos um item físico.
     */
    public function cartRequiresShipping(iterable $items): bool
    {
        foreach ($items as $item) {
            $product = $item->product ?? null;

            if (! $product) {
                continue;
            }

            if ((bool) ($product->requires_shipping ?? false) === true) {
                return true;
            }
        }

        return false;
    }

    /**
     * Soma o peso total do carrinho em gramas.
     */
    public function calculateWeightGrams(iterable $items): int
    {
        $totalWeight = 0;

        foreach ($items as $item) {
            $product = $item->product ?? null;

            if (! $product) {
                continue;
            }

            if (! (bool) ($product->requires_shipping ?? false)) {
                continue;
            }

            $weightGrams = (int) ($product->weight_grams ?? 0);
            $quantity = (int) ($item->qty ?? 1);

            $totalWeight += max(0, $weightGrams) * max(1, $quantity);
        }

        return $totalWeight;
    }

    /**
     * Resolve a zona por código explícito.
     */
    public function resolveZoneByCode(string $shippingZoneCode): ?ShippingZone
    {
        return ShippingZone::query()
            ->where('code', strtoupper(trim($shippingZoneCode)))
            ->where('is_active', true)
            ->first();
    }

    /**
     * Mantido por compatibilidade. Pode continuar útil no futuro.
     */
    public function resolveZone(string $countryCode, ?string $postalCode = null): ?ShippingZone
    {
        $countryCode = strtoupper(trim($countryCode));
        $normalizedPostalCode = $this->normalizePostalCode($postalCode);

        if ($countryCode === 'PT') {
            if ($this->isAcoresPostalCode($normalizedPostalCode)) {
                return ShippingZone::query()
                    ->where('code', 'PT_ACORES')
                    ->where('is_active', true)
                    ->first();
            }

            if ($this->isMadeiraPostalCode($normalizedPostalCode)) {
                return ShippingZone::query()
                    ->where('code', 'PT_MADEIRA')
                    ->where('is_active', true)
                    ->first();
            }

            return ShippingZone::query()
                ->where('code', 'PT_CONTINENTAL')
                ->where('is_active', true)
                ->first();
        }

        if ($countryCode === 'ES') {
            if ($this->isSpainOtherDestinationsPostalCode($normalizedPostalCode)) {
                return ShippingZone::query()
                    ->where('code', 'ES_OUTROS')
                    ->where('is_active', true)
                    ->first();
            }

            return ShippingZone::query()
                ->where('code', 'ES_PENINSULA')
                ->where('is_active', true)
                ->first();
        }

        return null;
    }

    /**
     * Procura a tarifa aplicável.
     */
    public function findApplicableRate(
        int $shippingZoneId,
        int $shippingMethodId,
        int $weightGrams,
        string $shippingProfile = 'standard'
    ): ?ShippingRate {
        return ShippingRate::query()
            ->where('shipping_zone_id', $shippingZoneId)
            ->where('shipping_method_id', $shippingMethodId)
            ->where('shipping_profile', $shippingProfile)
            ->where('is_active', true)
            ->where('min_weight_grams', '<=', $weightGrams)
            ->where('max_weight_grams', '>=', $weightGrams)
            ->orderBy('min_weight_grams')
            ->first();
    }

    /**
     * Cotação por zona explícita.
     */
    public function quoteForZone(
        iterable $items,
        string $shippingZoneCode,
        int $shippingMethodId,
        string $shippingProfile = 'standard'
    ): array {
        if (! $this->cartRequiresShipping($items)) {
            return [
                'requires_shipping' => false,
                'shipping_zone_id' => null,
                'shipping_zone_code' => null,
                'shipping_method_id' => $shippingMethodId,
                'shipping_profile' => $shippingProfile,
                'weight_grams' => 0,
                'price_cents' => 0,
                'estimated_days_min' => null,
                'estimated_days_max' => null,
                'error' => null,
            ];
        }

        $weightGrams = $this->calculateWeightGrams($items);

        if ($weightGrams <= 0) {
            return [
                'requires_shipping' => true,
                'shipping_zone_id' => null,
                'shipping_zone_code' => strtoupper(trim($shippingZoneCode)),
                'shipping_method_id' => $shippingMethodId,
                'shipping_profile' => $shippingProfile,
                'weight_grams' => 0,
                'price_cents' => null,
                'estimated_days_min' => null,
                'estimated_days_max' => null,
                'error' => 'invalid_weight',
            ];
        }

        if ($weightGrams > 30000) {
            return [
                'requires_shipping' => true,
                'shipping_zone_id' => null,
                'shipping_zone_code' => strtoupper(trim($shippingZoneCode)),
                'shipping_method_id' => $shippingMethodId,
                'shipping_profile' => $shippingProfile,
                'weight_grams' => $weightGrams,
                'price_cents' => null,
                'estimated_days_min' => null,
                'estimated_days_max' => null,
                'error' => 'weight_limit_exceeded',
            ];
        }

        $zone = $this->resolveZoneByCode($shippingZoneCode);

        if (! $zone) {
            return [
                'requires_shipping' => true,
                'shipping_zone_id' => null,
                'shipping_zone_code' => strtoupper(trim($shippingZoneCode)),
                'shipping_method_id' => $shippingMethodId,
                'shipping_profile' => $shippingProfile,
                'weight_grams' => $weightGrams,
                'price_cents' => null,
                'estimated_days_min' => null,
                'estimated_days_max' => null,
                'error' => 'zone_not_found',
            ];
        }

        $rate = $this->findApplicableRate(
            $zone->id,
            $shippingMethodId,
            $weightGrams,
            $shippingProfile
        );

        if (! $rate) {
            return [
                'requires_shipping' => true,
                'shipping_zone_id' => $zone->id,
                'shipping_zone_code' => $zone->code,
                'shipping_method_id' => $shippingMethodId,
                'shipping_profile' => $shippingProfile,
                'weight_grams' => $weightGrams,
                'price_cents' => null,
                'estimated_days_min' => null,
                'estimated_days_max' => null,
                'error' => 'rate_not_found',
            ];
        }

        return [
            'requires_shipping' => true,
            'shipping_zone_id' => $zone->id,
            'shipping_zone_code' => $zone->code,
            'shipping_method_id' => $shippingMethodId,
            'shipping_profile' => $shippingProfile,
            'weight_grams' => $weightGrams,
            'price_cents' => (int) $rate->price_cents,
            'estimated_days_min' => $rate->estimated_days_min,
            'estimated_days_max' => $rate->estimated_days_max,
            'error' => null,
        ];
    }

    /**
     * Mantido por compatibilidade.
     */
    public function quote(
        iterable $items,
        string $countryCode,
        ?string $postalCode,
        int $shippingMethodId,
        string $shippingProfile = 'standard'
    ): array {
        if (! $this->cartRequiresShipping($items)) {
            return [
                'requires_shipping' => false,
                'shipping_zone_id' => null,
                'shipping_zone_code' => null,
                'shipping_method_id' => $shippingMethodId,
                'shipping_profile' => $shippingProfile,
                'weight_grams' => 0,
                'price_cents' => 0,
                'estimated_days_min' => null,
                'estimated_days_max' => null,
                'error' => null,
            ];
        }

        $weightGrams = $this->calculateWeightGrams($items);

        if ($weightGrams <= 0) {
            return [
                'requires_shipping' => true,
                'shipping_zone_id' => null,
                'shipping_zone_code' => null,
                'shipping_method_id' => $shippingMethodId,
                'shipping_profile' => $shippingProfile,
                'weight_grams' => 0,
                'price_cents' => null,
                'estimated_days_min' => null,
                'estimated_days_max' => null,
                'error' => 'invalid_weight',
            ];
        }

        if ($weightGrams > 30000) {
            return [
                'requires_shipping' => true,
                'shipping_zone_id' => null,
                'shipping_zone_code' => null,
                'shipping_method_id' => $shippingMethodId,
                'shipping_profile' => $shippingProfile,
                'weight_grams' => $weightGrams,
                'price_cents' => null,
                'estimated_days_min' => null,
                'estimated_days_max' => null,
                'error' => 'weight_limit_exceeded',
            ];
        }

        $zone = $this->resolveZone($countryCode, $postalCode);

        if (! $zone) {
            return [
                'requires_shipping' => true,
                'shipping_zone_id' => null,
                'shipping_zone_code' => null,
                'shipping_method_id' => $shippingMethodId,
                'shipping_profile' => $shippingProfile,
                'weight_grams' => $weightGrams,
                'price_cents' => null,
                'estimated_days_min' => null,
                'estimated_days_max' => null,
                'error' => 'zone_not_found',
            ];
        }

        $rate = $this->findApplicableRate(
            $zone->id,
            $shippingMethodId,
            $weightGrams,
            $shippingProfile
        );

        if (! $rate) {
            return [
                'requires_shipping' => true,
                'shipping_zone_id' => $zone->id,
                'shipping_zone_code' => $zone->code,
                'shipping_method_id' => $shippingMethodId,
                'shipping_profile' => $shippingProfile,
                'weight_grams' => $weightGrams,
                'price_cents' => null,
                'estimated_days_min' => null,
                'estimated_days_max' => null,
                'error' => 'rate_not_found',
            ];
        }

        return [
            'requires_shipping' => true,
            'shipping_zone_id' => $zone->id,
            'shipping_zone_code' => $zone->code,
            'shipping_method_id' => $shippingMethodId,
            'shipping_profile' => $shippingProfile,
            'weight_grams' => $weightGrams,
            'price_cents' => (int) $rate->price_cents,
            'estimated_days_min' => $rate->estimated_days_min,
            'estimated_days_max' => $rate->estimated_days_max,
            'error' => null,
        ];
    }

    private function normalizePostalCode(?string $postalCode): string
    {
        if (! $postalCode) {
            return '';
        }

        return preg_replace('/[^A-Za-z0-9]/', '', strtoupper($postalCode)) ?? '';
    }

    private function isAcoresPostalCode(string $postalCode): bool
    {
        return preg_match('/^(95|96|97|98|99)/', $postalCode) === 1;
    }

    private function isMadeiraPostalCode(string $postalCode): bool
    {
        return preg_match('/^(90|91|92|93|94)/', $postalCode) === 1;
    }

    private function isSpainOtherDestinationsPostalCode(string $postalCode): bool
    {
        return preg_match('/^07/', $postalCode) === 1;
    }
}

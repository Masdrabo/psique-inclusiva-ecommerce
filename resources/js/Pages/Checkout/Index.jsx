import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';

function formatMoney(cents, currency) {
    const dp = currency?.decimal_places ?? 2;
    const symbol = currency?.symbol ?? '€';
    const value = (Number(cents || 0) / Math.pow(10, dp)).toFixed(dp);
    return `${value} ${symbol}`;
}

function FieldError({ error }) {
    if (!error) return null;
    return <div className="mt-1 text-sm text-red-600">{error}</div>;
}

function InfoBox({ children }) {
    return (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {children}
        </div>
    );
}

function AlertBox({ children }) {
    return (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {children}
        </div>
    );
}

function TrustBox({ t, requiresShipping }) {
    return (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-700">
            <div className="font-semibold text-gray-900">
                {t('ui.checkout.trust_title', 'Compra com confiança')}
            </div>

            <ul className="mt-2 space-y-1">
                <li>
                    {t(
                        'ui.checkout.trust_confirmation_email',
                        'Vais receber um email de confirmação após criares a encomenda.'
                    )}
                </li>
                <li>
                    {t(
                        'ui.checkout.trust_panel_tracking',
                        'Podes acompanhar o estado da encomenda no teu painel.'
                    )}
                </li>
                <li>
                    {requiresShipping
                        ? t(
                            'ui.checkout.trust_returns_shipping',
                            'Quando aplicável, tens 14 dias para devolução após a entrega.'
                        )
                        : t(
                            'ui.checkout.trust_digital_note',
                            'Os detalhes do pedido ficam disponíveis no teu painel após confirmação.'
                        )}
                </li>
            </ul>
        </div>
    );
}

export default function CheckoutIndex() {
    const {
        locale,
        cart,
        items,
        totals,
        currency,
        appliedCoupon,
        shippingMethods,
        shippingZones,
        paymentMethods,
        defaults,
        checkout_rules,
    } = usePage().props;

    const { t } = useI18n();

    const [shippingQuote, setShippingQuote] = useState(null);
    const [lastValidShippingQuote, setLastValidShippingQuote] = useState(null);
    const [lastValidQuoteKey, setLastValidQuoteKey] = useState(null);
    const [shippingQuoteLoading, setShippingQuoteLoading] = useState(false);
    const [shippingQuoteError, setShippingQuoteError] = useState(null);

    const requiresShipping = !!checkout_rules?.requires_shipping;
    const pricesIncludeTax = !!checkout_rules?.prices_include_tax;
    const shippingMethodsList = Array.isArray(shippingMethods) ? shippingMethods : [];
    const shippingZonesList = Array.isArray(shippingZones) ? shippingZones : [];
    const paymentMethodsList = Array.isArray(paymentMethods) ? paymentMethods : [];

    const availableCountryOptions = [
        { code: 'PT', label: 'Portugal' },
        { code: 'ES', label: 'España' },
    ];

    const shippingDefaults = useMemo(
        () => ({
            name: defaults?.shipping?.name ?? '',
            line1: defaults?.shipping?.line1 ?? '',
            line2: defaults?.shipping?.line2 ?? '',
            city: defaults?.shipping?.city ?? '',
            postal_code: defaults?.shipping?.postal_code ?? '',
            region: defaults?.shipping?.region ?? '',
            country_code: defaults?.shipping?.country_code ?? 'PT',
            shipping_zone_code: defaults?.shipping?.shipping_zone_code ?? '',
        }),
        [defaults?.shipping]
    );

    const billingDefaults = useMemo(
        () => ({
            name: defaults?.billing?.name ?? '',
            line1: defaults?.billing?.line1 ?? '',
            line2: defaults?.billing?.line2 ?? '',
            city: defaults?.billing?.city ?? '',
            postal_code: defaults?.billing?.postal_code ?? '',
            region: defaults?.billing?.region ?? '',
            country_code: defaults?.billing?.country_code ?? 'PT',
        }),
        [defaults?.billing]
    );

    const initialBillingSameAsShipping = useMemo(() => {
        if (!requiresShipping) return false;

        return JSON.stringify({
            name: shippingDefaults.name,
            line1: shippingDefaults.line1,
            line2: shippingDefaults.line2,
            city: shippingDefaults.city,
            postal_code: shippingDefaults.postal_code,
            region: shippingDefaults.region,
            country_code: shippingDefaults.country_code,
        }) === JSON.stringify(billingDefaults);
    }, [requiresShipping, shippingDefaults, billingDefaults]);

    const {
        data,
        setData,
        post,
        processing,
        errors,
    } = useForm({
        checkout_token: defaults?.checkout_token ?? '',

        phone: defaults?.customer?.phone ?? '',
        vat_number: defaults?.customer?.vat_number ?? '',
        company_name: defaults?.customer?.company_name ?? '',

        billing_same_as_shipping: initialBillingSameAsShipping,

        shipping: shippingDefaults,
        billing: billingDefaults,

        shipping_method_id: requiresShipping ? String(shippingMethodsList?.[0]?.id ?? '') : '',
        payment_method_id: String(paymentMethodsList?.[0]?.id ?? ''),

        accept_legal: false,
    });

    const couponForm = useForm({
        coupon_code: '',
    });

    useEffect(() => {
        if (!requiresShipping || !data.billing_same_as_shipping) {
            return;
        }

        const shippingComparable = {
            name: data.shipping.name,
            line1: data.shipping.line1,
            line2: data.shipping.line2,
            city: data.shipping.city,
            postal_code: data.shipping.postal_code,
            region: data.shipping.region,
            country_code: data.shipping.country_code,
        };

        const shippingJson = JSON.stringify(shippingComparable);
        const billingJson = JSON.stringify(data.billing);

        if (shippingJson !== billingJson) {
            setData('billing', { ...shippingComparable });
        }
    }, [requiresShipping, data.billing_same_as_shipping, data.shipping, data.billing, setData]);

    const itemCount = useMemo(
        () => (items ?? []).reduce((sum, item) => sum + Number(item.qty || 0), 0),
        [items]
    );

    const selectedShippingMethod = useMemo(
        () =>
            shippingMethodsList.find((method) => String(method.id) === String(data.shipping_method_id)) ?? null,
        [shippingMethodsList, data.shipping_method_id]
    );

    const isPickupSelected = String(selectedShippingMethod?.code || '') === 'pickup';

    const filteredShippingZones = useMemo(() => {
        const countryCode = String(data.shipping?.country_code || '').trim().toUpperCase();

        if (!countryCode) {
            return [];
        }

        return shippingZonesList.filter(
            (zone) => String(zone.country_code || '').trim().toUpperCase() === countryCode
        );
    }, [shippingZonesList, data.shipping?.country_code]);

    const selectedShippingZone = useMemo(
        () =>
            filteredShippingZones.find(
                (zone) => String(zone.code) === String(data.shipping?.shipping_zone_code || '')
            ) ?? null,
        [filteredShippingZones, data.shipping?.shipping_zone_code]
    );

    const currentQuoteKey = useMemo(() => {
        const zoneCode = String(data.shipping?.shipping_zone_code || '').trim();
        const methodCode = String(selectedShippingMethod?.code || '').trim();

        if (!zoneCode || !methodCode) {
            return null;
        }

        return `${zoneCode}::${methodCode}`;
    }, [data.shipping?.shipping_zone_code, selectedShippingMethod?.code]);

    useEffect(() => {
        if (!requiresShipping || isPickupSelected) {
            return;
        }

        const currentZoneCode = String(data.shipping?.shipping_zone_code || '');

        if (filteredShippingZones.length === 0) {
            if (currentZoneCode) {
                setData('shipping', {
                    ...data.shipping,
                    shipping_zone_code: '',
                });
            }
            return;
        }

        const currentZoneIsValid = filteredShippingZones.some(
            (zone) => String(zone.code) === currentZoneCode
        );

        if (!currentZoneIsValid) {
            setData('shipping', {
                ...data.shipping,
                shipping_zone_code: String(filteredShippingZones[0].code),
            });
        }
    }, [
        requiresShipping,
        isPickupSelected,
        filteredShippingZones,
        data.shipping,
        data.shipping?.shipping_zone_code,
        setData,
    ]);

    const hasResolvedShippingQuote =
        requiresShipping &&
        shippingQuote &&
        shippingQuote.error === null &&
        shippingQuote.price_cents !== null &&
        shippingQuote.price_cents !== undefined;

    const effectiveShippingQuote = hasResolvedShippingQuote
        ? shippingQuote
        : (
            lastValidQuoteKey &&
                currentQuoteKey &&
                lastValidQuoteKey === currentQuoteKey
                ? lastValidShippingQuote
                : null
        );

    const displayedShippingCents = isPickupSelected
        ? 0
        : effectiveShippingQuote
            ? Number(effectiveShippingQuote.price_cents || 0)
            : Number(totals.shipping || 0);

    const displayedTotalCents = isPickupSelected
        ? Number(totals.total || 0) - Number(totals.shipping || 0)
        : effectiveShippingQuote
            ? Number(totals.total || 0) - Number(totals.shipping || 0) + Number(effectiveShippingQuote.price_cents || 0)
            : Number(totals.total || 0);

    const shippingQuoteSummaryText = useMemo(() => {
        if (!requiresShipping) return null;

        if (isPickupSelected) {
            return t(
                'ui.checkout.pickup_no_shipping_cost',
                'Levantamento em loja sem portes.'
            );
        }

        if (shippingQuoteLoading && !effectiveShippingQuote) {
            return t('ui.checkout.shipping_quote_loading', 'A calcular portes...');
        }

        if (shippingQuoteError) {
            return shippingQuoteError;
        }

        if (!selectedShippingZone) {
            return t(
                'ui.checkout.shipping_zone_pending',
                'Seleciona a zona de envio para calcular os portes.'
            );
        }

        if (!effectiveShippingQuote) {
            return t(
                'ui.checkout.shipping_zone_pending',
                'Seleciona a zona de envio para calcular os portes.'
            );
        }

        const minDays = effectiveShippingQuote?.estimated_days_min;
        const maxDays = effectiveShippingQuote?.estimated_days_max;

        if (minDays && maxDays) {
            if (minDays === maxDays) {
                return locale === 'en'
                    ? `Home delivery · estimated time: ${minDays} business day(s).`
                    : `Entrega ao domicílio · prazo estimado: ${minDays} dia(s) útil(eis).`;
            }

            return locale === 'en'
                ? `Home delivery · estimated time: ${minDays} to ${maxDays} business days.`
                : `Entrega ao domicílio · prazo estimado: ${minDays} a ${maxDays} dias úteis.`;
        }

        return t(
            'ui.checkout.shipping_quote_ready_fallback',
            'Entrega ao domicílio · prazo estimado até 5 dias úteis.'
        );
    }, [
        requiresShipping,
        isPickupSelected,
        shippingQuoteLoading,
        shippingQuoteError,
        effectiveShippingQuote,
        selectedShippingZone,
        t,
    ]);

    useEffect(() => {
        if (!requiresShipping) {
            setShippingQuote(null);
            setShippingQuoteError(null);
            setShippingQuoteLoading(false);
            return;
        }

        if (isPickupSelected) {
            setShippingQuote(null);
            setShippingQuoteError(null);
            setShippingQuoteLoading(false);
            return;
        }

        const cartId = cart?.id;
        const shippingZoneCode = String(data.shipping?.shipping_zone_code || '').trim();
        const shippingMethodCode = selectedShippingMethod?.code || '';

        if (!cartId || !shippingZoneCode || !shippingMethodCode) {
            setShippingQuote(null);
            setShippingQuoteError(null);
            setShippingQuoteLoading(false);
            return;
        }

        let cancelled = false;

        const timeoutId = window.setTimeout(async () => {
            setShippingQuoteLoading(true);
            setShippingQuoteError(null);

            try {
                const response = await window.axios.get(
                    route('checkout.shipping.quote', { locale }),
                    {
                        params: {
                            cart_id: cartId,
                            shipping_zone_code: shippingZoneCode,
                            shipping_method_code: shippingMethodCode,
                            shipping_profile: 'standard',
                        },
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    }
                );

                if (cancelled) return;

                const result = response.data;

                if (!result?.ok) {
                    const errorCode = result?.message;

                    const messageMap = {
                        shipping_method_not_found: t(
                            'ui.checkout.shipping_error_method',
                            'O método de envio selecionado já não está disponível.'
                        ),
                        invalid_weight: t(
                            'ui.checkout.shipping_error_invalid_weight',
                            'Existem produtos sem peso válido para calcular o envio.'
                        ),
                        weight_limit_exceeded: t(
                            'ui.checkout.shipping_error_weight_limit',
                            'A encomenda excede o limite automático de 30 kg. Contacta-nos para cotação manual.'
                        ),
                        zone_not_found: t(
                            'ui.checkout.shipping_error_zone',
                            'Não foi possível determinar a zona de envio.'
                        ),
                        rate_not_found: t(
                            'ui.checkout.shipping_error_rate',
                            'Não existe tarifa disponível para esta zona e peso.'
                        ),
                    };

                    setShippingQuote(null);
                    setShippingQuoteError(
                        messageMap[errorCode] ??
                        t(
                            'ui.checkout.shipping_error_generic',
                            'Não foi possível calcular os portes neste momento.'
                        )
                    );
                    setShippingQuoteLoading(false);
                    return;
                }

                setShippingQuote(result.quote);
                setLastValidShippingQuote(result.quote);
                setLastValidQuoteKey(currentQuoteKey);
                setShippingQuoteError(null);
                setShippingQuoteLoading(false);
            } catch (error) {
                if (cancelled) return;

                setShippingQuote(null);
                setShippingQuoteError(
                    t(
                        'ui.checkout.shipping_error_generic',
                        'Não foi possível calcular os portes neste momento.'
                    )
                );
                setShippingQuoteLoading(false);
            }
        }, 300);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [
        locale,
        cart?.id,
        requiresShipping,
        isPickupSelected,
        data.shipping?.shipping_zone_code,
        selectedShippingMethod?.code,
        currentQuoteKey,
        t,
    ]);

    const canSubmit =
        !processing &&
        paymentMethodsList.length > 0 &&
        (!requiresShipping || shippingMethodsList.length > 0);

    const submit = (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        post(route('checkout.store', { locale }), {
            preserveScroll: true,
        });
    };

    const applyCoupon = (e) => {
        e.preventDefault();
        couponForm.post(route('checkout.coupon.store', { locale }), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                couponForm.setData('coupon_code', '');
            },
        });
    };

    const removeCoupon = () => {
        router.delete(route('checkout.coupon.destroy', { locale }), {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const updateShippingField = (field, value) => {
        setData('shipping', {
            ...data.shipping,
            [field]: value,
        });
    };

    const updateBillingField = (field, value) => {
        setData('billing', {
            ...data.billing,
            [field]: value,
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    {t('ui.checkout.title', 'Checkout')}
                </h2>
            }
        >
            <Head title={t('ui.checkout.title', 'Checkout')} />

            <div className="py-6">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg lg:col-span-2">
                            <form
                                onSubmit={submit}
                                className={[
                                    'space-y-6 p-6 transition-opacity',
                                    processing ? 'opacity-90' : '',
                                ].join(' ')}
                            >
                                <input type="hidden" name="checkout_token" value={data.checkout_token} readOnly />

                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">
                                        {t('ui.checkout.customer_data', 'Customer data')}
                                    </h3>

                                    <Link
                                        href={route('cart.index', { locale })}
                                        className="text-sm text-gray-600 hover:underline"
                                    >
                                        {t('ui.checkout.back_to_cart', 'Back to cart')}
                                    </Link>
                                </div>

                                {errors.checkout ? <AlertBox>{errors.checkout}</AlertBox> : null}

                                {paymentMethodsList.length === 0 ? (
                                    <AlertBox>
                                        {t(
                                            'ui.checkout.no_payment_methods',
                                            'Não existem métodos de pagamento disponíveis neste momento.'
                                        )}
                                    </AlertBox>
                                ) : null}

                                {requiresShipping && shippingMethodsList.length === 0 ? (
                                    <AlertBox>
                                        {t(
                                            'ui.checkout.no_shipping_methods',
                                            'Não existem métodos de envio disponíveis neste momento.'
                                        )}
                                    </AlertBox>
                                ) : null}

                                {!requiresShipping ? (
                                    <InfoBox>
                                        {t(
                                            'ui.checkout.no_shipping_required_info',
                                            'This cart does not require physical shipping. Only the billing address will be used for this order.'
                                        )}
                                    </InfoBox>
                                ) : null}

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            {t('ui.checkout.phone', 'Phone')}
                                        </label>
                                        <input
                                            type="tel"
                                            autoComplete="tel"
                                            placeholder={t('ui.checkout.phone_placeholder', 'Ex.: 912345678')}
                                            className="mt-1 w-full rounded-md border-gray-300"
                                            value={data.phone}
                                            onChange={(e) => setData('phone', e.target.value)}
                                        />
                                        <FieldError error={errors.phone} />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            {t('ui.checkout.vat_number', 'VAT / Tax number')}
                                        </label>
                                        <input
                                            autoComplete="off"
                                            placeholder={t('ui.checkout.vat_number_placeholder', 'Ex.: 123456789')}
                                            className="mt-1 w-full rounded-md border-gray-300"
                                            value={data.vat_number}
                                            onChange={(e) => setData('vat_number', e.target.value)}
                                        />
                                        <FieldError error={errors.vat_number} />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            {t('ui.checkout.company_name', 'Company')}
                                        </label>
                                        <input
                                            autoComplete="organization"
                                            placeholder={t('ui.checkout.company_name_placeholder', 'Opcional')}
                                            className="mt-1 w-full rounded-md border-gray-300"
                                            value={data.company_name}
                                            onChange={(e) => setData('company_name', e.target.value)}
                                        />
                                        <FieldError error={errors.company_name} />
                                    </div>
                                </div>

                                {requiresShipping ? (
                                    <div className="border-t pt-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className="text-lg font-semibold">
                                                    {t('ui.checkout.shipping_address', 'Shipping address')}
                                                </h3>
                                                <p className="mt-1 text-sm text-gray-600">
                                                    {t(
                                                        'ui.checkout.shipping_address_help',
                                                        'Morada onde vais receber a encomenda.'
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.common.name', 'Name')}
                                                </label>
                                                <input
                                                    autoComplete="shipping name"
                                                    placeholder={t('ui.common.name', 'Name')}
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.shipping.name}
                                                    onChange={(e) => updateShippingField('name', e.target.value)}
                                                />
                                                <FieldError error={errors['shipping.name']} />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.checkout.country', 'País')}
                                                </label>
                                                <select
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.shipping.country_code}
                                                    onChange={(e) => updateShippingField('country_code', e.target.value)}
                                                >
                                                    {availableCountryOptions.map((country) => (
                                                        <option key={country.code} value={country.code}>
                                                            {country.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="mt-1 text-xs text-gray-500">
                                                    {t(
                                                        'ui.checkout.country_help_limited',
                                                        'Seleciona o país disponível.'
                                                    )}
                                                </div>
                                                <FieldError error={errors['shipping.country_code']} />
                                            </div>

                                            {!isPickupSelected ? (
                                                <div className="md:col-span-2">
                                                    <label className="block text-sm font-medium text-gray-700">
                                                        {t('ui.checkout.shipping_zone', 'Zona de envio')}
                                                    </label>
                                                    <select
                                                        className="mt-1 w-full rounded-md border-gray-300"
                                                        value={data.shipping.shipping_zone_code || ''}
                                                        onChange={(e) => updateShippingField('shipping_zone_code', e.target.value)}
                                                        disabled={filteredShippingZones.length === 0}
                                                    >
                                                        {filteredShippingZones.length === 0 ? (
                                                            <option value="">
                                                                {t(
                                                                    'ui.checkout.no_shipping_zones_for_country',
                                                                    'Sem zonas disponíveis para este país'
                                                                )}
                                                            </option>
                                                        ) : (
                                                            filteredShippingZones.map((zone) => (
                                                                <option key={zone.code} value={zone.code}>
                                                                    {zone.name}
                                                                </option>
                                                            ))
                                                        )}
                                                    </select>
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        {t(
                                                            'ui.checkout.shipping_zone_help',
                                                            'Seleciona a zona logística correta para calcular os portes.'
                                                        )}
                                                    </div>
                                                    <FieldError error={errors['shipping.shipping_zone_code']} />
                                                </div>
                                            ) : null}

                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.checkout.address_line1', 'Address line 1')}
                                                </label>
                                                <input
                                                    autoComplete="shipping address-line1"
                                                    placeholder={t('ui.checkout.address_line1_placeholder', 'Rua, número, porta')}
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.shipping.line1}
                                                    onChange={(e) => updateShippingField('line1', e.target.value)}
                                                />
                                                <FieldError error={errors['shipping.line1']} />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.checkout.address_line2', 'Address line 2')}
                                                </label>
                                                <input
                                                    autoComplete="shipping address-line2"
                                                    placeholder={t(
                                                        'ui.checkout.address_line2_placeholder',
                                                        'Apartamento, andar, etc. (opcional)'
                                                    )}
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.shipping.line2}
                                                    onChange={(e) => updateShippingField('line2', e.target.value)}
                                                />
                                                <FieldError error={errors['shipping.line2']} />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.checkout.city', 'City')}
                                                </label>
                                                <input
                                                    autoComplete="shipping address-level2"
                                                    placeholder={t('ui.checkout.city_placeholder', 'Cidade')}
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.shipping.city}
                                                    onChange={(e) => updateShippingField('city', e.target.value)}
                                                />
                                                <FieldError error={errors['shipping.city']} />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.checkout.postal_code', 'Postal code')}
                                                </label>
                                                <input
                                                    autoComplete="shipping postal-code"
                                                    placeholder={t('ui.checkout.postal_code_placeholder', 'Ex.: 1000-001')}
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.shipping.postal_code}
                                                    onChange={(e) => updateShippingField('postal_code', e.target.value)}
                                                />
                                                <FieldError error={errors['shipping.postal_code']} />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.checkout.region', 'Region')}
                                                </label>
                                                <input
                                                    autoComplete="shipping address-level1"
                                                    placeholder={t('ui.checkout.region_placeholder', 'Distrito / Região')}
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.shipping.region}
                                                    onChange={(e) => updateShippingField('region', e.target.value)}
                                                />
                                                <FieldError error={errors['shipping.region']} />
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                <div className="border-t pt-6">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold">
                                                {t('ui.checkout.billing_address', 'Billing address')}
                                            </h3>
                                            <p className="mt-1 text-sm text-gray-600">
                                                {t(
                                                    'ui.checkout.billing_address_help',
                                                    'Usada para faturação e dados da encomenda.'
                                                )}
                                            </p>
                                        </div>

                                        {requiresShipping ? (
                                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                                <input
                                                    type="checkbox"
                                                    checked={!!data.billing_same_as_shipping}
                                                    onChange={(e) => setData('billing_same_as_shipping', e.target.checked)}
                                                    className="rounded border-gray-300 text-gray-900"
                                                />
                                                <span>
                                                    {t(
                                                        'ui.checkout.billing_same_as_shipping',
                                                        'A morada de faturação é igual à de envio'
                                                    )}
                                                </span>
                                            </label>
                                        ) : null}
                                    </div>

                                    {!data.billing_same_as_shipping || !requiresShipping ? (
                                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.common.name', 'Name')}
                                                </label>
                                                <input
                                                    autoComplete="billing name"
                                                    placeholder={t('ui.common.name', 'Name')}
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.billing.name}
                                                    onChange={(e) => updateBillingField('name', e.target.value)}
                                                />
                                                <FieldError error={errors['billing.name']} />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.checkout.country', 'País')}
                                                </label>
                                                <select
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.billing.country_code}
                                                    onChange={(e) => updateBillingField('country_code', e.target.value)}
                                                >
                                                    {availableCountryOptions.map((country) => (
                                                        <option key={country.code} value={country.code}>
                                                            {country.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="mt-1 text-xs text-gray-500">
                                                    {t(
                                                        'ui.checkout.country_help_limited',
                                                        'Seleciona o país disponível.'
                                                    )}
                                                </div>
                                                <FieldError error={errors['billing.country_code']} />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.checkout.address_line1', 'Address line 1')}
                                                </label>
                                                <input
                                                    autoComplete="billing address-line1"
                                                    placeholder={t('ui.checkout.address_line1_placeholder', 'Rua, número, porta')}
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.billing.line1}
                                                    onChange={(e) => updateBillingField('line1', e.target.value)}
                                                />
                                                <FieldError error={errors['billing.line1']} />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.checkout.address_line2', 'Address line 2')}
                                                </label>
                                                <input
                                                    autoComplete="billing address-line2"
                                                    placeholder={t(
                                                        'ui.checkout.address_line2_placeholder',
                                                        'Apartamento, andar, etc. (opcional)'
                                                    )}
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.billing.line2}
                                                    onChange={(e) => updateBillingField('line2', e.target.value)}
                                                />
                                                <FieldError error={errors['billing.line2']} />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.checkout.city', 'City')}
                                                </label>
                                                <input
                                                    autoComplete="billing address-level2"
                                                    placeholder={t('ui.checkout.city_placeholder', 'Cidade')}
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.billing.city}
                                                    onChange={(e) => updateBillingField('city', e.target.value)}
                                                />
                                                <FieldError error={errors['billing.city']} />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.checkout.postal_code', 'Postal code')}
                                                </label>
                                                <input
                                                    autoComplete="billing postal-code"
                                                    placeholder={t('ui.checkout.postal_code_placeholder', 'Ex.: 1000-001')}
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.billing.postal_code}
                                                    onChange={(e) => updateBillingField('postal_code', e.target.value)}
                                                />
                                                <FieldError error={errors['billing.postal_code']} />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.checkout.region', 'Region')}
                                                </label>
                                                <input
                                                    autoComplete="billing address-level1"
                                                    placeholder={t('ui.checkout.region_placeholder', 'Distrito / Região')}
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={data.billing.region}
                                                    onChange={(e) => updateBillingField('region', e.target.value)}
                                                />
                                                <FieldError error={errors['billing.region']} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                                            {t(
                                                'ui.checkout.billing_same_as_shipping_notice',
                                                'A morada de faturação será igual à morada de envio.'
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-4 border-t pt-6 md:grid-cols-2">
                                    {requiresShipping ? (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                {t('ui.checkout.shipping_method', 'Shipping method')}
                                            </label>
                                            <select
                                                className="mt-1 w-full rounded-md border-gray-300"
                                                value={data.shipping_method_id}
                                                onChange={(e) => setData('shipping_method_id', e.target.value)}
                                                disabled={shippingMethodsList.length === 0}
                                            >
                                                {shippingMethodsList.length === 0 ? (
                                                    <option value="">
                                                        {t('ui.checkout.no_shipping_methods_short', 'Sem métodos disponíveis')}
                                                    </option>
                                                ) : (
                                                    shippingMethodsList.map((m) => (
                                                        <option key={m.id} value={m.id}>
                                                            {m.name}
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                            <FieldError error={errors.shipping_method_id} />

                                            <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
                                                <div className="font-medium text-gray-900">
                                                    {isPickupSelected
                                                        ? t('ui.checkout.pickup_title', 'Levantamento em loja')
                                                        : t('ui.checkout.shipping_quote_title', 'Envio ao domicílio')}
                                                </div>

                                                {!isPickupSelected && selectedShippingZone ? (
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        {t('ui.checkout.shipping_zone_selected', 'Zona selecionada')}: {selectedShippingZone.name}
                                                    </div>
                                                ) : null}

                                                {!isPickupSelected && effectiveShippingQuote ? (
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        {t('ui.checkout.shipping_weight_label', 'Peso total')}: {effectiveShippingQuote.weight_grams} g
                                                    </div>
                                                ) : null}

                                                <div className="mt-1">{shippingQuoteSummaryText}</div>

                                                {(effectiveShippingQuote || isPickupSelected) ? (
                                                    <div className="mt-2 font-semibold text-gray-900">
                                                        {t('ui.checkout.shipping_cost_label', 'Portes')}:{' '}
                                                        {formatMoney(displayedShippingCents, currency)}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                {t('ui.thankyou.shipping', 'Shipping')}
                                            </label>
                                            <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                                                {t(
                                                    'ui.checkout.no_shipping_required_short',
                                                    'This order does not require physical shipping.'
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            {t('ui.checkout.payment_method', 'Payment method')}
                                        </label>
                                        <select
                                            className="mt-1 w-full rounded-md border-gray-300"
                                            value={data.payment_method_id}
                                            onChange={(e) => setData('payment_method_id', e.target.value)}
                                            disabled={paymentMethodsList.length === 0}
                                        >
                                            {paymentMethodsList.length === 0 ? (
                                                <option value="">
                                                    {t('ui.checkout.no_payment_methods_short', 'Sem métodos disponíveis')}
                                                </option>
                                            ) : (
                                                paymentMethodsList.map((m) => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name}
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                        <FieldError error={errors.payment_method_id} />
                                    </div>
                                </div>

                                <div className="space-y-4 border-t pt-6">
                                    <TrustBox t={t} requiresShipping={requiresShipping} />

                                    <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-4">
                                        <label className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={!!data.accept_legal}
                                                onChange={(e) => setData('accept_legal', e.target.checked)}
                                                className="mt-1 rounded border-gray-300 text-gray-900"
                                            />
                                            <span className="text-sm leading-6 text-gray-700">
                                                {t('ui.checkout.accept_legal_prefix', 'Li e aceito os')}{' '}
                                                <Link
                                                    href={route('terms', { locale })}
                                                    className="font-medium text-gray-900 underline hover:text-gray-700"
                                                >
                                                    {t('ui.footer.terms', 'Terms & Conditions')}
                                                </Link>{' '}
                                                {t('ui.checkout.accept_legal_and', 'e a')}{' '}
                                                <Link
                                                    href={route('privacy', { locale })}
                                                    className="font-medium text-gray-900 underline hover:text-gray-700"
                                                >
                                                    {t('ui.footer.privacy', 'Privacy Policy')}
                                                </Link>
                                                .
                                            </span>
                                        </label>
                                        <FieldError error={errors.accept_legal} />
                                    </div>

                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                        <button
                                            type="submit"
                                            disabled={!canSubmit}
                                            className={[
                                                'inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-semibold text-white transition',
                                                canSubmit
                                                    ? 'bg-gray-900 hover:bg-gray-800'
                                                    : 'cursor-not-allowed bg-gray-400',
                                            ].join(' ')}
                                        >
                                            {processing
                                                ? t('ui.checkout.confirming_order', 'Confirming order...')
                                                : requiresShipping
                                                    ? t('ui.checkout.confirm_order', 'Confirm order')
                                                    : t('ui.checkout.confirm_request', 'Confirm request')}
                                        </button>

                                        <span className="text-sm text-gray-500">
                                            {t(
                                                'ui.checkout.submit_hint',
                                                'Confirma os dados antes de concluir a encomenda.'
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="h-fit overflow-hidden bg-white shadow-sm sm:rounded-lg lg:sticky lg:top-6">
                            <div className="space-y-4 p-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">
                                        {t('ui.checkout.summary', 'Summary')}
                                    </h3>
                                    <div className="text-sm text-gray-600">
                                        {itemCount} {t('ui.checkout.items_count_label', 'artigo(s)')}
                                    </div>
                                </div>

                                <div className="rounded-lg border p-4">
                                    <div className="text-sm font-semibold text-gray-900">
                                        {t('ui.coupons.title', 'Coupons')}
                                    </div>

                                    {appliedCoupon ? (
                                        <div className="mt-3 space-y-3">
                                            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                                                <div className="font-semibold">
                                                    {t('ui.coupons.applied_coupon', 'Applied coupon')}
                                                </div>
                                                <div className="mt-1">
                                                    {appliedCoupon.code}
                                                    {appliedCoupon.name ? ` · ${appliedCoupon.name}` : ''}
                                                </div>
                                                <div className="mt-1 font-medium">
                                                    {t('ui.coupons.discount', 'Discount')}: -{' '}
                                                    {formatMoney(totals.discount, currency)}
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={removeCoupon}
                                                className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                                            >
                                                {t('ui.coupons.remove', 'Remove coupon')}
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={applyCoupon} className="mt-3 space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {t('ui.coupons.code', 'Coupon code')}
                                                </label>
                                                <input
                                                    className="mt-1 w-full rounded-md border-gray-300"
                                                    value={couponForm.data.coupon_code}
                                                    onChange={(e) =>
                                                        couponForm.setData('coupon_code', e.target.value.toUpperCase())
                                                    }
                                                    maxLength={64}
                                                    placeholder={t('ui.coupons.code_placeholder', 'Ex.: SAVE10')}
                                                />
                                                <FieldError error={couponForm.errors.coupon_code} />
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={couponForm.processing}
                                                className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                {t('ui.coupons.apply', 'Apply')}
                                            </button>
                                        </form>
                                    )}
                                </div>

                                {pricesIncludeTax ? (
                                    <InfoBox>
                                        <div>{t('ui.checkout.tax_included', 'Os preços dos artigos já incluem IVA quando aplicável.')}</div>
                                        <div className="mt-1">
                                            {t('ui.checkout.tax_calculated_after_discount', 'O IVA é calculado após aplicação dos descontos.')}
                                        </div>
                                    </InfoBox>
                                ) : (
                                    <InfoBox>
                                        {t('ui.checkout.tax_calculated_after_discount', 'O IVA é calculado após aplicação dos descontos.')}
                                    </InfoBox>
                                )}

                                <div className="space-y-3">
                                    {(items ?? []).map((it) => (
                                        <div
                                            key={it.id}
                                            className="flex items-start justify-between gap-3 rounded-md border p-3"
                                        >
                                            <div className="min-w-0 text-sm">
                                                <div className="font-medium text-gray-900">{it.name}</div>
                                                <div className="text-gray-600">
                                                    SKU: {it.sku} · {t('ui.thankyou.qty', 'Qty')}: {it.qty}
                                                </div>
                                                <div className="text-gray-500">
                                                    {formatMoney(it.unit_amount, currency)} × {it.qty}
                                                </div>

                                                <div className="mt-1">
                                                    {it.requires_shipping ? (
                                                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                                                            {t('ui.checkout.requires_shipping', 'Requires shipping')}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                                                            {t('ui.checkout.no_physical_shipping', 'No physical shipping')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="shrink-0 text-sm font-semibold text-gray-900">
                                                {formatMoney(it.line_total, currency)}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2 border-t pt-4 text-sm">
                                    <div className="flex justify-between">
                                        <span>{t('ui.thankyou.subtotal', 'Subtotal')}</span>
                                        <span>{formatMoney(totals.subtotal, currency)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>{t('ui.thankyou.shipping', 'Shipping')}</span>
                                        <span>
                                            {shippingQuoteLoading && !effectiveShippingQuote && !isPickupSelected
                                                ? t('ui.checkout.shipping_quote_loading_short', 'A calcular...')
                                                : formatMoney(displayedShippingCents, currency)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>{t('ui.thankyou.tax', 'Tax')}</span>
                                        <span>{formatMoney(totals.tax, currency)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>{t('ui.coupons.discount', 'Discount')}</span>
                                        <span>- {formatMoney(totals.discount, currency)}</span>
                                    </div>

                                    <div className="flex justify-between border-t pt-3 text-base font-semibold">
                                        <span>{t('ui.thankyou.total', 'Total')}</span>
                                        <span>{formatMoney(displayedTotalCents, currency)}</span>
                                    </div>
                                </div>

                                <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                                    <div className="font-semibold text-gray-900">
                                        {t('ui.checkout.summary_footer_title', 'O que acontece a seguir?')}
                                    </div>
                                    <div className="mt-1">
                                        {t(
                                            'ui.checkout.summary_footer_text',
                                            'Depois de confirmares, a encomenda ficará registada e poderás acompanhá-la no teu painel.'
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

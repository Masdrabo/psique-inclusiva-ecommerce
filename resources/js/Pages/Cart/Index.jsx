import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';

function formatMoney(cents, currency) {
  if (cents === null || cents === undefined) return '-';
  const dp = currency?.decimal_places ?? 2;
  const symbol = currency?.symbol ?? '€';
  const value = (Number(cents || 0) / Math.pow(10, dp)).toFixed(dp);
  return `${value} ${symbol}`;
}

function Pill({ children, title, tone = 'gray' }) {
  const tones = {
    gray: 'border-gray-300 text-gray-700 bg-white',
    blue: 'border-blue-200 text-blue-700 bg-blue-50',
    yellow: 'border-yellow-200 text-yellow-800 bg-yellow-50',
    green: 'border-green-200 text-green-700 bg-green-50',
  };

  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tones[tone] ?? tones.gray}`}
    >
      {children}
    </span>
  );
}

function AlertBox({ children }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {children}
    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      {children}
    </div>
  );
}

function SummaryBar({ locale, amounts, currency, t }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-gray-50 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <div className="text-sm text-gray-600">
            {t('ui.thankyou.subtotal', 'Subtotal')}
          </div>
          <div className="mt-1 text-lg font-bold text-gray-900">
            {formatMoney(amounts?.subtotal ?? 0, currency)}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600">
            {t('ui.thankyou.tax', 'Tax')}
          </div>
          <div className="mt-1 text-lg font-bold text-gray-900">
            {formatMoney(amounts?.tax ?? 0, currency)}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600">
            {t('ui.thankyou.total', 'Total')}
          </div>
          <div className="mt-1 text-xl font-bold text-gray-900">
            {formatMoney(amounts?.total ?? 0, currency)}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Link
          href={route('checkout.index', { locale })}
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          {t('ui.cart.go_to_checkout', 'Go to checkout')}
        </Link>
      </div>
    </div>
  );
}

function QuantityStepper({
  item,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
  t,
}) {
  return (
    <div className="inline-flex h-10 items-stretch overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm">
      <button
        type="button"
        onClick={onDecrease}
        disabled={!canDecrease}
        className={[
          'inline-flex w-10 items-center justify-center border-r text-base font-bold transition',
          canDecrease
            ? 'text-gray-700 hover:bg-gray-50'
            : 'cursor-not-allowed bg-gray-50 text-gray-300',
        ].join(' ')}
        aria-label={t('ui.cart.decrease_qty', 'Decrease quantity')}
        title={t('ui.cart.decrease_qty', 'Decrease quantity')}
      >
        −
      </button>

      <input
        id={`qty-${item.id}`}
        type="text"
        readOnly
        value={String(item.qty ?? 1)}
        className="w-12 border-0 bg-white text-center text-sm font-semibold text-gray-900 focus:ring-0"
      />

      <button
        type="button"
        onClick={onIncrease}
        disabled={!canIncrease}
        className={[
          'inline-flex w-10 items-center justify-center border-l text-base font-bold transition',
          canIncrease
            ? 'text-gray-700 hover:bg-gray-50'
            : 'cursor-not-allowed bg-gray-50 text-gray-300',
        ].join(' ')}
        aria-label={t('ui.cart.increase_qty', 'Increase quantity')}
        title={t('ui.cart.increase_qty', 'Increase quantity')}
      >
        +
      </button>
    </div>
  );
}

export default function CartIndex() {
  const { locale, cart, errors } = usePage().props;
  const { t } = useI18n();

  const items = cart?.items ?? [];
  const currency = cart?.currency ?? { symbol: '€', decimal_places: 2 };
  const amounts = cart?.amounts ?? { subtotal: 0, tax: 0, total: 0 };
  const pricesIncludeTax = !!cart?.prices_include_tax;

  const resolveMaxQty = (item) => {
    if (!item.allow_quantity) return 1;

    const candidates = [];

    if (Number.isInteger(item.max_per_order) && item.max_per_order > 0) {
      candidates.push(item.max_per_order);
    }

    if (item.manages_inventory && Number.isInteger(item.available_stock)) {
      candidates.push(item.available_stock);
    }

    if (candidates.length === 0) return null;

    return Math.min(...candidates);
  };

  const removeItem = (id) => {
    router.delete(route('cart.items.destroy', { locale, item: id }), {
      preserveScroll: true,
      preserveState: true,
    });
  };

  const updateQty = (id, qty) => {
    router.patch(
      route('cart.items.update', { locale, item: id }),
      { qty },
      {
        preserveScroll: true,
        preserveState: true,
      }
    );
  };

  const changeQtyBy = (item, delta) => {
    const currentQty = Number(item.qty ?? 1);
    const maxQty = resolveMaxQty(item);

    let nextQty = currentQty + delta;

    if (nextQty < 1) nextQty = 1;
    if (!item.allow_quantity) nextQty = 1;
    if (maxQty && nextQty > maxQty) nextQty = maxQty;

    if (nextQty === currentQty) return;

    updateQty(item.id, nextQty);
  };

  const hasReorderItems = useMemo(
    () => items.some((x) => x?.reorder),
    [items]
  );

  const hasCurrentPriceFallback = useMemo(
    () => items.some((x) => x?.price_source === 'current'),
    [items]
  );

  return (
    <AuthenticatedLayout
      header={
        <div>
          <h2 className="text-xl font-semibold leading-tight text-gray-800">
            {t('ui.nav.cart', 'Cart')}
          </h2>
          <div className="mt-1 text-sm text-gray-600">
            {t('ui.cart.subtitle', 'Review your items before checkout')}
          </div>
        </div>
      }
    >
      <Head title={t('ui.nav.cart', 'Cart')} />

      <div className="py-4">
        <div className="mx-auto max-w-7xl space-y-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="space-y-4 p-6">
              {errors?.item ? <AlertBox>{errors.item}</AlertBox> : null}

              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                  <div className="text-lg font-semibold text-gray-900">
                    {t('ui.cart.empty', 'Cart is empty.')}
                  </div>

                  <div className="mt-2 text-sm text-gray-600">
                    {t(
                      'ui.cart.empty_hint',
                      'Add some products to your cart before proceeding to checkout.'
                    )}
                  </div>

                  <div className="mt-5">
                    <Link
                      href={route('shop.index', { locale })}
                      className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                    >
                      {t('ui.cart.continue_shopping', 'Continue shopping')}
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {pricesIncludeTax ? (
                    <InfoBox>
                      <div>
                        {t('ui.checkout.tax_included', 'Os preços dos artigos já incluem IVA quando aplicável.')}
                      </div>
                      <div className="mt-1">
                        {t('ui.checkout.tax_calculated_after_discount', 'O IVA é calculado após aplicação dos descontos.')}
                      </div>
                    </InfoBox>
                  ) : (
                    <InfoBox>
                      {t('ui.checkout.tax_calculated_after_discount', 'O IVA é calculado após aplicação dos descontos.')}
                    </InfoBox>
                  )}

                  <SummaryBar
                    locale={locale}
                    amounts={amounts}
                    currency={currency}
                    t={t}
                  />

                  <div className="space-y-4">
                    {items.map((it) => {
                      const isMembership = it.business_type === 'membership_fee';
                      const isDigital = it.business_type === 'digital_service';
                      const isPhysical = it.business_type === 'physical';
                      const maxQty = resolveMaxQty(it);
                      const productHref = it.slug
                        ? route('shop.products.show', {
                            locale,
                            product: it.slug,
                          })
                        : null;

                      const currentQty = Number(it.qty ?? 1);
                      const canDecrease = currentQty > 1 && !!it.allow_quantity;
                      const canIncrease = it.allow_quantity
                        ? (maxQty ? currentQty < maxQty : true)
                        : false;

                      return (
                        <div key={it.id} className="rounded-2xl border p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex min-w-0 gap-4">
                              {productHref ? (
                                <Link
                                  href={productHref}
                                  className="block h-24 w-24 shrink-0 overflow-hidden rounded-xl border bg-gray-50"
                                >
                                  {it.image?.url ? (
                                    <img
                                      src={it.image.url}
                                      alt={it.image.alt ?? it.name ?? ''}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                      draggable={false}
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                                      {t('ui.wishlist.no_image', 'No image')}
                                    </div>
                                  )}
                                </Link>
                              ) : (
                                <div className="block h-24 w-24 shrink-0 overflow-hidden rounded-xl border bg-gray-50">
                                  {it.image?.url ? (
                                    <img
                                      src={it.image.url}
                                      alt={it.image.alt ?? it.name ?? ''}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                      draggable={false}
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                                      {t('ui.wishlist.no_image', 'No image')}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  {productHref ? (
                                    <Link
                                      href={productHref}
                                      className="text-base font-semibold text-gray-900 hover:underline"
                                    >
                                      {it.name}
                                    </Link>
                                  ) : (
                                    <div className="text-base font-semibold text-gray-900">
                                      {it.name}
                                    </div>
                                  )}

                                  {isPhysical ? (
                                    <Pill
                                      tone="gray"
                                      title={t('ui.cart.physical_product', 'Physical product')}
                                    >
                                      {t('ui.cart.physical_product', 'Physical product')}
                                    </Pill>
                                  ) : null}

                                  {isMembership ? (
                                    <Pill
                                      tone="blue"
                                      title={t(
                                        'ui.cart.membership_limit_title',
                                        'Membership fee limited to 1 unit per order'
                                      )}
                                    >
                                      {t('ui.manager.membership_title', 'Membership fee')}
                                    </Pill>
                                  ) : null}

                                  {isDigital ? (
                                    <Pill
                                      tone="blue"
                                      title={t(
                                        'ui.cart.digital_service_title',
                                        'Digital service without physical shipping'
                                      )}
                                    >
                                      {t('ui.manager.digital_service_title', 'Digital service')}
                                    </Pill>
                                  ) : null}

                                  {it.requires_shipping ? (
                                    <Pill
                                      tone="green"
                                      title={t('ui.checkout.requires_shipping', 'Requires shipping')}
                                    >
                                      {t('ui.checkout.requires_shipping', 'Requires shipping')}
                                    </Pill>
                                  ) : (
                                    <Pill
                                      tone="blue"
                                      title={t(
                                        'ui.checkout.no_physical_shipping',
                                        'No physical shipping'
                                      )}
                                    >
                                      {t(
                                        'ui.checkout.no_physical_shipping',
                                        'No physical shipping'
                                      )}
                                    </Pill>
                                  )}

                                  {it.price_includes_tax ? (
                                    <Pill
                                      tone="green"
                                      title={t('ui.checkout.tax_included', 'Os preços dos artigos já incluem IVA quando aplicável.')}
                                    >
                                      IVA incl.
                                    </Pill>
                                  ) : null}

                                  {it.reorder ? (
                                    <Link
                                      href={route('panel.orders.show', {
                                        locale,
                                        order: it.reorder.order_id,
                                      })}
                                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                                      title={t(
                                        'ui.cart.reorder_item_title',
                                        'This item was added from a previous order'
                                      )}
                                    >
                                      {t('ui.cart.reorder', 'Reorder')}
                                    </Link>
                                  ) : null}

                                  {it.price_source === 'current' ? (
                                    <Pill
                                      title={t(
                                        'ui.cart.price_updated_title',
                                        'This price came from the current product price (unit_amount was not saved in the cart).'
                                      )}
                                      tone="yellow"
                                    >
                                      {t('ui.cart.price_updated', 'Updated price')}
                                    </Pill>
                                  ) : null}

                                  {it.price_source === 'unknown' ? (
                                    <Pill
                                      title={t(
                                        'ui.cart.no_price_title',
                                        'Could not determine a price for this item.'
                                      )}
                                      tone="yellow"
                                    >
                                      {t('ui.cart.no_price', 'No price')}
                                    </Pill>
                                  ) : null}
                                </div>

                                <div className="text-xs text-gray-600">
                                  SKU: {it.sku ?? '-'}
                                </div>

                                <div className="text-sm text-gray-700">
                                  {t('ui.cart.unit_price', 'Unit price')}:{' '}
                                  <span className="font-semibold">
                                    {formatMoney(it.unit_amount, currency)}
                                  </span>
                                </div>

                                <div className="text-sm text-gray-700">
                                  {t('ui.thankyou.subtotal', 'Subtotal')}:{' '}
                                  <span className="font-semibold">
                                    {formatMoney(it.subtotal_amount, currency)}
                                  </span>
                                </div>

                                <div className="text-sm text-gray-700">
                                  {t('ui.thankyou.tax', 'Tax')}:{' '}
                                  <span className="font-semibold">
                                    {formatMoney(it.tax_amount, currency)}
                                  </span>
                                </div>

                                <div className="text-sm text-gray-700">
                                  {t('ui.cart.line_total', 'Line total')}:{' '}
                                  <span className="font-semibold text-gray-900">
                                    {formatMoney(it.line_total, currency)}
                                  </span>
                                </div>

                                {maxQty ? (
                                  <div className="text-xs text-gray-500">
                                    {t(
                                      'ui.cart.max_allowed_item',
                                      'Maximum allowed for this item'
                                    )}
                                    : {maxQty}
                                  </div>
                                ) : null}

                                {isMembership ? (
                                  <div className="text-xs text-blue-700">
                                    {t(
                                      'ui.cart.membership_limit_note',
                                      'Membership fees are limited to 1 unit per order.'
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-3 self-end lg:self-center">
                              <QuantityStepper
                                item={it}
                                canDecrease={canDecrease}
                                canIncrease={canIncrease}
                                onDecrease={() => changeQtyBy(it, -1)}
                                onIncrease={() => changeQtyBy(it, 1)}
                                t={t}
                              />

                              <button
                                type="button"
                                onClick={() => removeItem(it.id)}
                                className="inline-flex h-10 items-center justify-center rounded-md border border-red-200 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                              >
                                {t('ui.cart.remove', 'Remove')}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <SummaryBar
                    locale={locale}
                    amounts={amounts}
                    currency={currency}
                    t={t}
                  />
                </>
              )}
            </div>
          </div>

          {hasReorderItems ? (
            <div className="text-xs text-gray-600">
              {t('ui.cart.reorder_note_prefix', 'Items marked as')}{' '}
              <span className="font-semibold">
                {t('ui.cart.reorder', 'Reorder')}
              </span>{' '}
              {t(
                'ui.cart.reorder_note_suffix',
                'were added from a previous order.'
              )}
            </div>
          ) : null}

          {hasCurrentPriceFallback ? (
            <div className="text-xs text-gray-600">
              <span className="font-semibold">
                {t('ui.cart.price_updated', 'Updated price')}
              </span>
              :{' '}
              {t(
                'ui.cart.price_updated_note',
                'the cart did not have the saved price, so the current product price was used.'
              )}
            </div>
          ) : null}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

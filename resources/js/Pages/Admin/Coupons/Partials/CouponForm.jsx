import { Link } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

export default function CouponForm({
  locale,
  data,
  setData,
  errors,
  processing,
  submitLabel,
  onSubmit,
  isEdit = false,
}) {
  const { t } = useI18n();

  const isFixed = data.type === 'fixed_amount';
  const isPercentage = data.type === 'percentage';

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('ui.coupons.admin.code', 'Code')}
          </label>
          <input
            className="mt-1 w-full rounded-md border-gray-300"
            value={data.code}
            onChange={(e) => setData('code', e.target.value.toUpperCase())}
            maxLength={64}
          />
          {errors.code ? <div className="mt-1 text-sm text-red-600">{errors.code}</div> : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('ui.coupons.admin.name', 'Name')}
          </label>
          <input
            className="mt-1 w-full rounded-md border-gray-300"
            value={data.name}
            onChange={(e) => setData('name', e.target.value)}
            maxLength={160}
          />
          {errors.name ? <div className="mt-1 text-sm text-red-600">{errors.name}</div> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('ui.coupons.admin.type', 'Type')}
          </label>
          <select
            className="mt-1 w-full rounded-md border-gray-300"
            value={data.type}
            onChange={(e) => setData('type', e.target.value)}
          >
            <option value="fixed_amount">{t('ui.coupons.admin.fixed_amount', 'Fixed amount')}</option>
            <option value="percentage">{t('ui.coupons.admin.percentage', 'Percentage')}</option>
          </select>
          {errors.type ? <div className="mt-1 text-sm text-red-600">{errors.type}</div> : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('ui.coupons.admin.amount', 'Amount')}
          </label>
          <input
            type="number"
            step="0.01"
            className="mt-1 w-full rounded-md border-gray-300"
            value={data.amount}
            onChange={(e) => setData('amount', e.target.value)}
            disabled={!isFixed}
          />
          {errors.amount ? <div className="mt-1 text-sm text-red-600">{errors.amount}</div> : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('ui.coupons.admin.percentage', 'Percentage')}
          </label>
          <input
            type="number"
            step="0.01"
            className="mt-1 w-full rounded-md border-gray-300"
            value={data.percentage}
            onChange={(e) => setData('percentage', e.target.value)}
            disabled={!isPercentage}
          />
          {errors.percentage ? <div className="mt-1 text-sm text-red-600">{errors.percentage}</div> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('ui.coupons.admin.minimum_subtotal', 'Minimum subtotal')}
          </label>
          <input
            type="number"
            step="0.01"
            className="mt-1 w-full rounded-md border-gray-300"
            value={data.minimum_subtotal_amount}
            onChange={(e) => setData('minimum_subtotal_amount', e.target.value)}
          />
          {errors.minimum_subtotal_amount ? (
            <div className="mt-1 text-sm text-red-600">{errors.minimum_subtotal_amount}</div>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('ui.coupons.admin.max_total_uses', 'Max total uses')}
          </label>
          <input
            type="number"
            className="mt-1 w-full rounded-md border-gray-300"
            value={data.max_total_uses}
            onChange={(e) => setData('max_total_uses', e.target.value)}
          />
          {errors.max_total_uses ? (
            <div className="mt-1 text-sm text-red-600">{errors.max_total_uses}</div>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('ui.coupons.admin.max_uses_per_user', 'Max uses per user')}
          </label>
          <input
            type="number"
            className="mt-1 w-full rounded-md border-gray-300"
            value={data.max_uses_per_user}
            onChange={(e) => setData('max_uses_per_user', e.target.value)}
          />
          {errors.max_uses_per_user ? (
            <div className="mt-1 text-sm text-red-600">{errors.max_uses_per_user}</div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('ui.coupons.admin.starts_at', 'Starts at')}
          </label>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-md border-gray-300"
            value={data.starts_at}
            onChange={(e) => setData('starts_at', e.target.value)}
          />
          {errors.starts_at ? <div className="mt-1 text-sm text-red-600">{errors.starts_at}</div> : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('ui.coupons.admin.ends_at', 'Ends at')}
          </label>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-md border-gray-300"
            value={data.ends_at}
            onChange={(e) => setData('ends_at', e.target.value)}
          />
          {errors.ends_at ? <div className="mt-1 text-sm text-red-600">{errors.ends_at}</div> : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="is_active"
          type="checkbox"
          checked={!!data.is_active}
          onChange={(e) => setData('is_active', e.target.checked)}
          className="rounded border-gray-300"
        />
        <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
          {t('ui.coupons.admin.is_active', 'Active')}
        </label>
      </div>

      {isEdit && data.total_uses !== undefined ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {t('ui.coupons.admin.total_uses', 'Total uses')}: <strong>{data.total_uses}</strong>
        </div>
      ) : null}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={processing}
          className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {submitLabel}
        </button>

        <Link
          href={route('admin.coupons.index', { locale })}
          className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          {t('ui.common.cancel', 'Cancel')}
        </Link>
      </div>
    </form>
  );
}

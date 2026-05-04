import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';
import CouponForm from './Partials/CouponForm';

export default function AdminCouponsEdit() {
  const { locale, coupon } = usePage().props;
  const { t } = useI18n();

  const { data, setData, put, processing, errors } = useForm({
    code: coupon.code ?? '',
    name: coupon.name ?? '',
    type: coupon.type ?? 'fixed_amount',
    amount: coupon.amount ?? '',
    percentage: coupon.percentage ?? '',
    minimum_subtotal_amount: coupon.minimum_subtotal_amount ?? '0.00',
    max_total_uses: coupon.max_total_uses ?? '',
    max_uses_per_user: coupon.max_uses_per_user ?? '',
    total_uses: coupon.total_uses ?? 0,
    is_active: !!coupon.is_active,
    starts_at: coupon.starts_at ?? '',
    ends_at: coupon.ends_at ?? '',
  });

  function submit(e) {
    e.preventDefault();
    put(route('admin.coupons.update', { locale, coupon: coupon.id }));
  }

  return (
    <AuthenticatedLayout
      header={
        <h2 className="text-xl font-semibold leading-tight text-gray-800">
          {t('ui.coupons.admin.edit', 'Edit coupon')}
        </h2>
      }
    >
      <Head title={t('ui.coupons.admin.edit', 'Edit coupon')} />

      <div className="py-6">
        <div className="mx-auto max-w-4xl sm:px-6 lg:px-8">
          <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
            <div className="p-6">
              <CouponForm
                locale={locale}
                data={data}
                setData={setData}
                errors={errors}
                processing={processing}
                submitLabel={t('ui.common.save_changes', 'Save changes')}
                onSubmit={submit}
                isEdit
              />
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

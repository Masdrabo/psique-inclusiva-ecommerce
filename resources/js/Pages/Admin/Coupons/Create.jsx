import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';
import CouponForm from './Partials/CouponForm';

export default function AdminCouponsCreate() {
  const { locale } = usePage().props;
  const { t } = useI18n();

  const { data, setData, post, processing, errors } = useForm({
    code: '',
    name: '',
    type: 'fixed_amount',
    amount: '',
    percentage: '',
    minimum_subtotal_amount: '0.00',
    max_total_uses: '',
    max_uses_per_user: '',
    is_active: true,
    starts_at: '',
    ends_at: '',
  });

  function submit(e) {
    e.preventDefault();
    post(route('admin.coupons.store', { locale }));
  }

  return (
    <AuthenticatedLayout
      header={
        <h2 className="text-xl font-semibold leading-tight text-gray-800">
          {t('ui.coupons.admin.create', 'New coupon')}
        </h2>
      }
    >
      <Head title={t('ui.coupons.admin.create', 'New coupon')} />

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
                submitLabel={t('ui.common.save', 'Save')}
                onSubmit={submit}
              />
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

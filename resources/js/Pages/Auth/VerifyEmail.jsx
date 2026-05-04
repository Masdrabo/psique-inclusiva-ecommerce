import PrimaryButton from '@/Components/PrimaryButton';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

export default function VerifyEmail({ status }) {
    const { locale } = usePage().props;
    const { t } = useI18n();

    const { post, processing } = useForm({});

    const submit = (e) => {
        e.preventDefault();
        post(route('verification.send', { locale }));
    };

    return (
        <GuestLayout>
            <Head title={t('ui.auth.verify_title')} />

            <div className="mb-4 text-sm text-gray-600">
                {t('ui.auth.verify_intro')}
            </div>

            {status === 'verification-link-sent' && (
                <div className="mb-4 text-sm font-medium text-green-600">
                    {t('ui.auth.verify_sent')}
                </div>
            )}

            <form onSubmit={submit}>
                <div className="mt-4 flex items-center justify-between">
                    <PrimaryButton disabled={processing}>
                        {t('ui.auth.verify_resend')}
                    </PrimaryButton>

                    <Link
                        href={route('logout', { locale })}
                        method="post"
                        as="button"
                        className="rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        {t('ui.common.logout')}
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}

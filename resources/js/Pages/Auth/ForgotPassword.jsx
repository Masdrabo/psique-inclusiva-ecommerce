import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

export default function ForgotPassword({ status }) {
    const { locale } = usePage().props;
    const { t } = useI18n();

    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('password.email', { locale }));
    };

    return (
        <GuestLayout>
            <Head title={t('ui.auth.forgot_title')} />

            <div className="mb-4 text-sm text-gray-600">
                {t('ui.auth.forgot_intro')}
            </div>

            {status && (
                <div className="mb-4 text-sm font-medium text-green-600">
                    {status}
                </div>
            )}

            <form onSubmit={submit}>
                <div>
                    <InputLabel htmlFor="email" value={t('ui.auth.email')} />

                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1 block w-full"
                        autoComplete="username"
                        isFocused={true}
                        onChange={(e) => setData('email', e.target.value)}
                        required
                    />

                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <Link
                        href={route('login', { locale })}
                        className="rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        {t('ui.auth.back_to_login')}
                    </Link>

                    <PrimaryButton disabled={processing}>
                        {t('ui.auth.forgot_button')}
                    </PrimaryButton>
                </div>
            </form>
        </GuestLayout>
    );
}

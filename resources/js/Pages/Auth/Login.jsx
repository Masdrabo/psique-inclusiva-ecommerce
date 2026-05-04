import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

export default function Login({ status, canResetPassword }) {

    // ⭐ locale vem do Inertia
    const { locale } = usePage().props;

    // ⭐ i18n PRO helper
    const { t } = useI18n();

    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('login', { locale }), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>

            <Head title={t('ui.auth.login_title')} />

            {status && (
                <div className="mb-4 text-sm font-medium text-green-600">
                    {status}
                </div>
            )}

            <form onSubmit={submit}>

                <div>
                    <InputLabel
                        htmlFor="email"
                        value={t('ui.auth.email')}
                    />

                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1 block w-full"
                        autoComplete="username"
                        isFocused={true}
                        onChange={(e) => setData('email', e.target.value)}
                    />

                    <InputError message={errors.email} className="mt-2" />
                </div>


                <div className="mt-4">
                    <InputLabel
                        htmlFor="password"
                        value={t('ui.auth.password')}
                    />

                    <TextInput
                        id="password"
                        type="password"
                        name="password"
                        value={data.password}
                        className="mt-1 block w-full"
                        autoComplete="current-password"
                        onChange={(e) => setData('password', e.target.value)}
                    />

                    <InputError message={errors.password} className="mt-2" />
                </div>


                <div className="mt-4 block">
                    <label className="flex items-center">
                        <Checkbox
                            name="remember"
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                        />
                        <span className="ms-2 text-sm text-gray-600">
                            {t('ui.auth.remember_me')}
                        </span>
                    </label>
                </div>


                <div className="mt-4 flex items-center justify-end">

                    {canResetPassword && (
                        <Link
                            href={route('password.request', { locale })}
                            className="rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                            {t('ui.auth.forgot_password')}
                        </Link>
                    )}

                    <PrimaryButton className="ms-4" disabled={processing}>
                        {t('ui.auth.login_button')}
                    </PrimaryButton>

                </div>

            </form>

        </GuestLayout>
    );
}

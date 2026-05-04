import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

export default function Register() {

    const { locale } = usePage().props;
    const { t } = useI18n();

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('register', { locale }), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <GuestLayout>

            <Head title={t('ui.auth.register_title')} />

            <form onSubmit={submit}>

                <div>
                    <InputLabel
                        htmlFor="name"
                        value={t('ui.auth.name')}
                    />

                    <TextInput
                        id="name"
                        name="name"
                        value={data.name}
                        className="mt-1 block w-full"
                        autoComplete="name"
                        isFocused={true}
                        onChange={(e) => setData('name', e.target.value)}
                        required
                    />

                    <InputError message={errors.name} className="mt-2" />
                </div>


                <div className="mt-4">
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
                        onChange={(e) => setData('email', e.target.value)}
                        required
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
                        autoComplete="new-password"
                        onChange={(e) => setData('password', e.target.value)}
                        required
                    />

                    <InputError message={errors.password} className="mt-2" />
                </div>


                <div className="mt-4">
                    <InputLabel
                        htmlFor="password_confirmation"
                        value={t('ui.auth.confirm_password')}
                    />

                    <TextInput
                        id="password_confirmation"
                        type="password"
                        name="password_confirmation"
                        value={data.password_confirmation}
                        className="mt-1 block w-full"
                        autoComplete="new-password"
                        onChange={(e) =>
                            setData('password_confirmation', e.target.value)
                        }
                        required
                    />

                    <InputError
                        message={errors.password_confirmation}
                        className="mt-2"
                    />
                </div>


                <div className="mt-4 flex items-center justify-end">

                    <Link
                        href={route('login', { locale })}
                        className="rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        {t('ui.auth.already_registered')}
                    </Link>

                    <PrimaryButton className="ms-4" disabled={processing}>
                        {t('ui.auth.register_button')}
                    </PrimaryButton>

                </div>

            </form>

        </GuestLayout>
    );
}

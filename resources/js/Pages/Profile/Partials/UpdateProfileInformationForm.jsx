import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

export default function UpdateProfileInformationForm({
    mustVerifyEmail,
    status,
    className = '',
}) {
    const { auth, locale } = usePage().props;
    const user = auth?.user;

    const { t } = useI18n();

    const { data, setData, patch, errors, processing, recentlySuccessful } =
        useForm({
            name: user?.name ?? '',
            email: user?.email ?? '',
        });

    const submit = (e) => {
        e.preventDefault();
        patch(route('profile.update', { locale }));
    };

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900">
                    {t('ui.profile.info_title', 'Profile information')}
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                    {t('ui.profile.info_subtitle', "Update your account's profile information and email address.")}
                </p>
            </header>

            <form onSubmit={submit} className="mt-6 space-y-6">
                <div>
                    <InputLabel htmlFor="name" value={t('ui.auth.name', 'Name')} />

                    <TextInput
                        id="name"
                        className="mt-1 block w-full"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        required
                        isFocused
                        autoComplete="name"
                    />

                    <InputError className="mt-2" message={errors.name} />
                </div>

                <div>
                    <InputLabel htmlFor="email" value={t('ui.auth.email', 'Email')} />

                    <TextInput
                        id="email"
                        type="email"
                        className="mt-1 block w-full"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        required
                        autoComplete="username"
                    />

                    <InputError className="mt-2" message={errors.email} />
                </div>

                {mustVerifyEmail && user?.email_verified_at === null && (
                    <div>
                        <p className="mt-2 text-sm text-gray-800">
                            {/* Podes criar keys específicas se quiseres, mas isto já fica traduzível */}
                            {t('ui.auth.verify_intro', 'Please verify your email address.')}{' '}
                            <Link
                                href={route('verification.send', { locale })}
                                method="post"
                                as="button"
                                className="rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            >
                                {t('ui.auth.verify_resend', 'Resend verification email')}
                            </Link>
                        </p>

                        {status === 'verification-link-sent' && (
                            <div className="mt-2 text-sm font-medium text-green-600">
                                {t('ui.auth.verify_sent', 'A new verification link has been sent to your email address.')}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <PrimaryButton disabled={processing}>
                        {t('ui.common.save', 'Save')}
                    </PrimaryButton>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm text-gray-600">
                            {t('ui.profile.saved', 'Saved.')}
                        </p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}

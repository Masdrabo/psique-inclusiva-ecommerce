import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { useForm, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

export default function DeleteUserForm({ className = '' }) {

    const { locale } = usePage().props;
    const { t } = useI18n();

    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const passwordInput = useRef(null);

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: '',
    });

    const confirmUserDeletion = () => {
        setConfirmingUserDeletion(true);
    };

    const deleteUser = (e) => {
        e.preventDefault();

        destroy(route('profile.destroy', { locale }), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current?.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);
        clearErrors();
        reset();
    };

    return (
        <section className={`space-y-6 ${className}`}>

            <header>
                <h2 className="text-lg font-medium text-gray-900">
                    {t('ui.profile.delete_title', 'Delete account')}
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                    {t(
                        'ui.profile.delete_subtitle',
                        'Once your account is deleted, all data will be permanently removed.'
                    )}
                </p>
            </header>

            <DangerButton onClick={confirmUserDeletion}>
                {t('ui.profile.delete_title', 'Delete account')}
            </DangerButton>


            <Modal show={confirmingUserDeletion} onClose={closeModal}>
                <form onSubmit={deleteUser} className="p-6">

                    <h2 className="text-lg font-medium text-gray-900">
                        {t(
                            'ui.profile.delete_confirm_title',
                            'Are you sure you want to delete your account?'
                        )}
                    </h2>

                    <p className="mt-1 text-sm text-gray-600">
                        {t(
                            'ui.profile.delete_confirm_text',
                            'This action is permanent. Enter your password to confirm.'
                        )}
                    </p>

                    <div className="mt-6">
                        <InputLabel
                            htmlFor="password"
                            value={t('ui.auth.password', 'Password')}
                            className="sr-only"
                        />

                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            ref={passwordInput}
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            className="mt-1 block w-3/4"
                            isFocused
                            placeholder={t('ui.auth.password', 'Password')}
                        />

                        <InputError message={errors.password} className="mt-2" />
                    </div>

                    <div className="mt-6 flex justify-end">

                        <SecondaryButton onClick={closeModal}>
                            {t('ui.common.cancel', 'Cancel')}
                        </SecondaryButton>

                        <DangerButton className="ms-3" disabled={processing}>
                            {t('ui.profile.delete_title', 'Delete account')}
                        </DangerButton>

                    </div>

                </form>
            </Modal>

        </section>
    );
}

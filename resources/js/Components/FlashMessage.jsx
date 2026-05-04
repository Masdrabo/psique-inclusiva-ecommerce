import { usePage } from '@inertiajs/react';

export default function FlashMessage() {
    const { flash, errors } = usePage().props;

    const success = flash?.success;
    const error = flash?.error;

    // se quiseres mostrar erro geral vindo de validation
    const generalError =
        errors?.message ||
        errors?.error ||
        null;

    const message = success || error || generalError;
    if (!message) return null;

    const isSuccess = !!success && !error && !generalError;

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
            <div
                className={
                    "rounded-lg border p-4 text-sm shadow-sm " +
                    (isSuccess
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-red-200 bg-red-50 text-red-800")
                }
                role="alert"
            >
                {message}
            </div>
        </div>
    );
}

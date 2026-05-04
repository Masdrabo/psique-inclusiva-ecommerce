import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

function PurposeIcon({ children }) {
    return (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            {children}
        </div>
    );
}

function ContactIcon({ children }) {
    return (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            {children}
        </div>
    );
}

export default function Purpose() {
    const { t } = useI18n();

    const valueItems = [
        {
            key: 'mission',
            title: t('ui.purpose.mission_title', {}, 'Missão'),
            text: t(
                'ui.purpose.mission_text',
                {},
                'Apoiar as pessoas com experiência de doença mental no empoderamento, autodeterminação e autonomia, promovendo o desenvolvimento do seu projeto pessoal de vida. Trabalhamos para facilitar a aquisição de competências e o acesso aos recursos necessários, contribuindo para uma vida plena nos contextos de viver, trabalhar, aprender e socializar. Envolvemos também familiares e rede social, promovendo o diálogo e a participação ativa de todos.'
            ),
            icon: (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-6 w-6"
                >
                    <path d="M12 2a1 1 0 0 1 .894.553l2.17 4.398 4.856.706a1 1 0 0 1 .554 1.706l-3.513 3.425.83 4.836a1 1 0 0 1-1.45 1.054L12 16.347l-4.34 2.281a1 1 0 0 1-1.45-1.054l.83-4.836-3.513-3.425a1 1 0 0 1 .554-1.706l4.856-.706 2.17-4.398A1 1 0 0 1 12 2Z" />
                </svg>
            ),
        },
        {
            key: 'purpose',
            title: t('ui.purpose.vision_title', {}, 'Propósito'),
            text: t(
                'ui.purpose.vision_text',
                {},
                'Contribuir, através de práticas inovadoras em Saúde Mental, para a construção de uma sociedade mais inclusiva, livre de estigma e acolhedora para todas as pessoas com experiência de doença mental.'
            ),
            icon: (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-6 w-6"
                >
                    <path d="M12 3C7 3 2.73 6.11 1 10.5 2.73 14.89 7 18 12 18s9.27-3.11 11-7.5C21.27 6.11 17 3 12 3Zm0 12a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                    <path d="M5 21a1 1 0 0 1 0-2h14a1 1 0 1 1 0 2H5Z" />
                </svg>
            ),
        },
        {
            key: 'values',
            title: t('ui.purpose.values_title', {}, 'Valores'),
            text: t(
                'ui.purpose.values_text',
                {},
                'Transparência, Humildade, Colaboração.'
            ),
            icon: (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-6 w-6"
                >
                    <path d="M12 21a1 1 0 0 1-.707-.293l-6.5-6.5a4.5 4.5 0 1 1 6.364-6.364L12 8.686l.843-.843a4.5 4.5 0 1 1 6.364 6.364l-6.5 6.5A1 1 0 0 1 12 21Z" />
                </svg>
            ),
        },
    ];

    const impactItems = [
        t(
            'ui.purpose.impact_item_one',
            {},
            'Promover uma comunidade mais informada, consciente e próxima da saúde mental.'
        ),
        t(
            'ui.purpose.impact_item_two',
            {},
            'Criar pontes entre pessoas, projetos, serviços e respostas com valor social.'
        ),
        t(
            'ui.purpose.impact_item_three',
            {},
            'Dar visibilidade a iniciativas com propósito, inclusão e impacto positivo.'
        ),
    ];

    const emailItems = [
        {
            label: t('ui.purpose.contacts_email_label_general', {}, 'Geral'),
            value: t('ui.purpose.contacts_email_general', {}, 'geral@mentemovimento.pt'),
        },
        {
            label: t('ui.purpose.contacts_email_label_shop', {}, 'Loja online'),
            value: t(
                'ui.purpose.contacts_email_shop',
                {},
                'contacto@psiqueinclusiva.pt'
            ),
        },
        {
            label: t(
                'ui.purpose.contacts_email_label_technical',
                {},
                'Direção técnica'
            ),
            value: t(
                'ui.purpose.contacts_email_technical',
                {},
                'direcaotecnica@mentemovimento.pt'
            ),
        },
        {
            label: t(
                'ui.purpose.contacts_email_label_board',
                {},
                'Presidente Direção'
            ),
            value: t('ui.purpose.contacts_email_board', {}, 'direcao@mentemovimento.pt'),
        },
    ];

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-gray-800">
                        {t('ui.nav.purpose', {}, 'Propósito')}
                    </h2>
                </div>
            }
        >
            <Head title={t('ui.nav.purpose', {}, 'Propósito')} />

            <div className="py-8 sm:py-10">
                <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
                    <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-xl">
                        <div className="grid gap-8 px-6 py-10 text-white sm:px-8 lg:grid-cols-[1.3fr_0.7fr] lg:px-10 lg:py-14">
                            <div>
                                <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                                    {t('ui.purpose.hero_badge', {}, 'MenteMovimento')}
                                </span>

                                <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
                                    {t(
                                        'ui.purpose.hero_title',
                                        {},
                                        'Um projeto com propósito humano, social e transformador'
                                    )}
                                </h1>

                                <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50 sm:text-base">
                                    {t(
                                        'ui.purpose.hero_text',
                                        {},
                                        'A MenteMovimento nasce da vontade de criar impacto positivo através da inclusão, da proximidade e da valorização da saúde mental, das pessoas e da comunidade.'
                                    )}
                                </p>
                            </div>

                            <div className="flex items-center justify-center">
                                <div className="w-full rounded-3xl bg-white/10 p-6 backdrop-blur-sm">
                                    <div className="space-y-4">
                                        <div className="rounded-2xl bg-white/10 p-4">
                                            <div className="text-sm font-semibold uppercase tracking-wide text-emerald-100">
                                                {t(
                                                    'ui.purpose.hero_box_label_one',
                                                    {},
                                                    'Compromisso'
                                                )}
                                            </div>
                                            <div className="mt-2 text-base font-medium text-white">
                                                {t(
                                                    'ui.purpose.hero_box_text_one',
                                                    {},
                                                    'Cuidar, incluir e aproximar.'
                                                )}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl bg-white/10 p-4">
                                            <div className="text-sm font-semibold uppercase tracking-wide text-emerald-100">
                                                {t('ui.purpose.hero_box_label_two', {}, 'Foco')}
                                            </div>
                                            <div className="mt-2 text-base font-medium text-white">
                                                {t(
                                                    'ui.purpose.hero_box_text_two',
                                                    {},
                                                    'Pessoas, dignidade e impacto real.'
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section
                        id="sobre-nos"
                        className="scroll-mt-24 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8"
                    >
                        <div className="max-w-6xl">
                            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                                {t('ui.purpose.who_we_are_title', {}, 'Quem somos')}
                            </h2>

                            <p className="mt-4 text-base leading-8 text-gray-600">
                                {t(
                                    'ui.purpose.who_we_are_text',
                                    {},
                                    'A MenteMovimento – Associação Pró-Saúde Mental de Entre Douro e Vouga é uma Instituição Particular de Solidariedade Social, de utilidade pública, sem fins lucrativos, fundada com o objetivo de prestar apoio, formação, intervenção, avaliação e investigação no domínio da saúde mental e da reabilitação psicossocial das pessoas com experiência de doença mental e seus familiares/cuidadores.'
                                )}
                            </p>
                        </div>
                    </section>

                    <section className="grid gap-6 lg:grid-cols-3">
                        {valueItems.map((item) => (
                            <div
                                key={item.key}
                                className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8"
                            >
                                <PurposeIcon>{item.icon}</PurposeIcon>

                                <h3 className="mt-5 text-2xl font-semibold text-gray-900">
                                    {item.title}
                                </h3>

                                <p className="mt-4 text-base leading-7 text-gray-600">
                                    {item.text}
                                </p>
                            </div>
                        ))}
                    </section>

                    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
                        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                                    {t(
                                        'ui.purpose.impact_title',
                                        {},
                                        'O impacto que queremos criar'
                                    )}
                                </h2>

                                <p className="mt-4 text-base leading-8 text-gray-600">
                                    {t(
                                        'ui.purpose.impact_text',
                                        {},
                                        'Mais do que uma presença digital, este projeto pretende ser um ponto de ligação entre propósito, comunidade, inclusão e bem-estar.'
                                    )}
                                </p>
                            </div>

                            <div className="space-y-4">
                                {impactItems.map((item, index) => (
                                    <div
                                        key={index}
                                        className="flex items-start gap-4 rounded-2xl bg-emerald-50 p-4"
                                    >
                                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                                            {index + 1}
                                        </div>

                                        <p className="text-sm leading-7 text-gray-700 sm:text-base">
                                            {item}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section
                        id="contactos"
                        className="scroll-mt-24 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8"
                    >
                        <div className="max-w-5xl">
                            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                                {t('ui.purpose.contacts_title', {}, 'Contactos')}
                            </h2>

                            <p className="mt-4 text-base leading-8 text-gray-600">
                                {t(
                                    'ui.purpose.contacts_text',
                                    {},
                                    'Se precisares de esclarecer dúvidas, pedir informações ou entrar em contacto com a equipa, podes usar os contactos abaixo.'
                                )}
                            </p>
                        </div>

                        <div className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.15fr_0.9fr]">
                            <div className="space-y-6">
                                <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                                    <ContactIcon>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            className="h-6 w-6"
                                        >
                                            <path d="M12 2a7 7 0 0 0-7 7c0 4.95 5.12 10.76 6.38 12.1a1 1 0 0 0 1.45 0C13.88 19.76 19 13.95 19 9a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
                                        </svg>
                                    </ContactIcon>

                                    <h3 className="mt-5 text-xl font-semibold text-gray-900">
                                        {t('ui.purpose.contacts_address_title', {}, 'Morada')}
                                    </h3>

                                    <p className="mt-4 text-base leading-7 text-gray-600">
                                        {t(
                                            'ui.purpose.contacts_address_text',
                                            {},
                                            'Praça Barbezieux, 2359, 3700-055 S. João da Madeira'
                                        )}
                                    </p>
                                </div>

                                <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                                    <ContactIcon>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            className="h-6 w-6"
                                        >
                                            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 6.1 10.96 7.2 11.95a1.2 1.2 0 0 0 1.6 0C13.9 20.96 20 15.25 20 10a8 8 0 0 0-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
                                        </svg>
                                    </ContactIcon>

                                    <h3 className="mt-5 text-xl font-semibold text-gray-900">
                                        {t(
                                            'ui.purpose.contacts_coordinates_title',
                                            {},
                                            'Localização'
                                        )}
                                    </h3>

                                    <p className="mt-4 text-base leading-7 text-gray-600">
                                        {t(
                                            'ui.purpose.contacts_coordinates_text',
                                            {},
                                            '40.895577, -8.500298'
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div
                                id="emails"
                                className="scroll-mt-24 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
                            >
                                <ContactIcon>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="h-6 w-6"
                                    >
                                        <path d="M4 5a2 2 0 0 0-2 2v.217l10 5.714 10-5.714V7a2 2 0 0 0-2-2H4Z" />
                                        <path d="M22 9.383 12.496 14.81a1 1 0 0 1-.992 0L2 9.383V17a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9.383Z" />
                                    </svg>
                                </ContactIcon>

                                <h3 className="mt-5 text-xl font-semibold text-gray-900">
                                    {t('ui.purpose.contacts_emails_title', {}, 'Emails')}
                                </h3>

                                <div className="mt-4 space-y-3 text-base text-gray-600">
                                    {emailItems.map((item) => (
                                        <div
                                            key={item.label}
                                            className="rounded-2xl bg-emerald-50 p-4"
                                        >
                                            <div className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                                                {item.label}
                                            </div>
                                            <div className="mt-1 break-all">
                                                {item.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                                    <ContactIcon>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            className="h-6 w-6"
                                        >
                                            <path d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.85 21 3 13.15 3 4a1 1 0 0 1 1-1h3.49a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.24 1.02l-2.2 2.2Z" />
                                        </svg>
                                    </ContactIcon>

                                    <h3 className="mt-5 text-xl font-semibold text-gray-900">
                                        {t('ui.purpose.contacts_phone_title', {}, 'Telefone')}
                                    </h3>

                                    <p className="mt-4 text-base leading-7 text-gray-600">
                                        {t(
                                            'ui.purpose.contacts_phone_text',
                                            {},
                                            '962146424'
                                        )}
                                    </p>
                                </div>

                                <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                                    <ContactIcon>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            className="h-6 w-6"
                                        >
                                            <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12 8H5v8h14v-8Zm-7-3a1 1 0 0 1 1 1v3.382l1.447.964a1 1 0 0 1-1.11 1.664l-1.89-1.26A1 1 0 0 1 11 12V8a1 1 0 0 1 1-1Z" />
                                        </svg>
                                    </ContactIcon>

                                    <h3 className="mt-5 text-xl font-semibold text-gray-900">
                                        {t(
                                            'ui.purpose.contacts_schedule_title',
                                            {},
                                            'Horário de funcionamento'
                                        )}
                                    </h3>

                                    <div className="mt-4 whitespace-pre-line text-base leading-7 text-gray-600">
                                        {t(
                                            'ui.purpose.contacts_schedule_text',
                                            {},
                                            'Unidade Sócio-Ocupacional\nDias úteis\n9:00 – 12:30 | 13:30 – 17:00'
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Transition } from '@headlessui/react';

export default function Edit({ adminProfile = null }) {
    const { auth } = usePage().props;
    const user = auth.user;

    const { data, setData, patch, processing, errors, recentlySuccessful } =
        useForm({
            username: user.username ?? '',
            email: user.email ?? '',
            admin_code: adminProfile?.admin_code ?? '',
            first_name: adminProfile?.first_name ?? '',
            middle_name: adminProfile?.middle_name ?? '',
            last_name: adminProfile?.last_name ?? '',
            suffix_name: adminProfile?.suffix_name ?? '',
            phone: adminProfile?.phone ?? '',
            position_title: adminProfile?.position_title ?? '',
            employment_type: adminProfile?.employment_type ?? '',
            date_hired: adminProfile?.date_hired ?? '',
        });

    const submit = (event) => {
        event.preventDefault();

        patch(route('admin.profile.update'));
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    Admin Profile
                </h2>
            }
        >
            <Head title="Admin Profile" />

            <div className="py-12">
                <div className="mx-auto max-w-5xl space-y-6 sm:px-6 lg:px-8">
                    <form
                        onSubmit={submit}
                        className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-gray-700/60 dark:bg-gray-800"
                    >
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Profile Settings
                            </h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Update your account access details and admin credentials.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                                <InputLabel htmlFor="username" value="Username" />
                                <TextInput
                                    id="username"
                                    className="mt-1 block w-full"
                                    value={data.username}
                                    onChange={(event) => setData('username', event.target.value)}
                                    required
                                    autoComplete="username"
                                />
                                <InputError className="mt-2" message={errors.username} />
                            </div>

                            <div>
                                <InputLabel htmlFor="email" value="Email" />
                                <TextInput
                                    id="email"
                                    type="email"
                                    className="mt-1 block w-full"
                                    value={data.email}
                                    onChange={(event) => setData('email', event.target.value)}
                                    required
                                    autoComplete="email"
                                />
                                <InputError className="mt-2" message={errors.email} />
                            </div>

                            <div>
                                <InputLabel htmlFor="admin_code" value="Admin Code" />
                                <TextInput
                                    id="admin_code"
                                    className="mt-1 block w-full"
                                    value={data.admin_code}
                                    onChange={(event) => setData('admin_code', event.target.value)}
                                    required
                                />
                                <InputError className="mt-2" message={errors.admin_code} />
                            </div>

                            <div>
                                <InputLabel htmlFor="position_title" value="Position Title" />
                                <TextInput
                                    id="position_title"
                                    className="mt-1 block w-full"
                                    value={data.position_title}
                                    onChange={(event) =>
                                        setData('position_title', event.target.value)
                                    }
                                />
                                <InputError className="mt-2" message={errors.position_title} />
                            </div>

                            <div>
                                <InputLabel htmlFor="first_name" value="First Name" />
                                <TextInput
                                    id="first_name"
                                    className="mt-1 block w-full"
                                    value={data.first_name}
                                    onChange={(event) => setData('first_name', event.target.value)}
                                    required
                                />
                                <InputError className="mt-2" message={errors.first_name} />
                            </div>

                            <div>
                                <InputLabel htmlFor="middle_name" value="Middle Name" />
                                <TextInput
                                    id="middle_name"
                                    className="mt-1 block w-full"
                                    value={data.middle_name}
                                    onChange={(event) => setData('middle_name', event.target.value)}
                                />
                                <InputError className="mt-2" message={errors.middle_name} />
                            </div>

                            <div>
                                <InputLabel htmlFor="last_name" value="Last Name" />
                                <TextInput
                                    id="last_name"
                                    className="mt-1 block w-full"
                                    value={data.last_name}
                                    onChange={(event) => setData('last_name', event.target.value)}
                                    required
                                />
                                <InputError className="mt-2" message={errors.last_name} />
                            </div>

                            <div>
                                <InputLabel htmlFor="suffix_name" value="Suffix" />
                                <TextInput
                                    id="suffix_name"
                                    className="mt-1 block w-full"
                                    value={data.suffix_name}
                                    onChange={(event) => setData('suffix_name', event.target.value)}
                                />
                                <InputError className="mt-2" message={errors.suffix_name} />
                            </div>

                            <div>
                                <InputLabel htmlFor="phone" value="Phone" />
                                <TextInput
                                    id="phone"
                                    className="mt-1 block w-full"
                                    value={data.phone}
                                    onChange={(event) => setData('phone', event.target.value)}
                                    autoComplete="tel"
                                />
                                <InputError className="mt-2" message={errors.phone} />
                            </div>

                            <div>
                                <InputLabel
                                    htmlFor="employment_type"
                                    value="Employment Type"
                                />
                                <TextInput
                                    id="employment_type"
                                    className="mt-1 block w-full"
                                    value={data.employment_type}
                                    onChange={(event) =>
                                        setData('employment_type', event.target.value)
                                    }
                                />
                                <InputError
                                    className="mt-2"
                                    message={errors.employment_type}
                                />
                            </div>

                            <div>
                                <InputLabel htmlFor="date_hired" value="Date Hired" />
                                <TextInput
                                    id="date_hired"
                                    type="date"
                                    className="mt-1 block w-full"
                                    value={data.date_hired}
                                    onChange={(event) => setData('date_hired', event.target.value)}
                                />
                                <InputError className="mt-2" message={errors.date_hired} />
                            </div>
                        </div>

                        <div className="mt-8 flex items-center gap-4">
                            <PrimaryButton disabled={processing}>Save Changes</PrimaryButton>

                            <Transition
                                show={recentlySuccessful}
                                enter="transition ease-in-out"
                                enterFrom="opacity-0"
                                leave="transition ease-in-out"
                                leaveTo="opacity-0"
                            >
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Saved.
                                </p>
                            </Transition>
                        </div>
                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

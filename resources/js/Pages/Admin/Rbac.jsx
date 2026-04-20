import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import InputError from "@/Components/InputError";
import Modal from "@/Components/Modal";
import { Head, router, useForm } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";

function prettifyName(value) {
    return value
        .replaceAll("_", " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export default function Rbac({ roles, permissions, users }) {
    const permissionNames = useMemo(
        () => permissions.map((permission) => permission.name),
        [permissions],
    );

    const [editingRoleId, setEditingRoleId] = useState(null);
    const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
    const [showEditRoleModal, setShowEditRoleModal] = useState(false);
    const [showViewPermissionsModal, setShowViewPermissionsModal] = useState(false);
    const [showDeleteRoleModal, setShowDeleteRoleModal] = useState(false);
    const [viewingRole, setViewingRole] = useState(null);
    const [deletingRole, setDeletingRole] = useState(null);
    const [savingUserId, setSavingUserId] = useState(null);
    const [deletingRoleId, setDeletingRoleId] = useState(null);

    const [userRolesMap, setUserRolesMap] = useState(() => {
        const initial = {};
        users.forEach((user) => {
            initial[user.id] = user.roles.map((role) => role.name);
        });
        return initial;
    });

    useEffect(() => {
        const updated = {};
        users.forEach((user) => {
            updated[user.id] = user.roles.map((role) => role.name);
        });
        setUserRolesMap(updated);
    }, [users]);

    const createRoleForm = useForm({
        name: "",
        permissions: [],
    });

    const editRoleForm = useForm({
        name: "",
        permissions: [],
    });

    const sortedRoles = useMemo(
        () => [...roles].sort((a, b) => a.name.localeCompare(b.name)),
        [roles],
    );

    const selectedEditRole =
        sortedRoles.find((role) => role.id === editingRoleId) ?? null;

    const openCreateRoleModal = () => {
        createRoleForm.reset();
        createRoleForm.clearErrors();
        setShowCreateRoleModal(true);
    };

    const closeCreateRoleModal = () => {
        setShowCreateRoleModal(false);
        createRoleForm.clearErrors();
    };

    const openRoleEditor = (role) => {
        setEditingRoleId(role.id);
        editRoleForm.setData("name", role.name);
        editRoleForm.setData(
            "permissions",
            role.permissions.map((permission) => permission.name),
        );
        editRoleForm.clearErrors();
        setShowEditRoleModal(true);
    };

    const closeEditRoleModal = () => {
        setShowEditRoleModal(false);
        setEditingRoleId(null);
        editRoleForm.reset();
        editRoleForm.clearErrors();
    };

    const openViewPermissionsModal = (role) => {
        setViewingRole(role);
        setShowViewPermissionsModal(true);
    };

    const closeViewPermissionsModal = () => {
        setShowViewPermissionsModal(false);
        setViewingRole(null);
    };

    const openDeleteRoleModal = (role) => {
        setDeletingRole(role);
        setShowDeleteRoleModal(true);
    };

    const closeDeleteRoleModal = () => {
        setShowDeleteRoleModal(false);
        setDeletingRole(null);
    };

    const handlePermissionToggle = (form, permissionName) => {
        const selected = form.data.permissions;
        const hasPermission = selected.includes(permissionName);

        form.setData(
            "permissions",
            hasPermission
                ? selected.filter((name) => name !== permissionName)
                : [...selected, permissionName],
        );
    };

    const submitCreateRole = (event) => {
        event.preventDefault();
        createRoleForm.post(route("admin.rbac.roles.store"), {
            preserveScroll: true,
            onSuccess: () => {
                createRoleForm.reset();
                setShowCreateRoleModal(false);
            },
        });
    };

    const submitEditRole = (event) => {
        event.preventDefault();
        if (!selectedEditRole) {
            return;
        }

        editRoleForm.put(route("admin.rbac.roles.update", selectedEditRole.id), {
            preserveScroll: true,
            onSuccess: () => {
                closeEditRoleModal();
                editRoleForm.reset();
            },
        });
    };

    const toggleUserRole = (userId, roleName) => {
        setUserRolesMap((previous) => {
            const currentRoles = previous[userId] ?? [];
            const nextRoles = currentRoles.includes(roleName)
                ? currentRoles.filter((name) => name !== roleName)
                : [...currentRoles, roleName];

            return {
                ...previous,
                [userId]: nextRoles,
            };
        });
    };

    const saveUserRoles = (userId) => {
        setSavingUserId(userId);

        router.put(
            route("admin.rbac.users.roles.update", userId),
            { roles: userRolesMap[userId] ?? [] },
            {
                preserveScroll: true,
                onFinish: () => setSavingUserId(null),
            },
        );
    };

    const deleteRole = () => {
        if (!deletingRole) {
            return;
        }

        setDeletingRoleId(deletingRole.id);
        router.delete(route("admin.rbac.roles.destroy", deletingRole.id), {
            preserveScroll: true,
            onFinish: () => {
                setDeletingRoleId(null);
            },
            onSuccess: () => {
                closeDeleteRoleModal();
            },
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="RBAC" />

            <section className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-[#7a1315] via-[#95191d] to-[#cc2127] px-6 py-10 sm:px-10 sm:py-12 shadow-xl shadow-red-900/25">
                <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
                <div className="pointer-events-none absolute -right-8 -bottom-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                <div className="relative">
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/75">
                        Super Admin Area
                    </p>
                    <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                        Role Based Access Control
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm text-white/80 sm:text-base">
                        Manage permissions, create and edit roles, and update user role assignments in one place.
                    </p>
                </div>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-3">
                <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Roles
                    </p>
                    <p className="mt-2 text-4xl font-black text-gray-900 dark:text-white">
                        {roles.length}
                    </p>
                </article>

                <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Permissions
                    </p>
                    <p className="mt-2 text-4xl font-black text-gray-900 dark:text-white">
                        {permissions.length}
                    </p>
                </article>

                <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Admin Users
                    </p>
                    <p className="mt-2 text-4xl font-black text-gray-900 dark:text-white">
                        {users.length}
                    </p>
                </article>
            </section>

            <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            Role Management
                        </h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Add or edit roles using the modal actions below.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={openCreateRoleModal}
                        className="inline-flex rounded-xl bg-[#7a1315] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#8f181c]"
                    >
                        Add Role
                    </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sortedRoles.map((role) => (
                        <article
                            key={role.id}
                            className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                                        {prettifyName(role.name)}
                                    </h3>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {role.permissions.length} permission(s)
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {role.users_count ?? 0} user(s)
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openViewPermissionsModal(role)}
                                        className="rounded-lg border border-blue-300 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                                    >
                                        View
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openRoleEditor(role)}
                                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openDeleteRoleModal(role)}
                                        disabled={role.name === "super_admin"}
                                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
                <header className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        User Role Assignment
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Assign roles per admin user. Saving a row updates that user immediately.
                    </p>
                </header>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50/90 dark:bg-gray-900/40">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                    User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                    Roles
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {users.map((user) => (
                                <tr key={user.id} className="align-top">
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {user.display_name}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {user.email}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {sortedRoles.map((role) => (
                                                <label
                                                    key={`${user.id}-${role.id}`}
                                                    className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-sm text-gray-700 dark:bg-gray-700/40 dark:text-gray-200"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-gray-300 text-[#7a1315] focus:ring-[#7a1315]"
                                                        checked={(
                                                            userRolesMap[user.id] ?? []
                                                        ).includes(role.name)}
                                                        onChange={() =>
                                                            toggleUserRole(
                                                                user.id,
                                                                role.name,
                                                            )
                                                        }
                                                    />
                                                    <span>{role.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            type="button"
                                            onClick={() => saveUserRoles(user.id)}
                                            disabled={savingUserId === user.id}
                                            className="inline-flex rounded-xl bg-[#7a1315] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow hover:bg-[#8f181c] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {savingUserId === user.id
                                                ? "Saving..."
                                                : "Save User Roles"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <Modal
                show={showCreateRoleModal}
                onClose={closeCreateRoleModal}
                maxWidth="4xl"
            >
                <div className="flex max-h-[86dvh] min-h-0 flex-col">
                    <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Add Role
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Set a role name and select permissions.
                        </p>
                    </div>

                    <form onSubmit={submitCreateRole} className="flex min-h-0 flex-1 flex-col">
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                            <div>
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Role Name
                                </label>
                                <input
                                    type="text"
                                    value={createRoleForm.data.name}
                                    onChange={(event) =>
                                        createRoleForm.setData(
                                            "name",
                                            event.target.value,
                                        )
                                    }
                                    placeholder="e.g. registrar_staff"
                                    className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                />
                                <InputError
                                    message={createRoleForm.errors.name}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Permissions
                                </label>
                                <div className="mt-2 grid grid-cols-1 gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-2 dark:border-gray-700">
                                    {permissionNames.map((permissionName) => (
                                        <label
                                            key={`create-${permissionName}`}
                                            className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-sm text-gray-700 dark:bg-gray-700/40 dark:text-gray-200"
                                        >
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-[#7a1315] focus:ring-[#7a1315]"
                                                checked={createRoleForm.data.permissions.includes(
                                                    permissionName,
                                                )}
                                                onChange={() =>
                                                    handlePermissionToggle(
                                                        createRoleForm,
                                                        permissionName,
                                                    )
                                                }
                                            />
                                            <span>{permissionName}</span>
                                        </label>
                                    ))}
                                </div>
                                <InputError
                                    message={createRoleForm.errors.permissions}
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={closeCreateRoleModal}
                                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/40"
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                disabled={createRoleForm.processing}
                                className="inline-flex rounded-xl bg-[#7a1315] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#8f181c] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {createRoleForm.processing
                                    ? "Saving..."
                                    : "Add Role"}
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>

            <Modal
                show={showEditRoleModal}
                onClose={closeEditRoleModal}
                maxWidth="4xl"
            >
                <div className="flex max-h-[86dvh] min-h-0 flex-col">
                    <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Edit Role
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Update role details and permissions.
                        </p>
                    </div>

                    {selectedEditRole ? (
                        <form onSubmit={submitEditRole} className="flex min-h-0 flex-1 flex-col">
                            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Role Name
                                    </label>
                                    <input
                                        type="text"
                                        value={editRoleForm.data.name}
                                        onChange={(event) =>
                                            editRoleForm.setData(
                                                "name",
                                                event.target.value,
                                            )
                                        }
                                        className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#7a1315] focus:ring-[#7a1315] dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                    />
                                    <InputError
                                        message={editRoleForm.errors.name}
                                        className="mt-1"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Permissions
                                    </label>
                                    <div className="mt-2 grid grid-cols-1 gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-2 dark:border-gray-700">
                                        {permissionNames.map((permissionName) => (
                                            <label
                                                key={`edit-${permissionName}`}
                                                className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-sm text-gray-700 dark:bg-gray-700/40 dark:text-gray-200"
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-gray-300 text-[#7a1315] focus:ring-[#7a1315]"
                                                    checked={editRoleForm.data.permissions.includes(
                                                        permissionName,
                                                    )}
                                                    onChange={() =>
                                                        handlePermissionToggle(
                                                            editRoleForm,
                                                            permissionName,
                                                        )
                                                    }
                                                />
                                                <span>{permissionName}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <InputError
                                        message={editRoleForm.errors.permissions}
                                        className="mt-1"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={closeEditRoleModal}
                                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/40"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={editRoleForm.processing}
                                    className="inline-flex rounded-xl bg-[#7a1315] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#8f181c] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {editRoleForm.processing
                                        ? "Updating..."
                                        : "Update Role"}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="p-6">
                            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                                Select a role first.
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                show={showViewPermissionsModal}
                onClose={closeViewPermissionsModal}
                maxWidth="3xl"
            >
                <div className="flex max-h-[86dvh] min-h-0 flex-col">
                    <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            View
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {viewingRole ? prettifyName(viewingRole.name) : "Role"}
                        </p>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                        {viewingRole && viewingRole.permissions.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {viewingRole.permissions.map((permission) => (
                                    <div
                                        key={`view-${viewingRole.id}-${permission.id}`}
                                        className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-700/40 dark:text-gray-200"
                                    >
                                        {permission.name}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                                This role has no permissions assigned.
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-start border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={closeViewPermissionsModal}
                            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/40"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                show={showDeleteRoleModal}
                onClose={closeDeleteRoleModal}
                maxWidth="md"
            >
                <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Delete Role
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        Delete role
                        {" "}
                        <span className="font-semibold">
                            {deletingRole ? prettifyName(deletingRole.name) : ""}
                        </span>
                        ?
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Users currently assigned: {deletingRole?.users_count ?? 0}
                    </p>

                    <div className="mt-6 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={closeDeleteRoleModal}
                            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/40"
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            onClick={deleteRole}
                            disabled={deletingRoleId === deletingRole?.id}
                            className="inline-flex rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {deletingRoleId === deletingRole?.id
                                ? "Deleting..."
                                : "Delete Role"}
                        </button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}

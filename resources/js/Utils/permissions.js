export function hasPermission(userPermissions, required) {
    const permissions = Array.isArray(userPermissions) ? userPermissions : [];

    if (!required) {
        return true;
    }

    const requiredList = Array.isArray(required) ? required : [required];

    return requiredList.some((permission) => permissions.includes(permission));
}

<?php

namespace App\Enums;

enum Role: string
{
    // ── Admin-guard roles ──────────────────────────────────────────────────
    case SuperAdmin = 'super_admin';
    case Admin      = 'admin';
    case HrAdmin    = 'hr_admin';
    case HrStaff    = 'hr_staff';
    case HeadAcademicProgram = 'head_academic_program';

    // ── Web-guard roles ────────────────────────────────────────────────────
    case Faculty    = 'faculty';

    // ── Helpers ────────────────────────────────────────────────────────────

    /** Returns the guard that owns this role. */
    public function guard(): string
    {
        return match ($this) {
            self::Faculty => 'web',
            default       => 'admin',
        };
    }

    /** Returns true if the role belongs to the admin guard. */
    public function isAdminRole(): bool
    {
        return $this->guard() === 'admin';
    }

    /** Returns a human-readable label. */
    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin',
            self::Admin      => 'Admin',
            self::HrAdmin    => 'HR Admin',
            self::HrStaff    => 'HR Staff',
            self::HeadAcademicProgram => 'Head of Academic Program',
            self::Faculty    => 'Faculty',
        };
    }

    /** Returns all permissions assigned to this role. */
    public function permissions(): array
    {
        return match ($this) {
            self::SuperAdmin            => Permission::adminPermissions(),
            self::Admin                 => Permission::adminPermissions(),
            self::HrAdmin               => Permission::hrStaffPermissions(),
            self::HrStaff               => Permission::hrStaffPermissions(),
            self::HeadAcademicProgram   => Permission::headAcademicProgramPermissions(),
            self::Faculty               => Permission::webPermissions(),
        };
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(string $locale, Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $role = trim((string) $request->query('role', ''));
        $status = trim((string) $request->query('status', ''));

        $counts = [
            'total' => (int) User::query()->count(),
            'admin' => (int) User::query()->where('role', User::ROLE_ADMIN)->count(),
            'manager' => (int) User::query()->where('role', User::ROLE_MANAGER)->count(),
            'customer' => (int) User::query()->where('role', User::ROLE_CUSTOMER)->count(),
            'active' => (int) User::query()->where('status', User::STATUS_ACTIVE)->count(),
            'suspended' => (int) User::query()->where('status', User::STATUS_SUSPENDED)->count(),
            'banned' => (int) User::query()->where('status', User::STATUS_BANNED)->count(),
        ];

        $users = $this->filteredUsersQuery($q, $role, $status)
            ->select([
                'id',
                'name',
                'email',
                'role',
                'status',
                'suspended_until',
                'banned_at',
                'ban_reason',
                'banned_by',
                'created_at',
            ])
            ->with('bannedByUser:id,name,email')
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString()
            ->through(function (User $user) {
                $user->syncStatusIfSuspensionExpired();

                return [
                    'id' => (int) $user->id,
                    'name' => (string) $user->name,
                    'email' => (string) $user->email,
                    'role' => (string) $user->role,
                    'status' => (string) $user->status,
                    'suspended_until' => optional($user->suspended_until)?->toISOString(),
                    'banned_at' => optional($user->banned_at)?->toISOString(),
                    'ban_reason' => $user->ban_reason,
                    'banned_by' => $user->bannedByUser
                        ? [
                            'id' => (int) $user->bannedByUser->id,
                            'name' => (string) $user->bannedByUser->name,
                            'email' => (string) $user->bannedByUser->email,
                        ]
                        : null,
                    'created_at' => optional($user->created_at)?->toISOString(),
                ];
            });

        return Inertia::render('Admin/Users/Index', [
            'users' => $users,
            'filters' => [
                'q' => $q,
                'role' => $role,
                'status' => $status,
            ],
            'counts' => $counts,
            'roles' => [
                ['value' => '', 'label' => trans('ui.common.all')],
                ['value' => User::ROLE_ADMIN, 'label' => 'Admin'],
                ['value' => User::ROLE_MANAGER, 'label' => 'Manager'],
                ['value' => User::ROLE_CUSTOMER, 'label' => 'Customer'],
            ],
            'statuses' => [
                ['value' => '', 'label' => trans('ui.common.all')],
                ['value' => User::STATUS_ACTIVE, 'label' => trans('ui.users.status_active')],
                ['value' => User::STATUS_SUSPENDED, 'label' => trans('ui.users.status_suspended')],
                ['value' => User::STATUS_BANNED, 'label' => trans('ui.users.status_banned')],
            ],
        ]);
    }

    public function export(string $locale, Request $request): StreamedResponse
    {
        $q = trim((string) $request->query('q', ''));
        $role = trim((string) $request->query('role', ''));
        $status = trim((string) $request->query('status', ''));

        $filename = 'users_' . now()->format('Ymd_His') . '.csv';

        $query = $this->filteredUsersQuery($q, $role, $status)
            ->select([
                'id',
                'name',
                'email',
                'role',
                'status',
                'suspended_until',
                'banned_at',
                'ban_reason',
                'created_at',
            ])
            ->orderBy('id');

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');

            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, [
                'id',
                'name',
                'email',
                'role',
                'status',
                'suspended_until',
                'banned_at',
                'ban_reason',
                'created_at',
            ]);

            $query->chunkById(1000, function ($rows) use ($out) {
                foreach ($rows as $u) {
                    fputcsv($out, [
                        $u->id,
                        $u->name,
                        $u->email,
                        $u->role,
                        $u->status,
                        optional($u->suspended_until)->toISOString(),
                        optional($u->banned_at)->toISOString(),
                        $u->ban_reason,
                        optional($u->created_at)->toISOString(),
                    ]);
                }
            });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function updateRole(string $locale, Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'role' => ['required', 'string', 'in:' . implode(',', [
                User::ROLE_ADMIN,
                User::ROLE_MANAGER,
                User::ROLE_CUSTOMER,
            ])],
        ]);

        $auth = $request->user();
        abort_unless($auth, 403);

        if ((int) $auth->id === (int) $user->id && $data['role'] !== User::ROLE_ADMIN) {
            return back()->with('error', trans('ui.users.errors.cannot_change_own_role_from_admin'));
        }

        if ($user->role === User::ROLE_ADMIN && $data['role'] !== User::ROLE_ADMIN) {
            $otherActiveAdmins = User::query()
                ->where('role', User::ROLE_ADMIN)
                ->where('status', User::STATUS_ACTIVE)
                ->whereKeyNot($user->id)
                ->count();

            if ($user->status === User::STATUS_ACTIVE && $otherActiveAdmins <= 0) {
                return back()->with('error', trans('ui.users.errors.cannot_demote_last_active_admin'));
            }

            $adminsCount = (int) User::query()->where('role', User::ROLE_ADMIN)->count();

            if ($adminsCount <= 1) {
                return back()->with('error', trans('ui.users.errors.cannot_remove_last_admin'));
            }
        }

        if ($user->role === $data['role']) {
            return back()->with('success', trans('ui.users.role_already_set'));
        }

        $user->role = $data['role'];
        $user->save();

        return back()->with('success', trans('ui.users.role_updated', [
            'role' => $data['role'],
        ]));
    }

    public function updateStatus(string $locale, Request $request, User $user): RedirectResponse
    {
        $auth = $request->user();
        abort_unless($auth, 403);

        $data = $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', [
                User::STATUS_ACTIVE,
                User::STATUS_SUSPENDED,
                User::STATUS_BANNED,
            ])],
            'suspended_until' => ['nullable', 'date'],
            'ban_reason' => ['nullable', 'string', 'max:2000'],
        ]);

        if ((int) $auth->id === (int) $user->id) {
            return back()->with('error', trans('ui.users.errors.cannot_change_own_status'));
        }

        $nextStatus = $data['status'];
        $nextSuspendedUntil = $data['suspended_until'] ?? null;
        $reason = isset($data['ban_reason']) ? trim((string) $data['ban_reason']) : null;
        $reason = $reason !== '' ? $reason : null;

        if ($nextStatus === User::STATUS_SUSPENDED && empty($nextSuspendedUntil)) {
            return back()->with('error', trans('ui.users.errors.suspension_requires_date'));
        }

        if ($nextStatus === User::STATUS_SUSPENDED && $nextSuspendedUntil) {
            $until = now()->parse($nextSuspendedUntil);

            if ($until->lessThanOrEqualTo(now())) {
                return back()->with('error', trans('ui.users.errors.suspension_must_be_future'));
            }
        }

        if ($user->role === User::ROLE_ADMIN && $nextStatus !== User::STATUS_ACTIVE) {
            $otherActiveAdmins = User::query()
                ->where('role', User::ROLE_ADMIN)
                ->where('status', User::STATUS_ACTIVE)
                ->whereKeyNot($user->id)
                ->count();

            if ($user->status === User::STATUS_ACTIVE && $otherActiveAdmins <= 0) {
                return back()->with('error', trans('ui.users.errors.cannot_block_last_active_admin'));
            }
        }

        if (
            $user->status === $nextStatus
            && (
                $nextStatus !== User::STATUS_SUSPENDED
                || optional($user->suspended_until)?->format('Y-m-d H:i:s') === optional($nextSuspendedUntil ? now()->parse($nextSuspendedUntil) : null)?->format('Y-m-d H:i:s')
            )
            && (($user->ban_reason ?? null) === $reason)
        ) {
            return back()->with('success', trans('ui.users.status_already_set'));
        }

        if ($nextStatus === User::STATUS_ACTIVE) {
            $user->forceFill([
                'status' => User::STATUS_ACTIVE,
                'suspended_until' => null,
                'banned_at' => null,
                'ban_reason' => null,
                'banned_by' => null,
            ])->save();

            return back()->with('success', trans('ui.users.status_updated_active'));
        }

        if ($nextStatus === User::STATUS_SUSPENDED) {
            $user->forceFill([
                'status' => User::STATUS_SUSPENDED,
                'suspended_until' => now()->parse($nextSuspendedUntil),
                'banned_at' => now(),
                'ban_reason' => $reason,
                'banned_by' => $auth->id,
            ])->save();

            return back()->with('success', trans('ui.users.status_updated_suspended'));
        }

        $user->forceFill([
            'status' => User::STATUS_BANNED,
            'suspended_until' => null,
            'banned_at' => now(),
            'ban_reason' => $reason,
            'banned_by' => $auth->id,
        ])->save();

        return back()->with('success', trans('ui.users.status_updated_banned'));
    }

    private function filteredUsersQuery(string $q, string $role, string $status)
    {
        $query = User::query();

        if ($q !== '') {
            $query->where(function ($qq) use ($q) {
                $qq->where('name', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%");
            });
        }

        if ($role !== '' && in_array($role, User::roles(), true)) {
            $query->where('role', $role);
        }

        if ($status !== '' && in_array($status, User::statuses(), true)) {
            $query->where('status', $status);
        }

        return $query;
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Dashboard', description: 'Aggregate figures for the dashboard')]
class StatsController extends Controller
{
    #[OA\Get(
        path: '/stats',
        summary: 'Aggregate user statistics for the dashboard',
        tags: ['Dashboard'],
        security: [['cookieAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Totals, role split, department breakdown and the newest users'),
            new OA\Response(response: 401, description: 'Not authenticated'),
        ],
    )]
    public function index(): JsonResponse
    {
        // One grouped query per figure rather than loading every row and
        // counting in PHP -- the dashboard stays O(1) in transferred rows as
        // the table grows.
        $byRole = User::query()
            ->select('role', DB::raw('count(*) as total'))
            ->groupBy('role')
            ->pluck('total', 'role');

        $byDepartment = User::query()
            ->select('department', DB::raw('count(*) as total'))
            ->whereNotNull('department')
            ->groupBy('department')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'department' => $row->department,
                'total' => (int) $row->total,
            ]);

        return response()->json([
            'data' => [
                'total_users' => User::count(),
                'total_admins' => (int) ($byRole[Role::Admin->value] ?? 0),
                'total_standard' => (int) ($byRole[Role::User->value] ?? 0),
                'total_departments' => $byDepartment->count(),
                'added_last_7_days' => User::where('created_at', '>=', now()->subDays(7))->count(),
                'by_department' => $byDepartment,
                'recent_users' => UserResource::collection(
                    User::query()->latest('id')->limit(5)->get()
                ),
            ],
        ]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\Order;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $today = now()->startOfDay();
        $orders = Order::where('created_at', '>=', $today)->whereIn('status', ['BILLED', 'COMPLETED']);
        $expenses = Expense::whereDate('expense_date', today())
            ->selectRaw('category, SUM(amount) as total')
            ->groupBy('category')
            ->orderBy('category')
            ->get()
            ->map(fn (Expense $expense) => [
                'category' => $expense->category,
                'total' => (float) $expense->total,
            ])
            ->values();

        return Inertia::render('Dashboard', [
            'metrics' => [
                'sales' => (float) (clone $orders)->sum('total'),
                'orders' => (clone $orders)->count(),
                'cash' => (float) Payment::where('payment_method', 'CASH')->where('created_at', '>=', $today)->sum('amount'),
                'card' => (float) Payment::where('payment_method', 'CARD')->where('created_at', '>=', $today)->sum('amount'),
                'expenses' => $expenses,
            ],
        ]);
    }

    public function salesRhythm(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), 403);

        $range = $request->string('range', 'week')->toString();
        abort_unless(in_array($range, ['day', 'week', 'month'], true), 422, 'Invalid range.');

        return response()->json($this->buildSalesRhythm($range));
    }

    /**
     * @return array{range: string, title: string, points: array<int, array{label: string, sales: float, orders: int}>}
     */
    private function buildSalesRhythm(string $range): array
    {
        $statuses = ['BILLED', 'COMPLETED'];

        if ($range === 'day') {
            $start = now()->startOfDay();
            $end = now()->endOfDay();

            $rows = $this->hourlySales($start, $end, $statuses);
            $indexed = $rows->keyBy(fn ($row) => (int) $row->bucket);

            $points = [];
            for ($hour = 0; $hour < 24; $hour++) {
                $row = $indexed->get($hour);
                $points[] = [
                    'label' => sprintf('%02d', $hour),
                    'sales' => (float) ($row->sales ?? 0),
                    'orders' => (int) ($row->orders ?? 0),
                ];
            }

            return [
                'range' => 'day',
                'title' => 'Today · hourly sales',
                'points' => $points,
            ];
        }

        if ($range === 'week') {
            $start = now()->startOfWeek();
            $end = now()->endOfWeek();

            return $this->dailySalesRhythm($start, $end, $statuses, 'week', 'This week · daily sales');
        }

        $start = now()->startOfMonth();
        $end = now()->endOfMonth();

        return $this->dailySalesRhythm(
            $start,
            $end,
            $statuses,
            'month',
            now()->format('F Y').' · daily sales',
        );
    }

  /**
     * @param  list<string>  $statuses
     * @return \Illuminate\Support\Collection<int, object{bucket: mixed, sales: mixed, orders: mixed}>
     */
    private function hourlySales(Carbon $start, Carbon $end, array $statuses)
    {
        $query = Order::query()
            ->whereBetween('created_at', [$start, $end])
            ->whereIn('status', $statuses);

        if (DB::getDriverName() === 'pgsql') {
            return $query
                ->selectRaw('EXTRACT(HOUR FROM created_at) AS bucket, SUM(total) AS sales, COUNT(*) AS orders')
                ->groupByRaw('EXTRACT(HOUR FROM created_at)')
                ->get();
        }

        return $query
            ->selectRaw('CAST(strftime("%H", created_at) AS INTEGER) AS bucket, SUM(total) AS sales, COUNT(*) AS orders')
            ->groupByRaw('CAST(strftime("%H", created_at) AS INTEGER)')
            ->get();
    }

    /**
     * @param  list<string>  $statuses
     * @return array{range: string, title: string, points: array<int, array{label: string, sales: float, orders: int}>}
     */
    private function dailySalesRhythm(Carbon $start, Carbon $end, array $statuses, string $range, string $title): array
    {
        $query = Order::query()
            ->whereBetween('created_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()])
            ->whereIn('status', $statuses);

        if (DB::getDriverName() === 'pgsql') {
            $rows = $query
                ->selectRaw('DATE(created_at) AS bucket, SUM(total) AS sales, COUNT(*) AS orders')
                ->groupByRaw('DATE(created_at)')
                ->get();
        } else {
            $rows = $query
                ->selectRaw('date(created_at) AS bucket, SUM(total) AS sales, COUNT(*) AS orders')
                ->groupByRaw('date(created_at)')
                ->get();
        }

        $indexed = $rows->keyBy(fn ($row) => Carbon::parse($row->bucket)->toDateString());

        $points = [];
        for ($day = $start->copy(); $day->lte($end); $day->addDay()) {
            $key = $day->toDateString();
            $row = $indexed->get($key);
            $points[] = [
                'label' => $range === 'week' ? $day->format('D') : $day->format('j'),
                'sales' => (float) ($row->sales ?? 0),
                'orders' => (int) ($row->orders ?? 0),
            ];
        }

        return [
            'range' => $range,
            'title' => $title,
            'points' => $points,
        ];
    }
}

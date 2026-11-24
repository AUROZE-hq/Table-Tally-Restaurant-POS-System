<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Shift;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ShiftController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->input('per_page', 10), 1), 50);
        $search = trim((string) $request->input('search', ''));

        $query = Shift::query()
            ->with('cashier:id,name,email')
            ->orderByDesc('opening_time');

        if ($search !== '') {
            $query->whereHas('cashier', function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%");
            });
        }

        if ($request->filled('from')) {
            $query->whereDate('opening_time', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('opening_time', '<=', $request->input('to'));
        }

        $paginator = $query->paginate($perPage);
        $paginator->getCollection()->transform(fn (Shift $shift) => $this->presentShift($shift, true));

        return response()->json($paginator);
    }

    public function current(Request $request): JsonResponse
    {
        $shift = Shift::where('cashier_id', $request->user()->id)->where('status', 'OPEN')->latest()->first();

        return response()->json($this->presentShift($shift, false));
    }

    public function store(Request $request): JsonResponse
    {
        if (Shift::where('cashier_id', $request->user()->id)->where('status', 'OPEN')->exists()) {
            return response()->json(['message' => 'You already have an open shift.'], 422);
        }

        $shift = Shift::create([
            'cashier_id' => $request->user()->id,
            'opening_cash' => $request->validate(['opening_cash' => ['required', 'numeric', 'min:0']])['opening_cash'],
            'opening_time' => now(),
            'status' => 'OPEN',
        ]);

        return response()->json($this->presentShift($shift, false), 201);
    }

    public function close(Request $request, Shift $shift): JsonResponse
    {
        abort_unless($shift->cashier_id === $request->user()->id && $shift->status === 'OPEN', 403);

        $data = $request->validate([
            'closing_cash' => ['nullable', 'numeric', 'min:0'],
        ]);

        $shift->update([
            'closing_cash' => $data['closing_cash'] ?? null,
            'closing_time' => now(),
            'status' => 'CLOSED',
        ]);

        return response()->json($shift->fresh());
    }

    /**
     * @return array<string, mixed>|null
     */
    private function presentShift(?Shift $shift, bool $includeCashier): ?array
    {
        if (! $shift) {
            return null;
        }

        if ($includeCashier) {
            $shift->loadMissing('cashier:id,name,email');
        }

        $salesEnd = $shift->closing_time ?? Carbon::now();
        $cashSales = $this->cashSalesForShift($shift, $salesEnd);
        $opening = (float) $shift->opening_cash;

        return array_merge($shift->toArray(), [
            'cash_sales' => $cashSales,
            'expected_cash_in_drawer' => $opening + $cashSales,
        ]);
    }

    private function cashSalesForShift(Shift $shift, Carbon $salesEnd): float
    {
        return (float) Payment::query()
            ->where('payment_method', 'CASH')
            ->where('created_at', '>=', $shift->opening_time)
            ->where('created_at', '<=', $salesEnd)
            ->whereHas('order', fn ($query) => $query->where('cashier_id', $shift->cashier_id))
            ->sum('amount');
    }
}

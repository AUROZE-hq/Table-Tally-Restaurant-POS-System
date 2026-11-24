<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(50, max(1, $request->integer('per_page', 10)));

        $query = Expense::query()->with('user:id,name');

        if ($from = $request->date('from')?->toDateString()) {
            $query->whereDate('expense_date', '>=', $from);
        }

        if ($to = $request->date('to')?->toDateString()) {
            $query->whereDate('expense_date', '<=', $to);
        }

        if ($category = trim($request->string('category')->toString())) {
            $query->where('category', $category);
        }

        if ($search = trim($request->string('search')->toString())) {
            $query->where(function ($nested) use ($search) {
                $nested->where('description', 'like', '%'.$search.'%')
                    ->orWhere('category', 'like', '%'.$search.'%');
            });
        }

        if ($request->filled('min_amount')) {
            $query->where('amount', '>=', (float) $request->input('min_amount'));
        }

        if ($request->filled('max_amount')) {
            $query->where('amount', '<=', (float) $request->input('max_amount'));
        }

        $filteredTotal = (float) (clone $query)->sum('amount');

        $paginator = $query->latest('expense_date')->latest('id')->paginate($perPage);

        return response()->json(array_merge($paginator->toArray(), [
            'filtered_total' => $filteredTotal,
        ]));
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(Expense::create($request->validate([
            'category' => ['required', 'string', 'max:80'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'description' => ['nullable', 'string'],
            'expense_date' => ['required', 'date'],
        ]) + ['user_id' => $request->user()->id]), 201);
    }

    public function update(Request $request, Expense $expense): JsonResponse
    {
        $expense->update($request->validate([
            'category' => ['sometimes', 'string', 'max:80'],
            'amount' => ['sometimes', 'numeric', 'gt:0'],
            'description' => ['nullable', 'string'],
            'expense_date' => ['sometimes', 'date'],
        ]));

        return response()->json($expense->fresh());
    }

    public function destroy(Expense $expense): JsonResponse
    {
        $expense->delete();

        return response()->json(['message' => 'Expense deleted.']);
    }
}

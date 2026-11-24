<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->input('per_page', 10), 1), 50);
        $search = trim((string) $request->input('search', ''));
        $filter = strtolower(trim((string) $request->input('filter', 'all')));

        $query = Customer::query()
            ->withCount('orders')
            ->latest();

        if ($search !== '') {
            $query->where(function ($scoped) use ($search) {
                $scoped->where('name', 'ilike', "%{$search}%")
                    ->orWhere('phone', 'ilike', "%{$search}%")
                    ->orWhere('address', 'ilike', "%{$search}%");
            });
        }

        if ($filter === 'phone') {
            $query->whereNotNull('phone')->where('phone', '!=', '');
        } elseif ($filter === 'address') {
            $query->whereNotNull('address')->where('address', '!=', '');
        } elseif ($filter === 'repeat') {
            $query->has('orders');
        }

        $paginator = $query->paginate($perPage);

        $paginator->through(function (Customer $customer) {
            $customer->setRelation(
                'orders',
                $customer->orders()
                    ->select(['id', 'customer_id', 'order_number', 'order_type', 'total', 'status', 'created_at'])
                    ->latest()
                    ->limit(5)
                    ->with([
                        'items:id,order_id,product_id,quantity,line_total',
                        'items.product:id,name',
                    ])
                    ->get()
            );

            return $customer;
        });

        return response()->json($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(Customer::create($request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string'],
        ])), 201);
    }

    public function show(Customer $customer): JsonResponse
    {
        return response()->json($customer->load('orders'));
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $customer->update($request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string'],
        ]));

        return response()->json($customer->fresh());
    }

    public function destroy(Customer $customer): JsonResponse
    {
        $customer->delete();

        return response()->json(['message' => 'Customer deleted.']);
    }
}

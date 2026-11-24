<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Product;
use App\Models\RestaurantTable;
use App\Models\Shift;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAdmin() || $request->user()->isCashier(), 403);

        $query = Order::with(['items.product', 'items.server', 'payment', 'table', 'cashier', 'server'])->latest();

        if ($request->user()->isCashier()) {
            $query->whereIn('status', ['READY', 'BILLED', 'COMPLETED']);
        }

        return response()->json($query->paginate($request->user()->isAdmin() ? 50 : 25));
    }

    public function floor(): JsonResponse
    {
        $orders = Order::query()
            ->select(['id', 'order_number', 'order_type', 'table_id', 'status', 'subtotal', 'discount', 'total', 'notes', 'server_id', 'cashier_id', 'created_at'])
            ->with([
                'items:id,order_id,product_id,server_id,quantity,line_total',
                'items.product:id,name',
                'items.server:id,name',
                'table:id,name',
                'server:id,name',
                'cashier:id,name',
                'payment:id,order_id,payment_method',
            ])
            ->where('order_type', 'DINE_IN')
            ->whereIn('status', ['OPEN', 'READY', 'BILLED'])
            ->latest('id')
            ->get();

        return response()->json([
            'tables' => RestaurantTable::query()
                ->select(['id', 'name', 'status'])
                ->where('is_active', true)
                ->orderBy('name')
                ->get(),
            'orders' => $orders,
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), 403);

        $orders = Order::with(['items.product', 'items.server', 'payment', 'table', 'cashier', 'server', 'customer'])
            ->latest()
            ->limit(100)
            ->get();

        return response()->json($orders);
    }

    public function serverHistory(Request $request): JsonResponse
    {
        abort_unless($request->user()->isServer() || $request->user()->isAdmin(), 403);

        $orders = Order::query()
            ->select(['id', 'order_number', 'order_type', 'table_id', 'status', 'subtotal', 'discount', 'total', 'server_id', 'cashier_id', 'created_at', 'updated_at'])
            ->with([
                'items:id,order_id,product_id,server_id,quantity,line_total',
                'items.product:id,name',
                'items.server:id,name',
                'table:id,name',
                'server:id,name',
                'payment:id,order_id,payment_method',
            ])
            ->whereIn('status', ['OPEN', 'READY', 'BILLED', 'COMPLETED'])
            ->latest('updated_at')
            ->limit(100)
            ->get();

        return response()->json($orders);
    }

    public function store(Request $request): JsonResponse
    {
        if ($request->user()->isServer()) {
            return $this->placeServerOrder($request);
        }

        $data = $request->validate([
            'order_type' => ['required', 'in:DINE_IN,TAKEAWAY'],
            'table_id' => ['nullable', 'exists:restaurant_tables,id'],
            'customer_id' => ['nullable', 'exists:customers,id'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.notes' => ['nullable', 'string'],
            'payment.method' => ['required', 'in:CASH,CARD,LANKAQR'],
            'payment.received_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        if ($data['order_type'] === 'DINE_IN' && empty($data['table_id'])) {
            return response()->json(['message' => 'A table is required for dine-in orders.'], 422);
        }

        if ($data['order_type'] === 'TAKEAWAY' && empty($data['customer_id']) && empty($data['customer_phone'])) {
            return response()->json(['message' => 'Customer phone number is required for takeaway orders.'], 422);
        }

        if ($request->user()->isCashier() && ! $this->cashierShiftOpen($request)) {
            return response()->json(['message' => 'Open a shift before processing sales.'], 422);
        }

        $order = DB::transaction(function () use ($data, $request) {
            $productIds = collect($data['items'])->pluck('product_id');
            $products = Product::whereIn('id', $productIds)->where('is_available', true)->lockForUpdate()->get()->keyBy('id');
            $subtotal = 0;

            foreach ($data['items'] as $item) {
                $product = $products->get($item['product_id']);
                abort_unless($product, 422, 'One or more products are unavailable.');
                $subtotal += (float) $product->price * $item['quantity'];
            }

            $discount = min((float) ($data['discount'] ?? 0), $subtotal);
            $total = $subtotal - $discount;
            $received = $data['payment']['received_amount'] ?? ($data['payment']['method'] === 'CASH' ? $total : null);

            if ($data['payment']['method'] === 'CASH' && $received < $total) {
                abort(422, 'Cash received must be at least the order total.');
            }

            $table = ! empty($data['table_id']) ? RestaurantTable::lockForUpdate()->find($data['table_id']) : null;
            if ($table && Order::where('table_id', $table->id)->whereIn('status', ['OPEN', 'READY', 'BILLED'])->exists()) {
                abort(422, 'That table already has an open ticket. Bill it from Tables to bill.');
            }

            $customerId = $data['customer_id'] ?? null;
            if (! $customerId && ! empty($data['customer_phone'])) {
                $phone = preg_replace('/\s+/', '', $data['customer_phone']);
                $customer = Customer::firstOrCreate(
                    ['phone' => $phone],
                    ['name' => 'Takeaway '.$phone]
                );
                $customerId = $customer->id;
            }

            $order = Order::create([
                'order_number' => 'POS-'.now()->format('YmdHis').'-'.Str::upper(Str::random(4)),
                'order_type' => $data['order_type'],
                'table_id' => $data['table_id'] ?? null,
                'cashier_id' => $request->user()->id,
                'customer_id' => $customerId,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'status' => 'COMPLETED',
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($data['items'] as $item) {
                $product = $products->get($item['product_id']);
                $this->addLine($order, $product, $item, $request->user()->id);
            }

            $order->payment()->create([
                'payment_method' => $data['payment']['method'],
                'amount' => $total,
                'received_amount' => $received,
                'change_amount' => max(0, (float) ($received ?? $total) - $total),
            ]);

            if ($table) {
                $table->update(['status' => 'AVAILABLE']);
            }

            return $order;
        });

        return response()->json($order->load(['items.product', 'payment', 'table', 'cashier', 'server', 'customer']), 201);
    }

    public function show(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        $floorTicket = in_array($order->status, ['OPEN', 'READY', 'BILLED'], true);
        abort_unless($user->isAdmin() || $user->isServer() || $floorTicket || $order->cashier_id === $user->id, 403);

        return response()->json($order->load(['items.product', 'payment', 'table', 'cashier', 'server', 'customer']));
    }

    public function ready(Request $request, Order $order): JsonResponse
    {
        abort_unless($request->user()->isServer() || $request->user()->isAdmin(), 403);
        abort_unless($order->status === 'OPEN', 422, 'Only an open table order can be closed.');
        abort_unless($order->items()->exists(), 422, 'Add at least one dish before closing the table.');

        $subtotal = (float) $order->items()->sum('line_total');
        $discount = (float) $order->discount;
        $total = max(0, $subtotal - $discount);

        $order->update([
            'status' => 'READY',
            'subtotal' => $subtotal,
            'total' => $total,
            'server_id' => $request->user()->isServer() ? $request->user()->id : $order->server_id,
        ]);

        if ($order->table_id) {
            RestaurantTable::whereKey($order->table_id)->update(['status' => 'OCCUPIED']);
        }

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'order.ready',
            'description' => "Server closed {$order->order_number}. Table stays occupied until payment.",
        ]);

        return response()->json($order->load(['items.product', 'items.server', 'payment', 'table', 'cashier', 'server']));
    }

    public function bill(Request $request, Order $order): JsonResponse
    {
        abort_unless($request->user()->isCashier() || $request->user()->isAdmin(), 403);
        abort_unless(in_array($order->status, ['OPEN', 'READY'], true), 422, 'This table is not waiting for a bill.');

        if ($request->user()->isCashier() && ! $this->cashierShiftOpen($request)) {
            return response()->json(['message' => 'Open a shift before creating a bill.'], 422);
        }

        $data = $request->validate([
            'discount' => ['nullable', 'numeric', 'min:0'],
            'payment.method' => ['required', 'in:CASH,CARD,LANKAQR'],
            'payment.received_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        $order = DB::transaction(function () use ($data, $request, $order) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            abort_unless(in_array($order->status, ['OPEN', 'READY'], true), 422, 'This table is not waiting for a bill.');

            $subtotal = (float) $order->items()->sum('line_total');
            $discount = min((float) ($data['discount'] ?? 0), $subtotal);
            $total = $subtotal - $discount;
            $received = $data['payment']['received_amount'] ?? ($data['payment']['method'] === 'CASH' ? $total : null);

            if ($data['payment']['method'] === 'CASH' && $received < $total) {
                abort(422, 'Cash received must be at least the bill total.');
            }

            $order->update([
                'cashier_id' => $request->user()->id,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'status' => 'BILLED',
            ]);

            $order->payment()->create([
                'payment_method' => $data['payment']['method'],
                'amount' => $total,
                'received_amount' => $received,
                'change_amount' => max(0, (float) ($received ?? $total) - $total),
            ]);

            if ($order->table_id) {
                RestaurantTable::whereKey($order->table_id)->update(['status' => 'OCCUPIED']);
            }

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'order.billed',
                'description' => "Bill created for {$order->order_number}.",
            ]);

            return $order;
        });

        return response()->json($order->load(['items.product', 'items.server', 'payment', 'table', 'cashier', 'server']));
    }

    public function complete(Request $request, Order $order): JsonResponse
    {
        abort_unless($request->user()->isServer() || $request->user()->isAdmin(), 403);
        abort_unless($order->status === 'BILLED', 422, 'The cashier must create the bill before this customer can be completed.');

        DB::transaction(function () use ($request, $order) {
            $order->update([
                'status' => 'COMPLETED',
                'server_id' => $request->user()->isServer() ? $request->user()->id : $order->server_id,
            ]);

            if ($order->table_id) {
                $stillOpen = Order::where('table_id', $order->table_id)
                    ->whereIn('status', ['OPEN', 'READY', 'BILLED'])
                    ->exists();
                if (! $stillOpen) {
                    RestaurantTable::whereKey($order->table_id)->update(['status' => 'AVAILABLE']);
                }
            }

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'order.completed',
                'description' => "Customer completed for {$order->order_number}.",
            ]);
        });

        return response()->json($order->fresh()->load(['items.product', 'items.server', 'payment', 'table', 'cashier', 'server']));
    }

    public function paid(Request $request, Order $order): JsonResponse
    {
        abort_unless($request->user()->isServer() || $request->user()->isAdmin(), 403);
        abort_unless(in_array($order->status, ['READY', 'BILLED'], true), 422, 'Close the order before marking it paid.');
        abort_if($order->payment()->exists(), 422, 'This order is already paid.');

        $data = $request->validate([
            'payment.method' => ['nullable', 'in:CASH,CARD,LANKAQR'],
            'payment.received_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        $order = DB::transaction(function () use ($data, $request, $order) {
            $order = Order::lockForUpdate()->findOrFail($order->id);
            abort_unless(in_array($order->status, ['READY', 'BILLED'], true), 422, 'This order cannot be paid yet.');
            abort_if($order->payment()->exists(), 422, 'This order is already paid.');

            $subtotal = (float) $order->items()->sum('line_total');
            $discount = min((float) $order->discount, $subtotal);
            $total = max(0, $subtotal - $discount);
            $method = $data['payment']['method'] ?? 'CASH';
            $received = $data['payment']['received_amount'] ?? ($method === 'CASH' ? $total : $total);

            if ($method === 'CASH' && $received < $total) {
                abort(422, 'Cash received must be at least the order total.');
            }

            $order->update([
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'status' => 'COMPLETED',
                'server_id' => $request->user()->isServer() ? $request->user()->id : $order->server_id,
            ]);

            $order->payment()->create([
                'payment_method' => $method,
                'amount' => $total,
                'received_amount' => $received,
                'change_amount' => max(0, (float) $received - $total),
            ]);

            if ($order->table_id) {
                $stillActive = Order::where('table_id', $order->table_id)
                    ->whereIn('status', ['OPEN', 'READY', 'BILLED'])
                    ->whereKeyNot($order->id)
                    ->exists();
                if (! $stillActive) {
                    RestaurantTable::whereKey($order->table_id)->update(['status' => 'AVAILABLE']);
                }
            }

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'order.paid',
                'description' => "Payment recorded for {$order->order_number}.",
            ]);

            return $order;
        });

        return response()->json($order->load(['items.product', 'items.server', 'payment', 'table', 'cashier', 'server']));
    }

    private function placeServerOrder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'table_id' => ['required', 'exists:restaurant_tables,id'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.notes' => ['nullable', 'string'],
        ]);

        try {
            $order = $this->saveServerItems($data, $request);
        } catch (QueryException $exception) {
            report($exception);

            if (! str_contains($exception->getMessage(), '25P02')) {
                return response()->json([
                    'message' => 'The kitchen ticket could not be saved. Tap the dish again.',
                ], 500);
            }

            DB::reconnect();

            try {
                $order = $this->saveServerItems($data, $request);
            } catch (QueryException $retryException) {
                report($retryException);

                return response()->json([
                    'message' => 'The kitchen ticket could not be saved. Tap the dish again.',
                ], 500);
            }
        } catch (\Throwable $exception) {
            if ($exception instanceof HttpException) {
                throw $exception;
            }

            report($exception);

            return response()->json([
                'message' => 'The kitchen ticket could not be saved. Tap the dish again.',
            ], 500);
        }

        return response()->json($order->load(['items.product', 'items.server', 'payment', 'table', 'cashier', 'server']), 201);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function saveServerItems(array $data, Request $request): Order
    {
        return DB::transaction(function () use ($data, $request) {
            $table = RestaurantTable::query()->lockForUpdate()->findOrFail($data['table_id']);

            if (Order::query()
                ->where('table_id', $table->id)
                ->where('status', 'BILLED')
                ->exists()) {
                abort(422, 'This table is waiting for payment at the cashier. Mark it paid before starting a new visit.');
            }

            $order = Order::query()
                ->where('table_id', $table->id)
                ->whereIn('status', ['OPEN', 'READY'])
                ->orderByRaw("CASE WHEN status = 'OPEN' THEN 0 ELSE 1 END")
                ->orderBy('id')
                ->lockForUpdate()
                ->first();

            $productIds = collect($data['items'])->pluck('product_id')->unique();
            $products = Product::whereIn('id', $productIds)->where('is_available', true)->get()->keyBy('id');

            if (! $order) {
                $order = Order::create([
                    'order_number' => 'TBL-'.now()->format('YmdHis').'-'.Str::upper(Str::random(4)),
                    'order_type' => 'DINE_IN',
                    'table_id' => $table->id,
                    'cashier_id' => null,
                    'server_id' => $request->user()->id,
                    'subtotal' => 0,
                    'discount' => 0,
                    'total' => 0,
                    'status' => 'OPEN',
                    'notes' => $data['notes'] ?? null,
                ]);
            } else {
                $order->update([
                    'server_id' => $request->user()->id,
                    'status' => 'OPEN',
                    'notes' => $data['notes'] ?? $order->notes,
                ]);
            }

            foreach ($data['items'] as $item) {
                $product = $products->get($item['product_id']);
                abort_unless($product, 422, 'One or more products are unavailable.');
                $this->addLine($order, $product, $item, $request->user()->id);
            }

            $this->consolidateDuplicateOpenOrders($order, $table);

            $order->refresh();
            $subtotal = (float) $order->items()->sum('line_total');
            $order->update([
                'subtotal' => $subtotal,
                'total' => max(0, $subtotal - (float) $order->discount),
            ]);
            $table->update(['status' => 'OCCUPIED']);

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'order.items_added',
                'description' => "Server added items to {$order->order_number} on {$table->name}.",
            ]);

            return $order;
        });
    }

    /**
     * @param  array{quantity: int, notes?: string|null}  $item
     */
    private function addLine(Order $order, Product $product, array $item, ?int $serverId = null): void
    {
        $addQty = (int) $item['quantity'];
        $existing = $order->items()->where('product_id', $product->id)->first();

        if ($inventory = Inventory::where('product_id', $product->id)->first()) {
            if ($inventory->current_stock < $addQty) {
                abort(422, "Insufficient stock for {$product->name}.");
            }
            $inventory->decrement('current_stock', $addQty);
        }

        if ($existing) {
            $quantity = $existing->quantity + $addQty;
            $existing->update([
                'quantity' => $quantity,
                'unit_price' => $product->price,
                'line_total' => (float) $product->price * $quantity,
                'server_id' => $serverId,
                'notes' => $item['notes'] ?? $existing->notes,
            ]);

            return;
        }

        $order->items()->create([
            'product_id' => $product->id,
            'server_id' => $serverId,
            'quantity' => $addQty,
            'unit_price' => $product->price,
            'line_total' => (float) $product->price * $addQty,
            'notes' => $item['notes'] ?? null,
        ]);
    }

    private function cashierShiftOpen(Request $request): bool
    {
        return Shift::where('cashier_id', $request->user()->id)->where('status', 'OPEN')->exists();
    }

    private function consolidateDuplicateOpenOrders(Order $order, RestaurantTable $table): void
    {
        Order::query()
            ->where('table_id', $table->id)
            ->where('status', 'OPEN')
            ->whereKeyNot($order->id)
            ->lockForUpdate()
            ->get()
            ->each(function (Order $duplicate) use ($order) {
                $duplicate->items()->update(['order_id' => $order->id]);
                $duplicate->delete();
            });
    }
}

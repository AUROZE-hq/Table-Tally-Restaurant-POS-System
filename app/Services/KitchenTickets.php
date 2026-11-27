<?php

namespace App\Services;

use App\Models\KitchenTicket;
use App\Models\Order;
use Illuminate\Support\Facades\DB;
use Throwable;

class KitchenTickets
{
    public function __construct(private KitchenPrinter $printer) {}

    /**
     * @param  list<array{order_item_id: int|null, product_name: string, quantity: int, notes?: string|null}>  $lines
     */
    public function create(Order $order, array $lines): ?KitchenTicket
    {
        $lines = array_values(array_filter($lines, fn (array $line) => (int) ($line['quantity'] ?? 0) > 0));
        if ($lines === []) {
            return null;
        }

        return DB::transaction(function () use ($order, $lines) {
            $order->loadMissing('table');
            $additional = $order->order_type === 'DINE_IN' && KitchenTicket::query()->where('order_id', $order->id)->exists();
            $heading = $order->order_type === 'TAKEAWAY'
                ? 'TAKEAWAY'
                : ($additional ? 'ADDITIONAL ITEMS' : 'NEW ORDER');

            $start = now()->timezone(config('app.timezone'))->startOfDay();
            $end = now()->timezone(config('app.timezone'))->endOfDay();

            $lastQueue = KitchenTicket::query()
                ->whereBetween('created_at', [$start, $end])
                ->orderByDesc('queue_number')
                ->lockForUpdate()
                ->value('queue_number');

            $queueNumber = max(1, ((int) $lastQueue) + 1);

            $ticket = KitchenTicket::query()->create([
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'order_type' => $order->order_type,
                'table_name' => $order->order_type === 'DINE_IN' ? $order->table?->name : null,
                'heading' => $heading,
                'queue_number' => $queueNumber,
            ]);

            foreach ($lines as $line) {
                $ticket->items()->create([
                    'order_item_id' => $line['order_item_id'] ?? null,
                    'product_name' => $line['product_name'],
                    'quantity' => (int) $line['quantity'],
                    'notes' => $line['notes'] ?? null,
                ]);
            }

            return $ticket->load('items');
        });
    }

    /**
     * @return array{id: int, printed: bool, already_printed?: bool, message?: string}
     */
    public function printTicket(KitchenTicket $ticket): array
    {
        if (! $this->printer->configured()) {
            return [
                'id' => $ticket->id,
                'printed' => false,
                'skipped' => true,
                'optional' => true,
                'message' => 'Kitchen printer is not set up. Set KITCHEN_PRINTER_HOST on the cashier PC.',
            ];
        }

        $current = KitchenTicket::query()->findOrFail($ticket->id);
        if ($current->printed_at) {
            return [
                'id' => $ticket->id,
                'printed' => true,
                'already_printed' => true,
            ];
        }

        try {
            $this->printer->send($current->load('items'));
            KitchenTicket::query()->whereKey($ticket->id)->whereNull('printed_at')->update([
                'printed_at' => now(),
                'print_error' => null,
            ]);

            return [
                'id' => $ticket->id,
                'printed' => true,
            ];
        } catch (Throwable $exception) {
            KitchenTicket::query()->whereKey($ticket->id)->update([
                'print_error' => $exception->getMessage(),
            ]);

            return [
                'id' => $ticket->id,
                'printed' => false,
                'skipped' => true,
                'optional' => true,
                'message' => $exception->getMessage(),
            ];
        }
    }
}

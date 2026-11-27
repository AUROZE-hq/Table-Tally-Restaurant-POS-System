<?php

use App\Models\Order;
use App\Models\RestaurantTable;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Order::query()
            ->where('status', 'BILLED')
            ->whereHas('payment')
            ->orderBy('id')
            ->each(function (Order $order): void {
                $order->update(['status' => 'COMPLETED']);

                if (! $order->table_id) {
                    return;
                }

                $stillActive = Order::query()
                    ->where('table_id', $order->table_id)
                    ->occupyingTable()
                    ->whereKeyNot($order->id)
                    ->exists();

                if (! $stillActive) {
                    RestaurantTable::whereKey($order->table_id)->update(['status' => 'AVAILABLE']);
                }
            });
    }

    public function down(): void
    {
        //
    }
};
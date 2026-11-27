<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $fillable = [
        'order_number', 'order_type', 'table_id', 'cashier_id', 'server_id', 'customer_id',
        'subtotal', 'discount', 'total', 'status', 'kitchen_ready_at', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'total' => 'decimal:2',
            'kitchen_ready_at' => 'datetime',
        ];
    }

    public function cashier()
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function server()
    {
        return $this->belongsTo(User::class, 'server_id');
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function table()
    {
        return $this->belongsTo(RestaurantTable::class, 'table_id');
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payment()
    {
        return $this->hasOne(Payment::class);
    }

    public function kitchenTickets()
    {
        return $this->hasMany(KitchenTicket::class);
    }

    public function latestKitchenTicket()
    {
        return $this->hasOne(KitchenTicket::class)->latestOfMany();
    }

    /** Dine-in tickets that still hold a table (not paid / not completed). */
    public function scopeOccupyingTable($query)
    {
        return $query->where(function ($active) {
            $active->whereIn('status', ['OPEN', 'READY'])
                ->orWhere(fn ($billed) => $billed->where('status', 'BILLED')->whereDoesntHave('payment'));
        });
    }
}

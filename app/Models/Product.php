<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'category_id', 'name', 'description', 'price', 'price_label', 'image', 'is_available', 'is_orderable', 'sort_order',
    ];

    protected function casts(): array
    {
        return ['price' => 'decimal:2', 'is_available' => 'boolean', 'is_orderable' => 'boolean'];
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function inventory()
    {
        return $this->hasOne(Inventory::class);
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    public static function menuItems()
    {
        return static::query()
            ->with(['category.parent'])
            ->whereRaw('is_available IS TRUE')
            ->orderBy('sort_order')
            ->get();
    }

    public function sellablePrice(): ?float
    {
        if (! $this->is_orderable || $this->price === null) {
            return null;
        }

        return (float) $this->price;
    }
}

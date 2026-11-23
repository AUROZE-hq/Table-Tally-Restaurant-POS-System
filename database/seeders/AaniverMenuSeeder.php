<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Inventory;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AaniverMenuSeeder extends Seeder
{
    /**
     * Replace the demo menu with the Aaniver Restaurant catalog.
     * Clears order line items so products can be removed safely (order headers are kept for history).
     */
    public function run(): void
    {
        DB::transaction(function () {
            OrderItem::query()->delete();
            Payment::query()->delete();
            StockMovement::query()->delete();
            Inventory::query()->delete();
            Product::query()->forceDelete();
            Category::query()->forceDelete();

            foreach ($this->menu() as $categoryName => $items) {
                $category = Category::create([
                    'name' => $categoryName,
                    'is_active' => true,
                ]);

                foreach ($items as $item) {
                    $product = Product::create([
                        'category_id' => $category->id,
                        'name' => $item['name'],
                        'description' => $item['description'] ?? null,
                        'price' => $item['price'],
                        'is_available' => true,
                    ]);

                    Inventory::create([
                        'product_id' => $product->id,
                        'current_stock' => 999,
                        'minimum_stock' => 0,
                        'unit' => 'pcs',
                    ]);
                }
            }
        });
    }

    /**
     * @return array<string, list<array{name: string, price: float, description?: string}>>
     */
    private function menu(): array
    {
        return [
            'Breakfast' => [
                ['name' => "Today's Millet Idly", 'price' => 280],
                ['name' => 'Rainbow Mini Idly', 'price' => 320],
                ['name' => 'Ghee Idly', 'price' => 300],
                ['name' => 'Egg Idly Bowl', 'price' => 420],
                ['name' => "Today's Millet Dosa", 'price' => 320],
                ['name' => 'Beetroot Dosa', 'price' => 380],
                ['name' => 'Spinach Dosa', 'price' => 380],
                ['name' => 'Carrot Dosa', 'price' => 380],
                ['name' => 'Egg Dosa', 'price' => 450],
                ['name' => 'Masala Dosa', 'price' => 480],
                ['name' => 'Coconut Sambol', 'price' => 80],
                ['name' => 'Tomato Chutney', 'price' => 80],
                ['name' => 'Mint Chutney', 'price' => 80],
                ['name' => 'Sambar', 'price' => 120],
            ],
            'Pittu & Idiyappam Bar' => [
                ['name' => 'Pittu — Kodo Millet', 'price' => 380],
                ['name' => 'Pittu — Little Millet', 'price' => 380],
                ['name' => 'Pittu — Barnyard Millet', 'price' => 380],
                ['name' => 'Pittu — Finger Millet', 'price' => 400],
                ['name' => 'Pittu — Pearl Millet', 'price' => 380],
                ['name' => 'Pittu — Foxtail Millet', 'price' => 380],
                ['name' => 'Pittu — Multi-Millet', 'price' => 420],
                ['name' => 'Idiyappam — Kodo Millet', 'price' => 380],
                ['name' => 'Idiyappam — Little Millet', 'price' => 380],
                ['name' => 'Idiyappam — Barnyard Millet', 'price' => 380],
                ['name' => 'Idiyappam — Finger Millet', 'price' => 400],
                ['name' => 'Idiyappam — Pearl Millet', 'price' => 380],
                ['name' => 'Idiyappam — Foxtail Millet', 'price' => 380],
                ['name' => 'Idiyappam — Multi-Millet', 'price' => 420],
                ['name' => 'Side: Vegetable Curry', 'price' => 180],
                ['name' => 'Side: Dhal Curry', 'price' => 160],
                ['name' => 'Side: Egg Curry', 'price' => 220],
                ['name' => 'Side: Sothi', 'price' => 140],
                ['name' => 'Side: Coconut Milk', 'price' => 120],
                ['name' => 'Side: Coconut Sambol', 'price' => 80],
                ['name' => 'Side: Lunu Miris', 'price' => 60],
            ],
            'Healthy Starters & Light Bites' => [
                ['name' => 'Aaniver Rainbow Salad', 'price' => 550],
                ['name' => 'Sprouted Green Gram Salad', 'price' => 420],
                ['name' => 'Egg Power Salad', 'price' => 480],
                ['name' => 'Grilled Paneer', 'price' => 520],
                ['name' => 'Millet Cutlets', 'price' => 380],
                ['name' => 'Soup of the Day', 'price' => 350],
            ],
            'Traditional Lunch' => [
                ['name' => "Farmer's Lunch", 'price' => 950, 'description' => 'Mixed millet or red rice, 3 seasonal vegetable curries, dhal, greens, sambol, pickle & papadam'],
                ['name' => 'Wellness Lunch', 'price' => 920, 'description' => 'Mixed millet, seasonal vegetables, salad, dhal and herbal accompaniment'],
                ['name' => 'Egg Lunch', 'price' => 980, 'description' => 'Traditional lunch with boiled egg or egg curry'],
            ],
            'Aaniver Wellness Meals' => [
                ['name' => 'Detox Plate', 'price' => 1100],
                ['name' => 'Low GI Plate', 'price' => 1050],
                ['name' => 'Protein Plate', 'price' => 1150],
                ['name' => "Women's Wellness Plate", 'price' => 1180],
                ['name' => 'Kids Growth Plate', 'price' => 650],
            ],
            'Aaniver Signature Platters' => [
                ['name' => 'Rainbow Breakfast Platter', 'price' => 1800],
                ['name' => 'Millet Explorer Platter', 'price' => 2200],
                ['name' => 'Family Sharing Board', 'price' => 3200],
            ],
            'Kanji' => [
                ['name' => 'Aaniver Multi-Millet Kanji', 'price' => 380],
                ['name' => 'Finger Millet Kanji', 'price' => 360],
                ['name' => 'Green Gram Kanji', 'price' => 340],
                ['name' => 'Horse Gram Kanji', 'price' => 360],
                ['name' => 'Seasonal Village Kanji', 'price' => 400, 'description' => 'With seasonal village greens'],
            ],
            "Little Farmers' Menu (Kids)" => [
                ['name' => 'Rainbow Breakfast (Kids)', 'price' => 450],
                ['name' => 'Smiley Egg Dosa', 'price' => 420],
                ['name' => 'Mini Idly Set', 'price' => 380],
                ['name' => 'Millet Pancakes', 'price' => 400],
            ],
            'Healthy Drinks' => [
                ['name' => 'Finger Millet Malt', 'price' => 280],
                ['name' => 'Multi-Millet Health Drink', 'price' => 300],
                ['name' => 'Fresh Lime Juice', 'price' => 220],
                ['name' => 'Passion Fruit Juice', 'price' => 320],
                ['name' => 'Wood Apple Juice', 'price' => 300],
                ['name' => 'Pineapple Juice', 'price' => 280],
                ['name' => 'Watermelon Juice', 'price' => 250],
                ['name' => 'Moringa Tea', 'price' => 180],
                ['name' => 'Tulsi Tea', 'price' => 180],
                ['name' => 'Ginger Tea', 'price' => 180],
                ['name' => 'Lemongrass Tea', 'price' => 180],
                ['name' => 'Cinnamon Tea', 'price' => 200],
            ],
            'Healthy Desserts' => [
                ['name' => 'Millet Payasam', 'price' => 320],
                ['name' => 'Finger Millet Pudding', 'price' => 350],
                ['name' => 'Curd with Kithul Treacle', 'price' => 280],
                ['name' => 'Seasonal Fruit Bowl', 'price' => 380],
            ],
            'Take-Home Products' => [
                ['name' => 'Multi-Millet Flour', 'price' => 650],
                ['name' => 'Pittu Flour', 'price' => 580],
                ['name' => 'Porridge Mixes', 'price' => 720],
                ['name' => 'Baby Food Range', 'price' => 850],
                ['name' => 'Millet Flakes', 'price' => 480],
                ['name' => 'Millet Cookies', 'price' => 420],
                ['name' => 'Herbal Teas (pack)', 'price' => 380],
                ['name' => 'Horse Gram Powder', 'price' => 450],
                ['name' => 'Fenugreek Powder', 'price' => 420],
            ],
        ];
    }
}
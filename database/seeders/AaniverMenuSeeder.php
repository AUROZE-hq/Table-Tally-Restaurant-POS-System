<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Inventory;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class VaavikkaraiMenuSeeder extends Seeder
{
    /**
     * Replace the selling menu. Past order lines keep a stored item name.
     */
    public function run(): void
    {
        DB::transaction(function () {
            Product::withTrashed()->forceDelete();
            Category::withTrashed()->whereNotNull('parent_id')->forceDelete();
            Category::withTrashed()->forceDelete();

            $sort = 1;
            $productSort = 1;

            foreach ($this->catalog() as $section) {
                $category = Category::create([
                    'name' => $section['name'],
                    'description' => $section['description'] ?? null,
                    'is_active' => true,
                    'sort_order' => $sort,
                ]);
                $sort++;

                foreach ($section['items'] ?? [] as $item) {
                    $this->createProduct($category, $item, $productSort);
                    $productSort++;
                }

                foreach ($section['children'] ?? [] as $child) {
                    $sub = Category::create([
                        'parent_id' => $category->id,
                        'name' => $child['name'],
                        'description' => $child['description'] ?? null,
                        'is_active' => true,
                        'sort_order' => $sort,
                    ]);
                    $sort++;

                    foreach ($child['items'] as $item) {
                        $this->createProduct($sub, $item, $productSort);
                        $productSort++;
                    }
                }
            }
        });
    }

    /**
     * @param  array{name: string, price?: float|null, description?: string, price_label?: string, orderable?: bool}  $item
     */
    private function createProduct(Category $category, array $item, int $sort): void
    {
        $price = $item['price'] ?? null;
        $product = Product::create([
            'category_id' => $category->id,
            'name' => $item['name'],
            'description' => $item['description'] ?? null,
            'price' => $price,
            'price_label' => $price === null ? ($item['price_label'] ?? null) : null,
            'is_available' => true,
            'is_orderable' => $item['orderable'] ?? $price !== null,
            'sort_order' => $sort,
        ]);

        Inventory::create([
            'product_id' => $product->id,
            'current_stock' => 999,
            'minimum_stock' => 0,
            'unit' => 'pcs',
        ]);
    }

    /**
     * @return list<array{name: string, description?: string, items?: list<array<string, mixed>>, children?: list<array{name: string, description?: string, items: list<array<string, mixed>>}>}>
     */
    private function catalog(): array
    {
        $tbc = 'Price to be confirmed';
        $ask = 'Ask our team';

        return [
            [
                'name' => 'Breakfast',
                'children' => [
                    [
                        'name' => 'Idly',
                        'items' => [
                            ['name' => "Today's Millet Idly Set (5 pcs)", 'price' => 290],
                            ['name' => 'Normal Idly Set (5 pcs)', 'price' => 250],
                            ['name' => 'Rainbow Mini Idly', 'price' => 350],
                            ['name' => 'Ghee Idly', 'price' => 350],
                            ['name' => 'Egg Idly Bowl', 'price' => 350],
                        ],
                    ],
                    [
                        'name' => 'Dosa',
                        'description' => 'Served with coconut sambol, tomato chutney, mint chutney and sambar.',
                        'items' => [
                            ['name' => "Today's Millet Dosa", 'price' => 350],
                            ['name' => 'Beetroot Dosa', 'price' => 300],
                            ['name' => 'Spinach Dosa', 'price' => 300],
                            ['name' => 'Carrot Dosa', 'price' => 300],
                            ['name' => 'Egg Dosa', 'price' => 400],
                            ['name' => 'Masala Dosa', 'price' => 400],
                        ],
                    ],
                    [
                        'name' => "Today's Millet",
                        'description' => "Info only, not orderable. The featured millet changes daily and is used in that day's idly and dosa batter.",
                        'items' => [
                            ['name' => 'Monday: Kodo Millet (Varagu)', 'orderable' => false],
                            ['name' => 'Tuesday: Little Millet (Samai)', 'orderable' => false],
                            ['name' => 'Wednesday: Barnyard Millet (Kuthiraivali)', 'orderable' => false],
                            ['name' => 'Thursday: Finger Millet (Kurakkan)', 'orderable' => false],
                            ['name' => 'Friday: Pearl Millet (Kambu)', 'orderable' => false],
                            ['name' => 'Saturday: Foxtail Millet (Thinai)', 'orderable' => false],
                            ['name' => "Sunday: Chef's Mixed Millet Special", 'orderable' => false],
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Traditional Lunch',
                'children' => [
                    [
                        'name' => "Farmer's Lunch",
                        'items' => [
                            ['name' => 'Red or White Rice – Vegetarian', 'price' => 350, 'description' => 'Rice with seasonal vegetable curries and traditional accompaniments.'],
                            ['name' => 'Red or White Rice – Egg', 'price' => 450, 'description' => 'Traditional rice meal with egg.'],
                            ['name' => 'Millet Rice – Vegetarian', 'price' => 400, 'description' => 'Millet rice with seasonal vegetable curries and traditional accompaniments.'],
                            ['name' => 'Millet Rice – Egg', 'price' => 500, 'description' => 'Millet rice meal served with egg.'],
                        ],
                    ],
                    [
                        'name' => 'Wellness Lunch',
                        'items' => [
                            ['name' => 'Wellness Lunch – Vegetarian', 'price' => 420, 'description' => 'More vegetables, less millet rice, with dhal and seasonal accompaniments.'],
                            ['name' => 'Wellness Lunch – Egg', 'price' => 500, 'description' => 'More vegetables, less millet rice, with egg and seasonal accompaniments.'],
                        ],
                    ],
                    [
                        'name' => 'Egg Lunch',
                        'items' => [
                            ['name' => 'Egg Lunch', 'price_label' => $tbc, 'description' => 'Traditional lunch with your choice of boiled egg or egg curry.'],
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Pittu & Idiyappam Bar',
                'children' => [
                    [
                        'name' => 'Pittu',
                        'items' => [
                            ['name' => 'All varieties of Millet Pittu', 'price' => 275, 'description' => 'Kodo, little, barnyard, finger, pearl, foxtail and mixed millet.'],
                            ['name' => 'Rice Flour Pittu', 'price' => 145],
                        ],
                    ],
                    [
                        'name' => 'Idiyappam (String Hoppers)',
                        'items' => [
                            ['name' => 'Millet Idiyappam (8 pcs)', 'price' => 180, 'description' => 'Available in millet varieties.'],
                            ['name' => 'Red Rice Idiyappam (10 pcs)', 'price' => 120],
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Curries & Accompaniments',
                'items' => [
                    ['name' => 'Vegetable Curry', 'price' => 90],
                    ['name' => 'Dhal Curry', 'price' => 100],
                    ['name' => 'Egg Curry', 'price' => 130],
                    ['name' => 'Sothi', 'price' => 100],
                    ['name' => 'Coconut Milk', 'price' => 100],
                    ['name' => 'Coconut Sambol', 'price' => 55],
                    ['name' => 'Paneer Curry', 'price' => 325],
                    ['name' => 'Nattu Kozhi Curry', 'price' => 350],
                    ['name' => 'Fish Curry', 'price' => 175],
                    ['name' => 'Pittu Kothu and String Hopper Kothu', 'price_label' => $ask, 'description' => 'Egg / chicken options. Ask our team for availability and price.'],
                ],
            ],
            [
                'name' => 'Healthy Starters & Light Bites',
                'items' => [
                    ['name' => 'Vaavikkarai Rainbow Salad', 'price_label' => $tbc, 'description' => 'A colourful mix of fresh vegetables and greens.'],
                    ['name' => 'Sprouted Green Gram Salad', 'price_label' => $tbc, 'description' => 'Fresh sprouted green gram with seasonal vegetables.'],
                    ['name' => 'Egg Power Salad', 'price_label' => $tbc, 'description' => 'A protein-rich salad with egg.'],
                    ['name' => 'Grilled Paneer', 'price_label' => $tbc],
                    ['name' => 'Millet Cutlets', 'price_label' => $tbc],
                    ['name' => 'Soup of the Day', 'price_label' => $tbc, 'description' => "Ask for today's freshly prepared soup."],
                ],
            ],
            [
                'name' => 'Vaavikkarai Wellness Meals',
                'description' => 'LKR 599 per plate.',
                'items' => [
                    ['name' => 'Detox Plate', 'price' => 599, 'description' => 'Mixed millet, steamed vegetables, leafy greens, sprouts, fresh salad and herbal tea.'],
                    ['name' => 'Low GI Plate', 'price' => 599, 'description' => 'Low-GI millet, vegetable curries, dhal, greens, cucumber salad and a sugar-free herbal drink.'],
                    ['name' => 'Protein Plate', 'price' => 599, 'description' => 'Millet, legumes, sprouts, boiled egg, seasonal vegetables and finger millet malt.'],
                    ['name' => "Women's Wellness Plate", 'price' => 599, 'description' => 'Iron-rich millet, beetroot, drumstick leaves, sesame, legumes and finger millet malt.'],
                    ['name' => 'Kids Growth Plate', 'price' => 599, 'description' => 'Rainbow mini idlies, egg, fresh fruit, millet pancake and fresh juice.'],
                ],
            ],
            [
                'name' => 'Special Orders & Beverages',
                'items' => [
                    ['name' => 'Kiribath', 'price_label' => $tbc, 'description' => 'Available on special order.'],
                    ['name' => 'Egg Cutlet / Fish Cutlet / Patties', 'price_label' => $tbc, 'description' => 'Special orders.'],
                    ['name' => 'Milk Tea / Plain Tea / Milk', 'price_label' => $tbc],
                    ['name' => 'Tea with Snacks Package', 'price_label' => $tbc],
                ],
            ],
        ];
    }
}

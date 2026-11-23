<?php

namespace Database\Seeders;

use App\Models\RestaurantTable;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(['email' => 'admin@restaurant.com'], [
            'name' => 'Restaurant Admin',
            'password' => Hash::make('password'),
            'role' => 'ADMIN',
            'is_active' => true,
        ]);

        User::updateOrCreate(['email' => 'cashier@restaurant.com'], [
            'name' => 'Front Counter',
            'password' => Hash::make('password'),
            'role' => 'CASHIER',
            'is_active' => true,
        ]);

        User::updateOrCreate(['email' => 'server@restaurant.com'], [
            'name' => 'Floor Server',
            'password' => Hash::make('password'),
            'role' => 'SERVER',
            'is_active' => true,
        ]);

        $this->call(AaniverMenuSeeder::class);

        foreach (range(1, 6) as $number) {
            RestaurantTable::updateOrCreate(['name' => sprintf('Table %02d', $number)], [
                'status' => 'AVAILABLE',
                'is_active' => true,
            ]);
        }
    }
}

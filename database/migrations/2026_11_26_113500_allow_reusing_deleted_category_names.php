<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_unique');
        DB::statement('DROP INDEX IF EXISTS categories_name_unique');
        DB::statement('CREATE UNIQUE INDEX categories_name_unique ON categories (name) WHERE deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS categories_name_unique');
        DB::statement('ALTER TABLE categories ADD CONSTRAINT categories_name_unique UNIQUE (name)');
    }
};

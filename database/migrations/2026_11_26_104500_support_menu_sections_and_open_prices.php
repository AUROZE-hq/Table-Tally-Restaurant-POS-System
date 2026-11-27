<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->text('description')->nullable();
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('price_label')->nullable();
            $table->boolean('is_orderable')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
        });

        DB::statement('ALTER TABLE products ALTER COLUMN price DROP NOT NULL');

        Schema::table('order_items', function (Blueprint $table) {
            $table->string('product_name')->nullable();
        });

        DB::statement('UPDATE order_items SET product_name = products.name FROM products WHERE order_items.product_id = products.id AND order_items.product_name IS NULL');

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
        });

        DB::statement('ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL');

        Schema::table('order_items', function (Blueprint $table) {
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
        });

        DB::statement('DELETE FROM order_items WHERE product_id IS NULL');
        DB::statement('ALTER TABLE order_items ALTER COLUMN product_id SET NOT NULL');

        Schema::table('order_items', function (Blueprint $table) {
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
            $table->dropColumn('product_name');
        });

        DB::statement('UPDATE products SET price = 0 WHERE price IS NULL');
        DB::statement('ALTER TABLE products ALTER COLUMN price SET NOT NULL');

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['price_label', 'is_orderable', 'sort_order']);
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_id');
            $table->dropColumn(['sort_order', 'description']);
        });
    }
};

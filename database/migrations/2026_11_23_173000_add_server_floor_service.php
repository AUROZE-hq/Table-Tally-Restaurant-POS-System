<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $this->replaceCheck('users', 'role', ['ADMIN', 'CASHIER', 'SERVER']);
        $this->replaceCheck('orders', 'status', ['OPEN', 'READY', 'BILLED', 'COMPLETED', 'CANCELLED']);

        if (Schema::hasColumn('orders', 'server_id')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['cashier_id']);
        });

        DB::statement('ALTER TABLE orders ALTER COLUMN cashier_id DROP NOT NULL');

        Schema::table('orders', function (Blueprint $table) {
            $table->foreign('cashier_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreignId('server_id')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! Schema::hasColumn('orders', 'server_id')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('server_id');
        });

        DB::statement('UPDATE orders SET cashier_id = (SELECT id FROM users ORDER BY id LIMIT 1) WHERE cashier_id IS NULL');
        DB::statement('ALTER TABLE orders ALTER COLUMN cashier_id SET NOT NULL');

        $this->replaceCheck('orders', 'status', ['OPEN', 'COMPLETED', 'CANCELLED']);
        $this->replaceCheck('users', 'role', ['ADMIN', 'CASHIER']);
    }

    /**
     * @param  list<string>  $values
     */
    private function replaceCheck(string $table, string $column, array $values): void
    {
        $row = DB::selectOne(
            "SELECT c.conname AS name
             FROM pg_constraint c
             JOIN pg_class t ON c.conrelid = t.oid
             JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
             WHERE t.relname = ? AND a.attname = ? AND c.contype = 'c'
             LIMIT 1",
            [$table, $column]
        );

        if ($row) {
            DB::statement('ALTER TABLE "'.$table.'" DROP CONSTRAINT "'.$row->name.'"');
        }

        $list = implode(', ', array_map(fn (string $value) => "'".$value."'", $values));
        DB::statement('ALTER TABLE "'.$table.'" ADD CONSTRAINT "'.$table.'_'.$column.'_check" CHECK ("'.$column.'" in ('.$list.'))');
    }
};

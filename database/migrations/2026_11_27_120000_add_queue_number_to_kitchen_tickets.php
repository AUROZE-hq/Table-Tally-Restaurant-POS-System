<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kitchen_tickets', function (Blueprint $table) {
            $table->unsignedInteger('queue_number')->nullable()->after('heading');
            $table->index(['created_at', 'queue_number']);
        });
    }

    public function down(): void
    {
        Schema::table('kitchen_tickets', function (Blueprint $table) {
            $table->dropIndex(['created_at', 'queue_number']);
            $table->dropColumn('queue_number');
        });
    }
};
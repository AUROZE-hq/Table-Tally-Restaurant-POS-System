<?php

use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RestaurantTableController;
use App\Http\Controllers\ShiftController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth'])->group(function () {
    Route::get('products', [ProductController::class, 'index']);
    Route::get('products/{product}', [ProductController::class, 'show']);
    Route::middleware('role:ADMIN')->apiResource('products', ProductController::class)->except(['index', 'show']);
    Route::get('categories', [CategoryController::class, 'index']);
    Route::get('categories/{category}', [CategoryController::class, 'show']);
    Route::middleware('role:ADMIN')->apiResource('categories', CategoryController::class)->except(['index', 'show']);
    Route::apiResource('customers', CustomerController::class);
    Route::get('tables', [RestaurantTableController::class, 'index']);
    Route::middleware('role:ADMIN')->apiResource('tables', RestaurantTableController::class)->except(['index', 'show']);
    Route::get('floor', [OrderController::class, 'floor']);
    Route::get('orders/history', [OrderController::class, 'history']);
    Route::get('orders/mine', [OrderController::class, 'serverHistory']);
    Route::post('orders/{order}/ready', [OrderController::class, 'ready']);
    Route::post('orders/{order}/bill', [OrderController::class, 'bill']);
    Route::post('orders/{order}/complete', [OrderController::class, 'complete']);
    Route::apiResource('orders', OrderController::class)->only(['index', 'store', 'show']);
    Route::get('shift/current', [ShiftController::class, 'current']);
    Route::post('shift', [ShiftController::class, 'store']);
    Route::post('shift/{shift}/close', [ShiftController::class, 'close']);

    Route::middleware('role:ADMIN')->group(function () {
        Route::get('inventory', [InventoryController::class, 'index']);
        Route::post('inventory/{inventory}/movement', [InventoryController::class, 'update']);
        Route::apiResource('expenses', ExpenseController::class)->except(['show']);
        Route::apiResource('users', UserController::class)->except(['show']);
        Route::get('reports', [ReportController::class, 'index']);
    });
});

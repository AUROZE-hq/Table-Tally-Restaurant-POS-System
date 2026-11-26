<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->user()?->isAdmin() && $request->has('page')) {
            $perPage = min(50, max(1, $request->integer('per_page', 10)));
            $query = Product::query()
                ->with(['category:id,name,parent_id', 'category.parent:id,name'])
                ->orderBy('sort_order');

            if ($search = trim($request->string('search')->toString())) {
                $query->where('name', 'like', '%'.$search.'%');
            }

            if ($request->filled('category_id')) {
                $query->where('category_id', $request->integer('category_id'));
            }

            return response()->json($query->paginate($perPage));
        }

        $products = Product::with(['category.parent'])
            ->whereRaw('is_available IS TRUE')
            ->when($request->search, fn ($query, $search) => $query->where('name', 'like', "%{$search}%"))
            ->when($request->category_id, fn ($query, $categoryId) => $query->where('category_id', $categoryId))
            ->orderBy('sort_order')
            ->get();

        return response()->json($products);
    }

    public function store(Request $request): JsonResponse
    {
        $product = Product::create($request->validate([
            'category_id' => ['required', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string'],
            'price' => ['nullable', 'numeric', 'gt:0', 'required_without:price_label'],
            'price_label' => ['nullable', 'string', 'max:80', 'required_without:price'],
            'image' => ['nullable', 'string'],
            'is_available' => ['boolean'],
            'is_orderable' => ['boolean'],
        ]));

        return response()->json($product->load('category'), 201);
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json($product->load('category', 'inventory'));
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $product->update($request->validate([
            'category_id' => ['sometimes', 'exists:categories,id'],
            'name' => ['sometimes', 'string', 'max:120'],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'nullable', 'numeric', 'gt:0'],
            'price_label' => ['sometimes', 'nullable', 'string', 'max:80'],
            'image' => ['nullable', 'string'],
            'is_available' => ['sometimes', 'boolean'],
            'is_orderable' => ['sometimes', 'boolean'],
        ]));

        return response()->json($product->fresh()->load('category'));
    }

    public function destroy(Product $product): JsonResponse
    {
        $product->delete();

        return response()->json(['message' => 'Product deleted.']);
    }
}

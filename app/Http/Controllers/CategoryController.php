<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->user()?->isAdmin() && $request->has('page')) {
            $perPage = min(50, max(1, $request->integer('per_page', 10)));
            $query = Category::query()->with('parent:id,name')->withCount(['products', 'children'])->orderBy('sort_order');

            if ($search = trim($request->string('search')->toString())) {
                $query->where('name', 'like', '%'.$search.'%');
            }

            return response()->json($query->paginate($perPage));
        }

        return response()->json(
            Category::query()
                ->whereRaw('is_active IS TRUE')
                ->whereNull('parent_id')
                ->with(['children' => fn ($query) => $query->whereRaw('is_active IS TRUE')->orderBy('sort_order')])
                ->withCount('products')
                ->orderBy('sort_order')
                ->get(),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string'],
            'is_active' => ['boolean'],
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
        ]);

        $payload = [
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'parent_id' => $this->parentId($data['parent_id'] ?? null),
        ];

        $existing = Category::withTrashed()->where('name', $data['name'])->first();
        if ($existing && ! $existing->trashed()) {
            return response()->json(['message' => "A category named \"{$data['name']}\" already exists."], 422);
        }

        if ($existing) {
            $existing->restore();
            $existing->update($payload);

            return response()->json($existing->fresh()->load('parent:id,name'), 201);
        }

        $category = Category::create($payload + [
            'sort_order' => ((int) Category::query()->max('sort_order')) + 1,
        ]);

        return response()->json($category->load('parent:id,name'), 201);
    }

    public function show(Category $category): JsonResponse
    {
        return response()->json($category->load('products'));
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'parent_id' => ['sometimes', 'nullable', 'integer', 'exists:categories,id'],
        ]);

        if (array_key_exists('name', $data) && Category::query()->where('name', $data['name'])->whereKeyNot($category->id)->exists()) {
            return response()->json(['message' => "A category named \"{$data['name']}\" already exists."], 422);
        }

        if (array_key_exists('parent_id', $data)) {
            $data['parent_id'] = $this->parentId($data['parent_id'], $category);
        }

        $category->update($data);

        return response()->json($category->fresh()->load('parent:id,name'));
    }

    public function destroy(Category $category): JsonResponse
    {
        DB::transaction(function () use ($category) {
            $childIds = $category->children()->pluck('id');
            $categoryIds = $childIds->prepend($category->id);

            Product::query()->whereIn('category_id', $categoryIds)->delete();
            Category::query()->whereIn('id', $childIds)->delete();
            $category->delete();
        });

        return response()->json(['message' => 'Category deleted.']);
    }

    private function parentId(mixed $parentId, ?Category $category = null): ?int
    {
        if ($parentId === null || $parentId === '') {
            return null;
        }

        $parentId = (int) $parentId;
        if ($category && $category->id === $parentId) {
            abort(422, 'A category cannot sit under itself.');
        }

        $parent = Category::query()->find($parentId);
        if (! $parent || $parent->parent_id !== null) {
            abort(422, 'Choose a main category. A sub-category cannot contain another sub-category.');
        }

        if ($category && $category->children()->exists()) {
            abort(422, 'This category has sub-categories, so it has to stay a main category.');
        }

        return $parent->id;
    }
}

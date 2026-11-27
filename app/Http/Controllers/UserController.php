<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(User::select('id', 'name', 'email', 'role', 'is_active')->latest()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'in:ADMIN,CASHIER'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (! isset($data['is_active'])) {
            $data['is_active'] = true;
        }

        return response()->json(User::create($data)->only(['id', 'name', 'email', 'role', 'is_active']), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id && $request->has('is_active') && ! $request->boolean('is_active')) {
            throw ValidationException::withMessages([
                'is_active' => 'You cannot deactivate your own account while signed in.',
            ]);
        }

        if ($request->user()->id === $user->id && $request->has('role') && $request->input('role') !== $user->role) {
            throw ValidationException::withMessages([
                'role' => 'You cannot change your own role while signed in.',
            ]);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'unique:users,email,'.$user->id],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['sometimes', 'in:ADMIN,CASHIER,SERVER'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if (empty($data['password'])) {
            unset($data['password']);
        }
        $user->update($data);

        return response()->json($user->fresh()->only(['id', 'name', 'email', 'role', 'is_active']));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }

        $hasHistory = Order::where('cashier_id', $user->id)->orWhere('server_id', $user->id)->exists();

        if ($hasHistory) {
            $user->update(['is_active' => false]);

            return response()->json([
                'message' => 'User has order history, so the account was deactivated instead of deleted.',
                'deactivated' => true,
            ]);
        }

        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }
}

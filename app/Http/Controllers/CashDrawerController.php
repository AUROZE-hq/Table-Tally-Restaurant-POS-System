<?php

namespace App\Http\Controllers;

use App\Services\CashDrawer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class CashDrawerController extends Controller
{
    public function kick(Request $request, CashDrawer $drawer): JsonResponse
    {
        abort_unless($request->user()->isCashier() || $request->user()->isAdmin(), 403);

        $data = $request->validate([
            'payment_method' => ['required', 'in:CASH,CARD,LANKAQR'],
        ]);

        if ($data['payment_method'] !== 'CASH') {
            return response()->json([
                'opened' => false,
                'skipped' => true,
                'reason' => 'not_cash',
            ]);
        }

        if (! $drawer->configured()) {
            return response()->json([
                'opened' => false,
                'skipped' => true,
                'optional' => true,
                'message' => 'Cash drawer printer is not set up.',
            ]);
        }

        try {
            $drawer->open();

            return response()->json(['opened' => true]);
        } catch (Throwable $exception) {
            return response()->json([
                'opened' => false,
                'skipped' => true,
                'optional' => true,
                'message' => $exception->getMessage(),
            ]);
        }
    }
}
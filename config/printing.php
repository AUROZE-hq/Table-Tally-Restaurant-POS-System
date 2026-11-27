<?php

return [
    'kitchen' => [
        'host' => env('KITCHEN_PRINTER_HOST'),
        'port' => (int) env('KITCHEN_PRINTER_PORT', 9100),
        'timeout' => (float) env('KITCHEN_PRINTER_TIMEOUT', 4),
    ],
    'cash_drawer' => [
        // Usually the USB/LAN receipt printer the till drawer is wired to (ESC/POS port 9100).
        'host' => env('CASH_DRAWER_PRINTER_HOST', env('RECEIPT_PRINTER_HOST')),
        'port' => (int) env('CASH_DRAWER_PRINTER_PORT', env('RECEIPT_PRINTER_PORT', 9100)),
        'timeout' => (float) env('CASH_DRAWER_PRINTER_TIMEOUT', 4),
        'pin' => (int) env('CASH_DRAWER_PIN', 0),
        'pulse_on_ms' => (int) env('CASH_DRAWER_PULSE_ON_MS', 50),
        'pulse_off_ms' => (int) env('CASH_DRAWER_PULSE_OFF_MS', 200),
    ],
];

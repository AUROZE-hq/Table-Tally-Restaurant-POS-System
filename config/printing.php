<?php

return [
    'kitchen' => [
        'host' => env('KITCHEN_PRINTER_HOST'),
        'port' => (int) env('KITCHEN_PRINTER_PORT', 9100),
        'timeout' => (float) env('KITCHEN_PRINTER_TIMEOUT', 4),
    ],
    'cash_drawer' => [
        // LAN receipt printer only. Leave empty for the USB till printer on the cashier PC.
        'host' => env('CASH_DRAWER_PRINTER_HOST', env('RECEIPT_PRINTER_HOST')),
        'port' => (int) env('CASH_DRAWER_PRINTER_PORT', env('RECEIPT_PRINTER_PORT', 9100)),
        'timeout' => (float) env('CASH_DRAWER_PRINTER_TIMEOUT', 4),
        // Windows USB till printer name. Empty = POS/receipt printer, else the Windows default printer.
        'printer_name' => env('CASH_DRAWER_PRINTER_NAME', env('RECEIPT_PRINTER_NAME')),
        // Optional serial path such as COM3 when the USB printer exposes a COM port.
        'usb_path' => env('CASH_DRAWER_USB_PATH', env('RECEIPT_USB_PATH')),
        'pin' => (int) env('CASH_DRAWER_PIN', 0),
        'pulse_on_ms' => (int) env('CASH_DRAWER_PULSE_ON_MS', 100),
        'pulse_off_ms' => (int) env('CASH_DRAWER_PULSE_OFF_MS', 200),
    ],
];

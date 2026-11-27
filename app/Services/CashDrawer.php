<?php

namespace App\Services;

use RuntimeException;

class CashDrawer
{
    public function __construct(private WindowsRawPrinter $windowsPrinter) {}

    public function configured(): bool
    {
        if (app()->environment('testing') && $this->lanHost() === '' && $this->usbPath() === '' && $this->printerName() === '') {
            return false;
        }

        return $this->lanHost() !== ''
            || $this->usbPath() !== ''
            || $this->printerName() !== ''
            || PHP_OS_FAMILY === 'Windows';
    }

    public function open(): void
    {
        $payload = $this->kickPayload();

        $host = $this->lanHost();
        if ($host !== '') {
            $this->sendLan($host, $payload);

            return;
        }

        $usbPath = $this->usbPath();
        if ($usbPath !== '') {
            $this->sendFile($usbPath, $payload);

            return;
        }

        $this->windowsPrinter->send($payload, $this->printerName() ?: null);
    }

    public function kickPayload(): string
    {
        $pin = (int) config('printing.cash_drawer.pin', 0);
        $onMs = max(1, min(255, (int) config('printing.cash_drawer.pulse_on_ms', 100)));
        $offMs = max(1, min(255, (int) config('printing.cash_drawer.pulse_off_ms', 200)));
        $on = chr($onMs);
        $off = chr($offMs);
        $pins = array_unique([$pin, 0, 1]);

        $bytes = "\x1B@";
        foreach ($pins as $drawerPin) {
            $bytes .= "\x1B\x70".chr((int) $drawerPin).$on.$off;
            $bytes .= "\x1D\x70".chr((int) $drawerPin).$on.$off;
        }

        return $bytes;
    }

    private function sendLan(string $host, string $payload): void
    {
        $port = (int) config('printing.cash_drawer.port', 9100);
        $timeout = (float) config('printing.cash_drawer.timeout', 4);
        $errno = 0;
        $error = '';
        $socket = @fsockopen($host, $port, $errno, $error, $timeout);
        if ($socket === false) {
            throw new RuntimeException($error !== '' ? "Cash drawer printer unreachable: {$error}" : 'Cash drawer printer unreachable.');
        }

        stream_set_timeout($socket, (int) ceil($timeout));
        $written = @fwrite($socket, $payload);
        $meta = stream_get_meta_data($socket);
        fclose($socket);

        if ($written === false || $written < strlen($payload) || ($meta['timed_out'] ?? false)) {
            throw new RuntimeException('Cash drawer pulse was not sent.');
        }
    }

    private function sendFile(string $path, string $payload): void
    {
        $target = $path;
        if (preg_match('/^COM\d+$/i', $path) === 1) {
            $target = '\\\\.\\'.$path;
        }

        $handle = @fopen($target, 'wb+');
        if ($handle === false) {
            throw new RuntimeException("USB till port {$path} could not be opened.");
        }

        stream_set_timeout($handle, 4);
        $written = @fwrite($handle, $payload);
        fclose($handle);

        if ($written === false || $written < strlen($payload)) {
            throw new RuntimeException("USB till port {$path} did not accept the drawer pulse.");
        }
    }

    private function lanHost(): string
    {
        return trim((string) config('printing.cash_drawer.host'));
    }

    private function usbPath(): string
    {
        return trim((string) config('printing.cash_drawer.usb_path'));
    }

    private function printerName(): string
    {
        return trim((string) config('printing.cash_drawer.printer_name'));
    }
}

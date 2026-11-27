<?php

namespace App\Services;

use RuntimeException;

class CashDrawer
{
    public function configured(): bool
    {
        return trim((string) config('printing.cash_drawer.host')) !== '';
    }

    public function open(): void
    {
        $host = trim((string) config('printing.cash_drawer.host'));
        $port = (int) config('printing.cash_drawer.port', 9100);
        $timeout = (float) config('printing.cash_drawer.timeout', 4);

        if ($host === '') {
            throw new RuntimeException('Cash drawer printer is not configured.');
        }

        $errno = 0;
        $error = '';
        $socket = @fsockopen($host, $port, $errno, $error, $timeout);
        if ($socket === false) {
            throw new RuntimeException($error !== '' ? "Cash drawer printer unreachable: {$error}" : 'Cash drawer printer unreachable.');
        }

        stream_set_timeout($socket, (int) ceil($timeout));
        $payload = $this->kickPayload();
        $written = @fwrite($socket, $payload);
        $meta = stream_get_meta_data($socket);
        fclose($socket);

        if ($written === false || $written < strlen($payload) || ($meta['timed_out'] ?? false)) {
            throw new RuntimeException('Cash drawer pulse was not sent.');
        }
    }

    private function kickPayload(): string
    {
        $pin = (int) config('printing.cash_drawer.pin', 0);
        $onMs = max(1, min(255, (int) config('printing.cash_drawer.pulse_on_ms', 50)));
        $offMs = max(1, min(255, (int) config('printing.cash_drawer.pulse_off_ms', 200)));

        return "\x1B\x70".chr($pin).chr($onMs).chr($offMs);
    }
}
<?php

namespace App\Services;

use App\Models\KitchenTicket;
use RuntimeException;

class KitchenPrinter
{
    public function configured(): bool
    {
        return trim((string) config('printing.kitchen.host')) !== '';
    }

    public function send(KitchenTicket $ticket): void
    {
        $host = trim((string) config('printing.kitchen.host'));
        $port = (int) config('printing.kitchen.port', 9100);
        $timeout = (float) config('printing.kitchen.timeout', 4);

        if ($host === '') {
            throw new RuntimeException('Kitchen printer is not configured.');
        }

        $errno = 0;
        $error = '';
        $socket = @fsockopen($host, $port, $errno, $error, $timeout);
        if ($socket === false) {
            throw new RuntimeException($error !== '' ? "Kitchen printer unreachable: {$error}" : 'Kitchen printer unreachable.');
        }

        stream_set_timeout($socket, (int) ceil($timeout));
        $payload = $this->payload($ticket);
        $written = @fwrite($socket, $payload);
        $meta = stream_get_meta_data($socket);
        fclose($socket);

        if ($written === false || $written < strlen($payload) || ($meta['timed_out'] ?? false)) {
            throw new RuntimeException('Kitchen printer did not accept the full ticket.');
        }
    }

    private function payload(KitchenTicket $ticket): string
    {
        $ticket->loadMissing('items');
        $esc = "\x1B";
        $gs = "\x1D";
        $lines = [$esc.'@'];
        $lines[] = $esc.'a'.chr(1);
        $lines[] = $esc.'E'.chr(1);
        $lines[] = $this->encode('Vaavikkarai Restaurant')."\n";
        $lines[] = $esc.'E'.chr(0);

        if ($ticket->queue_number) {
            $lines[] = $esc.'!'."\x38";
            $lines[] = $this->encode('QUEUE '.$ticket->queue_number)."\n";
            $lines[] = $esc.'!'."\x00";
        }

        if ($ticket->order_type === 'DINE_IN' && $ticket->table_name) {
            $lines[] = $esc.'!'."\x30";
            $lines[] = $this->encode('TABLE '.$ticket->table_name)."\n";
            $lines[] = $esc.'!'."\x00";
        }

        if ($ticket->order_type === 'TAKEAWAY') {
            $lines[] = $esc.'E'.chr(1);
            $lines[] = $this->encode('TAKEAWAY')."\n";
            $lines[] = $esc.'E'.chr(0);
        } elseif ($ticket->heading && $ticket->heading !== 'NEW ORDER') {
            $lines[] = $this->encode($ticket->heading)."\n";
        }

        $lines[] = $this->encode(optional($ticket->created_at)->timezone(config('app.timezone'))->format('d M Y h:i A') ?? now()->format('d M Y h:i A'))."\n";
        $lines[] = $esc.'a'.chr(0);
        $lines[] = str_repeat('-', 32)."\n";

        foreach ($ticket->items as $item) {
            $lines[] = $esc.'!'."\x18";
            $lines[] = $this->encode($item->quantity.' x '.$item->product_name)."\n";
            $lines[] = $esc.'!'."\x00";
            if (filled($item->notes)) {
                $lines[] = $this->encode('  '.$item->notes)."\n";
            }
        }

        $lines[] = "\n\n\n";
        $lines[] = $gs.'V'.chr(66).chr(0);

        return implode('', $lines);
    }

    private function encode(string $value): string
    {
        $clean = str_replace("\r", '', $value);
        if (function_exists('iconv')) {
            $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $clean);
            if ($converted !== false) {
                return $converted;
            }
        }

        return preg_replace('/[^\x09\x0A\x20-\x7E]/', '', $clean) ?? '';
    }
}
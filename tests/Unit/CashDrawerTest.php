<?php

namespace Tests\Unit;

use App\Services\CashDrawer;
use App\Services\WindowsRawPrinter;
use Tests\TestCase;

class CashDrawerTest extends TestCase
{
    public function test_kick_payload_includes_escpos_drawer_pulse(): void
    {
        config()->set('printing.cash_drawer.pin', 0);
        config()->set('printing.cash_drawer.pulse_on_ms', 100);
        config()->set('printing.cash_drawer.pulse_off_ms', 200);

        $drawer = new CashDrawer($this->createMock(WindowsRawPrinter::class));
        $payload = $drawer->kickPayload();

        $this->assertStringStartsWith("\x1B@", $payload);
        $this->assertStringContainsString("\x1B\x70\x00".chr(100).chr(200), $payload);
        $this->assertStringContainsString("\x1B\x70\x01".chr(100).chr(200), $payload);
    }

    public function test_drawer_is_not_configured_during_tests_without_a_target(): void
    {
        config()->set('printing.cash_drawer.host', '');
        config()->set('printing.cash_drawer.usb_path', '');
        config()->set('printing.cash_drawer.printer_name', '');

        $drawer = new CashDrawer($this->createMock(WindowsRawPrinter::class));

        $this->assertFalse($drawer->configured());
    }
}

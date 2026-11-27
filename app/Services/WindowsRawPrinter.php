<?php

namespace App\Services;

use RuntimeException;
use Symfony\Component\Process\Process;

class WindowsRawPrinter
{
    public function send(string $payload, ?string $printerName = null): void
    {
        if (PHP_OS_FAMILY !== 'Windows') {
            throw new RuntimeException('USB till printing is only available on the cashier Windows PC.');
        }

        $script = base_path('app/Services/windows-raw-print.ps1');
        if (! is_file($script)) {
            throw new RuntimeException('USB till print helper is missing.');
        }

        $dataFile = tempnam(sys_get_temp_dir(), 'escpos');
        if ($dataFile === false || file_put_contents($dataFile, $payload) === false) {
            throw new RuntimeException('Unable to stage the cash drawer pulse.');
        }

        $powershell = getenv('SystemRoot')
            ? getenv('SystemRoot').'\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
            : 'powershell.exe';

        try {
            $process = new Process([
                $powershell,
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                $script,
                '-PrinterName',
                (string) $printerName,
                '-FilePath',
                $dataFile,
            ]);
            $process->setTimeout(12);
            $process->run();

            if (! $process->isSuccessful()) {
                $error = trim($process->getErrorOutput().' '.$process->getOutput());
                throw new RuntimeException($error !== '' ? $error : 'USB till printer did not accept the drawer pulse.');
            }
        } finally {
            @unlink($dataFile);
        }
    }
}

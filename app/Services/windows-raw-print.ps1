param(
    [string]$PrinterName = '',
    [Parameter(Mandatory = $true)][string]$FilePath
)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class EscPosRawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static void SendBytes(string printerName, byte[] data) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            throw new Exception("OpenPrinter failed: " + Marshal.GetLastWin32Error());
        }
        try {
            DOCINFOA di = new DOCINFOA();
            di.pDocName = "Cash drawer";
            di.pDataType = "RAW";
            if (!StartDocPrinter(hPrinter, 1, di)) {
                throw new Exception("StartDocPrinter failed: " + Marshal.GetLastWin32Error());
            }
            StartPagePrinter(hPrinter);
            IntPtr p = Marshal.AllocHGlobal(data.Length);
            try {
                Marshal.Copy(data, 0, p, data.Length);
                int written;
                if (!WritePrinter(hPrinter, p, data.Length, out written) || written < data.Length) {
                    throw new Exception("WritePrinter failed: " + Marshal.GetLastWin32Error());
                }
            } finally {
                Marshal.FreeHGlobal(p);
            }
            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
        } finally {
            ClosePrinter(hPrinter);
        }
    }
}
"@

function Resolve-TillPrinter([string]$Name) {
    if ($Name) {
        return $Name
    }

    $printers = @(Get-CimInstance -ClassName Win32_Printer)
    $preferred = $printers | Where-Object {
        $_.Name -match 'POS|Receipt|Thermal|Till|Cash|MUNBYN|Xprinter|XP-|TM-|Birch|80mm|Generic'
    } | Select-Object -First 1

    if ($preferred) {
        return $preferred.Name
    }

    $default = $printers | Where-Object { $_.Default -eq $true } | Select-Object -First 1
    if ($default) {
        return $default.Name
    }

    throw "No Windows printer found for the USB till drawer."
}

$target = Resolve-TillPrinter $PrinterName
$bytes = [System.IO.File]::ReadAllBytes($FilePath)
[EscPosRawPrinter]::SendBytes($target, $bytes)
Write-Output $target

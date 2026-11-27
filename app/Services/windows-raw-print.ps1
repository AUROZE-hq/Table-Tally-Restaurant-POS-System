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
    $printers = @(Get-CimInstance -ClassName Win32_Printer)
    $ignored = 'OneNote|PDF|XPS|Fax|AnyDesk|Canon|LBP|Office|Microsoft'

    if ($Name) {
        $exact = $printers | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
        if ($exact) {
            return $exact.Name
        }

        $partial = $printers | Where-Object { $_.Name -like "*$Name*" } | Select-Object -First 1
        if ($partial) {
            return $partial.Name
        }
    }

    $preferred = $printers | Where-Object {
        $_.Name -match 'POS|Receipt|Thermal|Till|Cash|MUNBYN|Xprinter|XP-|TM-|Birch|CP-Q|80mm' -and
        $_.Name -notmatch $ignored
    } | Select-Object -First 1

    if ($preferred) {
        return $preferred.Name
    }

    throw "USB till printer not found. Installed printers: $(($printers | ForEach-Object { $_.Name }) -join ', '). Set CASH_DRAWER_PRINTER_NAME to the Windows name (this PC uses POS-80C, not CP-Q1T)."
}

$target = Resolve-TillPrinter $PrinterName
$bytes = [System.IO.File]::ReadAllBytes($FilePath)
[EscPosRawPrinter]::SendBytes($target, $bytes)
Write-Output $target

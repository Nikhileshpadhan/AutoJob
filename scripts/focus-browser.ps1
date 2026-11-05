param(
    [string]$ProcessName = "chrome"
)

Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WindowFocusHelper {
    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@

$ws = New-Object -ComObject Wscript.Shell

# Retry for up to 4 seconds to allow the browser window handle to appear
for ($i = 0; $i -lt 8; $i++) {
    $procs = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero }
    if ($procs) {
        foreach ($p in $procs) {
            # 9 = SW_RESTORE (restores and displays window even if minimized or unfocused)
            [WindowFocusHelper]::ShowWindowAsync($p.MainWindowHandle, 9) | Out-Null
            [WindowFocusHelper]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
            try {
                $ws.AppActivate($p.Id) | Out-Null
            } catch {}
        }
        break
    }
    Start-Sleep -Milliseconds 500
}


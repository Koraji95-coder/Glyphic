use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct WindowInfo {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub title: String,
}

/// List visible windows on the current desktop.
///
/// Platform-specific implementations are gated behind cfg.  On unsupported
/// platforms an empty list is returned so the frontend can gracefully disable
/// the "Window" capture mode.
#[cfg(target_os = "linux")]
pub fn list_windows() -> Result<Vec<WindowInfo>, String> {
    // On Linux/X11 we use `wmctrl -lG` which is widely available.
    // Falls back to an empty vec if the command is missing.
    use std::process::Command;

    let output = Command::new("wmctrl")
        .args(["-lG"])
        .output()
        .map_err(|_| "wmctrl not available – install wmctrl for window capture".to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut windows = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        // Format: id desktop x y w h hostname title...
        if parts.len() >= 8 {
            let x: i32 = parts[2].parse().unwrap_or(0);
            let y: i32 = parts[3].parse().unwrap_or(0);
            let width: u32 = parts[4].parse().unwrap_or(0);
            let height: u32 = parts[5].parse().unwrap_or(0);
            let title: String = parts[7..].join(" ");

            if width > 10 && height > 10 {
                windows.push(WindowInfo {
                    x,
                    y,
                    width,
                    height,
                    title,
                });
            }
        }
    }

    Ok(windows)
}

#[cfg(target_os = "macos")]
pub fn list_windows() -> Result<Vec<WindowInfo>, String> {
    // macOS: use `osascript` to query window list via AppleScript
    use std::process::Command;

    let script = r#"
        tell application "System Events"
            set windowList to ""
            repeat with proc in (every process whose visible is true)
                try
                    repeat with win in (every window of proc)
                        set {x, y} to position of win
                        set {w, h} to size of win
                        set t to name of win
                        set windowList to windowList & x & "," & y & "," & w & "," & h & "," & t & linefeed
                    end repeat
                end try
            end repeat
            return windowList
        end tell
    "#;

    let output = Command::new("osascript")
        .args(["-e", script])
        .output()
        .map_err(|e| format!("Failed to run osascript: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut windows = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() >= 5 {
            let x: i32 = parts[0].trim().parse().unwrap_or(0);
            let y: i32 = parts[1].trim().parse().unwrap_or(0);
            let width: u32 = parts[2].trim().parse().unwrap_or(0);
            let height: u32 = parts[3].trim().parse().unwrap_or(0);
            let title = parts[4..].join(",").trim().to_string();

            if width > 10 && height > 10 {
                windows.push(WindowInfo {
                    x,
                    y,
                    width,
                    height,
                    title,
                });
            }
        }
    }

    Ok(windows)
}

#[cfg(target_os = "windows")]
pub fn list_windows() -> Result<Vec<WindowInfo>, String> {
    // On Windows, use PowerShell to enumerate visible windows
    use std::process::Command;

    let script = r#"
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        public class WinApi {
            [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
            [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
            [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
            [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
            [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
            public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
            [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
        }
"@
        $windows = @()
        $callback = [WinApi+EnumWindowsProc]{
            param($hWnd, $lParam)
            if ([WinApi]::IsWindowVisible($hWnd)) {
                $len = [WinApi]::GetWindowTextLength($hWnd)
                if ($len -gt 0) {
                    $sb = New-Object System.Text.StringBuilder($len + 1)
                    [WinApi]::GetWindowText($hWnd, $sb, $sb.Capacity) | Out-Null
                    $rect = New-Object WinApi+RECT
                    [WinApi]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
                    $w = $rect.Right - $rect.Left
                    $h = $rect.Bottom - $rect.Top
                    if ($w -gt 10 -and $h -gt 10) {
                        $script:windows += "$($rect.Left),$($rect.Top),$w,$h,$($sb.ToString())"
                    }
                }
            }
            return $true
        }
        [WinApi]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
        $windows -join "`n"
    "#;

    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .map_err(|e| format!("Failed to enumerate windows: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut windows = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() >= 5 {
            let x: i32 = parts[0].trim().parse().unwrap_or(0);
            let y: i32 = parts[1].trim().parse().unwrap_or(0);
            let width: u32 = parts[2].trim().parse().unwrap_or(0);
            let height: u32 = parts[3].trim().parse().unwrap_or(0);
            let title = parts[4..].join(",").trim().to_string();

            if width > 10 && height > 10 {
                windows.push(WindowInfo {
                    x,
                    y,
                    width,
                    height,
                    title,
                });
            }
        }
    }

    Ok(windows)
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
pub fn list_windows() -> Result<Vec<WindowInfo>, String> {
    Ok(Vec::new())
}

import os
import re
import json
import time
import base64
import subprocess
from typing import Optional, Dict, Any, Tuple

import urllib.request
import urllib.error

UUID_RE = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")

class CursorRequestIdError(RuntimeError):
    pass

def _run_osascript(script: str, timeout: float = 8.0) -> Tuple[int, str, str]:
    proc = subprocess.Popen(
        ["/usr/bin/osascript", "-e", script],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        out, err = proc.communicate()
        return 124, out, "AppleScript timed out"
    return proc.returncode, out, err

def _pbpaste() -> str:
    return subprocess.check_output(["/usr/bin/pbpaste"], text=True)

def get_cursor_request_id_via_ui(max_wait: float = 8.0) -> str:
    """
    Opens View -> Command Palette... then runs 'Report AI Action' and clicks 'Copy Request ID'.
    This avoids global hotkeys so keystrokes cannot leak to another app.
    """
    applescript = r'''
    set appName to "Cursor"
    tell application appName to activate
    delay 0.4
    tell application "System Events"
      if not (exists process appName) then error "Cursor is not running"
      tell process appName
        set frontmost to true
        -- Prefer menu navigation over hotkeys
        try
          click menu item "Command Palette..." of menu "View" of menu bar 1
        on error
          -- Fallback to hotkey if menu label changes
          keystroke "p" using {command down, shift down}
        end try
      end tell
    end tell

    delay 0.5
    tell application "System Events"
      tell process appName
        keystroke "Report AI Action"
        delay 0.25
        key code 125 -- Down arrow to highlight first match if needed
        delay 0.1
        key code 36  -- Return to open the panel
        delay 0.9

        -- Click the copy button
        if exists button "Copy Request ID" of window 1 then
          click button "Copy Request ID" of window 1
        else
          -- Fallback: click any button whose name contains 'Request ID'
          repeat with b in buttons of window 1
            try
              set t to name of b
              if t contains "Request ID" then
                click b
                exit repeat
              end if
            end try
          end repeat
        end if
      end tell
    end tell
    delay 0.25
    '''
    code, _, err = _run_osascript(applescript, timeout=10.0)
    if code != 0:
        raise CursorRequestIdError(f"Failed to drive Cursor UI. Error: {err.strip()}")

    deadline = time.time() + max_wait
    while time.time() < deadline:
        try:
            clip = _pbpaste().strip()
        except subprocess.CalledProcessError:
            time.sleep(0.1)
            continue
        m = UUID_RE.search(clip)
        if m:
            return m.group(0)
        time.sleep(0.2)

    raise CursorRequestIdError("Clipboard did not contain a valid Cursor Request ID. Make a fresh AI action, ensure Privacy Mode is off, then retry.")

def _http_request(method: str, url: str, api_key: str, body: Optional[dict] = None, timeout: float = 10.0) -> Tuple[int, dict]:
    req = urllib.request.Request(url, method=method.upper())
    auth = base64.b64encode(f"{api_key}:".encode()).decode()
    req.add_header("Authorization", f"Basic {auth}")
    req.add_header("Content-Type", "application/json")
    data = None
    if body is not None:
        data = json.dumps(body).encode()
    try:
        with urllib.request.urlopen(req, data=data, timeout=timeout) as resp:
            return resp.getcode(), json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        payload = e.read().decode() if hasattr(e, "read") else ""
        try:
            return e.code, json.loads(payload or "{}")
        except Exception:
            return e.code, {"error": payload or str(e)}
    except urllib.error.URLError as e:
        return 0, {"error": str(e)}

def fetch_cursor_usage_for_active_request(api_key: str, prefer_post: bool = True) -> Dict[str, Any]:
    """
    1) Grabs the latest Cursor requestId from the current UI
    2) Queries the Admin API for matching usage events
    Returns: {"request_id": "...", "events": {...raw response...}}
    """
    request_id = get_cursor_request_id_via_ui()

    # Try POST first with a requestId filter, then fall back to GET with ?requestId=
    base = "https://api.cursor.com/teams/filtered-usage-events"
    status, data = (0, {})
    if prefer_post:
        status, data = _http_request("POST", base, api_key, {"requestId": request_id})
        if status in (404, 405, 400) or ("error" in data and not data.get("results")):
            status, data = _http_request("GET", f"{base}?requestId={request_id}", api_key)

    else:
        status, data = _http_request("GET", f"{base}?requestId={request_id}", api_key)
        if status in (404, 405, 400) or ("error" in data and not data.get("results")):
            status, data = _http_request("POST", base, api_key, {"requestId": request_id})

    result = {
        "request_id": request_id,
        "status": status,
        "events": data,
    }
    return result
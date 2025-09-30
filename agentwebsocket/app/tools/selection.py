"""Selection capture tool for macOS (text only).

This tool returns the actual text the user currently has highlighted in the
frontmost application by simulating Command+C, reading the clipboard, and then
restoring the previous clipboard contents.

Notes:
- Requires Accessibility permissions for the host process (e.g., Terminal/IDE) to
  allow scripted keystrokes.
- On failure or if nothing is selected, returns an empty string.
"""

from __future__ import annotations

import subprocess
import time
import os
from typing import Optional


def _run_osascript(script: str, timeout: float = 4.0) -> tuple[int, str, str]:
    """Run an AppleScript via `osascript`.

    Returns (exit_code, stdout, stderr).
    """
    try:
        proc = subprocess.run(
            ["/usr/bin/osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired as e:
        return 124, "", str(e)
    except Exception as e:  # pragma: no cover - defensive
        return 1, "", str(e)


def _copy_via_menu_bar() -> bool:
    """Attempt to trigger Edit > Copy from the frontmost app's menu bar.

    Returns True if the AppleScript ran without error (does not guarantee content),
    False if the script errored.
    """
    script = (
        'tell application "System Events"\n'
        '  if exists (process 1 where frontmost is true) then\n'
        '    tell (process 1 where frontmost is true)\n'
        '      if exists menu bar 1 then\n'
        '        try\n'
        '          click menu item "Copy" of menu 1 of menu bar item "Edit" of menu bar 1\n'
        '          return "ok"\n'
        '        on error errMsg\n'
        '          return errMsg\n'
        '        end try\n'
        '      else\n'
        '        return "no menu bar"\n'
        '      end if\n'
        '    end tell\n'
        '  else\n'
        '    return "no frontmost process"\n'
        '  end if\n'
        'end tell'
    )
    code, out, err = _run_osascript(script)
    if code == 0 and out.strip():
        return True
    return False


def _pbpaste() -> str:
    try:
        # Prefer plain text to avoid rich/textless formats
        out = subprocess.check_output(["/usr/bin/pbpaste", "-Prefer", "txt"])  # bytes
        return out.decode("utf-8", errors="replace")
    except Exception:
        return ""


def _pbcopy(text: str) -> None:
    try:
        proc = subprocess.Popen(["/usr/bin/pbcopy"], stdin=subprocess.PIPE)
        proc.communicate(input=text.encode("utf-8"))
    except Exception:
        pass


# Screenshot capture logic removed for text-only behavior


def get_selected_text(retry_attempts: int = 2, delay_after_copy_s: float = 0.2) -> str:
    """Return the current selected text from the frontmost app on macOS.

    Saves the clipboard, sends Cmd+C, waits briefly, reads the new clipboard
    contents, and restores the original clipboard.

    Args:
        retry_attempts: Number of retry attempts if first copy yields empty text.
        delay_after_copy_s: Sleep time after sending Cmd+C before reading clipboard.

    Returns:
        The captured selection text, or an empty string if unavailable.
    """
    # Get current clipboard to restore later
    original_clip = _pbpaste()

    captured: str = ""

    for attempt in range(max(1, retry_attempts + 1)):
        # Clear clipboard to detect fresh content from Copy action
        _pbcopy("")

        # Prefer using the menu bar Copy to avoid keystroke issues in some apps
        used_menu = _copy_via_menu_bar()
        if not used_menu:
            # Fallback: Send Cmd+C to copy current selection
            copy_script = 'tell application "System Events" to keystroke "c" using command down'
            _run_osascript(copy_script)

        # Poll for clipboard population, allowing slower apps to update
        # Slightly longer window on first try; shorter on subsequent attempts
        base_window = max(0.6, delay_after_copy_s)
        window = base_window if attempt == 0 else base_window * 0.75
        deadline = time.time() + window
        while time.time() < deadline:
            time.sleep(0.06)
            tmp = _pbpaste()
            if tmp:
                captured = tmp
                break

        if captured:
            break

        # Small backoff before retrying
        time.sleep(0.1)

    # Restore original clipboard
    _pbcopy(original_clip)

    # Return the captured text (empty if nothing was selected)
    return captured if captured else ""


def make_selection_tool():
    """Create a Google ADK tool exposing `get_selected_text`.

    Exposes a plain callable via google-adk's function_tool helper (preferred API).
    """
    from google.adk.tools import function_tool  # type: ignore

    return function_tool(
        func=lambda: get_selected_text(),
        name="get_selected_text",
        description=(
            "Return the actual text the user currently has highlighted on macOS by simulating Cmd+C."
        ),
        parameters={},
        returns={
            "type": "string",
            "description": "Plain text selection copied from the frontmost application.",
        },
    )


__all__ = ["get_selected_text", "make_selection_tool"]



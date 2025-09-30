"""Clipboard tool for copying text to clipboard via WebSocket."""
from __future__ import annotations

import time
from typing import Any, Callable, Dict, Optional

from google.adk.tools import ToolContext

ClipboardCallable = Callable[..., Any]

# Default timeout in seconds
CLIPBOARD_PROMPT_TIMEOUT = 300  # 5 minutes


def make_clipboard_tool(websocket_send_callback: Optional[Callable] = None) -> ClipboardCallable:
    """Create an async function tool that sends clipboard prompts via WebSocket.
    
    Args:
        websocket_send_callback: Optional callback to send data via websocket.
                                 Should accept a dict payload.
    """

    async def push_clipboard_prompt(
        text: str,
        title: Optional[str] = None,
        instructions: Optional[str] = None,
        tool_context: Optional[ToolContext] = None,
    ) -> Dict[str, Any]:
        """Whenever you want to help the user create a prompt to ask Cursor, use this tool to put the prompt in their clipboard history so they can paste it in.
        
        Args:
            text: The text to copy to clipboard
            title: Optional title for the clipboard prompt
            instructions: Optional instructions for the user
            tool_context: Optional tool context for state tracking
            
        Returns:
            Dict with status and expiration information
        """

        expires_at = time.time() + CLIPBOARD_PROMPT_TIMEOUT
        payload = {
            "type": "clipboard",
            "title": title or "Copy to clipboard",
            "text": text,
            "instructions": instructions or "Please copy this text to your clipboard",
            "expires_at": expires_at,
        }
        
        # Send via websocket if callback is provided
        if websocket_send_callback is not None:
            await websocket_send_callback(payload)
        
        # Track in tool context if available
        if tool_context is not None:
            history = tool_context.state.get("clipboard_history")
            if history is None:
                history = []
            else:
                history = list(history)
            history.append(payload)
            tool_context.state["clipboard_history"] = history
            
        return {"status": "queued", "expires_at": expires_at}

    return push_clipboard_prompt


__all__ = ["make_clipboard_tool"]

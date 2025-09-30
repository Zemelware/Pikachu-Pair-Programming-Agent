"""Cursor move tool for controlling visual cursor overlay via WebSocket."""
from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from google.adk.tools import ToolContext

CursorMoveCallable = Callable[..., Any]


def make_cursor_move_tool(websocket_send_callback: Optional[Callable] = None) -> CursorMoveCallable:
    """Create an async callable to move the on-screen cursor overlay.
    
    Args:
        websocket_send_callback: Optional callback to send data via websocket.
                                 Should accept a dict payload.
    """

    async def move_visual_cursor(
        x: float,
        y: float,
        label: Optional[str] = None,
        tool_context: Optional[ToolContext] = None,
    ) -> Dict[str, Any]:
        """Move the visual cursor overlay to the provided relative coordinates (0-1 range).
        
        Args:
            x: X coordinate (0.0 to 1.0, where 0 is left and 1 is right)
            y: Y coordinate (0.0 to 1.0, where 0 is top and 1 is bottom)
            label: Optional label to display with the cursor
            tool_context: Optional tool context for state tracking
            
        Returns:
            Dict with acknowledgment and cursor position
        """
        payload = {
            "type": "cursor_move",
            "x": x,
            "y": y,
            "label": label
        }
        
        # Send via websocket if callback is provided
        if websocket_send_callback is not None:
            await websocket_send_callback(payload)
        
        # Track in tool context if available
        if tool_context is not None:
            history = tool_context.state.get("cursor_moves")
            if history is None:
                history = []
            else:
                history = list(history)
            history.append(payload)
            tool_context.state["cursor_moves"] = history
            
        return {"ack": True, "cursor": payload}

    return move_visual_cursor


__all__ = ["make_cursor_move_tool"]

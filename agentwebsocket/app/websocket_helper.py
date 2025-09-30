"""Helper utilities for integrating tools with WebSocket communication."""
from __future__ import annotations

import json
from typing import Any, Dict
from fastapi import WebSocket


class WebSocketToolHelper:
    """Helper class to send tool-specific messages via WebSocket."""
    
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
    
    async def send_tool_message(self, payload: Dict[str, Any]) -> None:
        """Send a tool-specific message to the client.
        
        Args:
            payload: Dict containing the message data with 'type' field
        """
        message = {
            "mime_type": "application/json",
            "message_type": "tool_event",
            "data": payload
        }
        await self.websocket.send_text(json.dumps(message))
        print(f"[TOOL TO CLIENT]: {payload.get('type', 'unknown')}")


def create_websocket_callback(websocket: WebSocket):
    """Create a callback function for tools to send WebSocket messages.
    
    Args:
        websocket: The WebSocket connection
        
    Returns:
        An async callback function that tools can use
    """
    helper = WebSocketToolHelper(websocket)
    
    async def callback(payload: Dict[str, Any]) -> None:
        await helper.send_tool_message(payload)
    
    return callback


__all__ = ["WebSocketToolHelper", "create_websocket_callback"]

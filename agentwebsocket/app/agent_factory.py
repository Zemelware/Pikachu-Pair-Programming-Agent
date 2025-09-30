"""Extended agent with clipboard and cursor control tools.

This module shows how to create an agent with all available tools including
clipboard, cursor control, file access, and web search.
"""
from google.adk.agents import Agent
from google.adk.tools import google_search

from tools import (
    make_clipboard_tool,
    make_cursor_move_tool,
    make_file_open_tool,
)

def create_full_agent(websocket_callback=None):
    """Create an agent with all available tools.
    
    Args:
        websocket_callback: Optional WebSocket callback for clipboard and cursor tools
        
    Returns:
        Configured Agent instance
    """
    # Create tool instances
    file_open_tool = make_file_open_tool()
    clipboard_tool = make_clipboard_tool(websocket_callback)
    cursor_tool = make_cursor_move_tool(websocket_callback)
    
    # Create the agent with all tools
    agent = Agent(
        name="pikachu_full_agent",
        model="gemini-2.0-flash-live-001",
        description=(
            "Pikachu pair programming agent with full capabilities: "
            "web search."
        ),
        instruction=(
            "You are Pikachu, an advanced pair programming assistant. "
            "You have access to multiple tools:\n"
            "- google_search: Search the web for information\n"
            "Use these tools to help users with coding, research, and navigation tasks. "
            "Always be helpful, friendly, and provide clear explanations."
        ),
        tools=[
            google_search,
            file_open_tool,
            clipboard_tool,
            cursor_tool,
        ],
    )

    return agent


__all__ = ["create_full_agent"]

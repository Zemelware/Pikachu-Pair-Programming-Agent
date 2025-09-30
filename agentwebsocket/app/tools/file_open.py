"""File open tool for reading project files."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Dict, Optional

from google.adk.tools import ToolContext

# Root is 3 levels up from this file: app/tools/file_open.py -> app -> agentwebsocket -> project root
ROOT = Path(__file__).resolve().parents[3]

FileOpenCallable = Callable[..., Any]


def make_file_open_tool() -> FileOpenCallable:
    """Create an async callable that reads project files for the agent.
    
    Returns:
        An async function that opens and reads files from the project
    """

    async def open_project_file(
        path: str, 
        tool_context: Optional[ToolContext] = None
    ) -> Dict[str, Any]:
        """Open a repository file by relative path and return its text contents.
        
        Args:
            path: Relative path to the file from project root
            tool_context: Optional tool context for state tracking
            
        Returns:
            Dict with file path and content, or error message
        """
        try:
            # Resolve the path relative to project root
            resolved = (ROOT / path).resolve()
            
            # Security check: ensure file is within project root
            if not resolved.exists():
                return {"error": f"File {path} not found"}
            
            if not resolved.is_file():
                return {"error": f"{path} is not a file"}
                
            if ROOT not in resolved.parents and resolved != ROOT:
                return {"error": "Access outside repository root is not allowed"}
            
            # Read file content
            content = resolved.read_text(encoding="utf-8")
            
            # Track in tool context if available
            if tool_context is not None:
                opened_files = tool_context.state.setdefault("opened_files", [])
                if path not in opened_files:
                    opened_files.append(path)
                    
            return {"path": path, "content": content}
            
        except Exception as e:
            return {"error": f"Error reading file {path}: {str(e)}"}

    return open_project_file


__all__ = ["make_file_open_tool"]

"""File open tool for reading project files."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from google.adk.tools import ToolContext

# Root is 3 levels up from this file: app/tools/file_open.py -> app -> agentwebsocket -> project root
ROOT = Path(__file__).resolve().parents[3]

FileOpenCallable = Callable[..., Any]


def make_file_open_tool(allowed_external_files: Optional[List[str]] = None) -> FileOpenCallable:
    """Create an async callable that reads project files for the agent.
    
    Args:
        allowed_external_files: Optional list of absolute paths to external files the agent can access
    
    Returns:
        An async function that opens and reads files from the project
    """
    # Convert allowed external files to a set of resolved Path objects
    external_files = set()
    if allowed_external_files:
        for file_path in allowed_external_files:
            try:
                external_files.add(Path(file_path).resolve())
            except Exception:
                pass  # Skip invalid paths

    async def open_project_file(
        path: str, 
        tool_context: Optional[ToolContext] = None
    ) -> Dict[str, Any]:
        """Open a repository file by relative path or absolute path and return its text contents.
        
        Args:
            path: Relative path from project root, absolute path, or filename of allowed external file
            tool_context: Optional tool context for state tracking
            
        Returns:
            Dict with file path and content, or error message
        """
        try:
            # First, check if path is an absolute path to an allowed external file
            path_obj = Path(path)
            if path_obj.is_absolute():
                resolved_path = path_obj.resolve()
                if resolved_path in external_files and resolved_path.exists() and resolved_path.is_file():
                    content = resolved_path.read_text(encoding="utf-8")
                    
                    # Track in tool context if available
                    if tool_context is not None:
                        opened_files = tool_context.state.get("opened_files")
                        if opened_files is None:
                            opened_files = []
                        else:
                            opened_files = list(opened_files)
                        if str(resolved_path) not in opened_files:
                            opened_files.append(str(resolved_path))
                            tool_context.state["opened_files"] = opened_files
                            
                    return {"path": str(resolved_path), "content": content}
            
            # Check if path matches the filename of any allowed external file
            for external_file in external_files:
                if external_file.name == path or external_file.name == Path(path).name:
                    if external_file.exists() and external_file.is_file():
                        content = external_file.read_text(encoding="utf-8")
                        
                        # Track in tool context if available
                        if tool_context is not None:
                            opened_files = tool_context.state.get("opened_files")
                            if opened_files is None:
                                opened_files = []
                            else:
                                opened_files = list(opened_files)
                            if str(external_file) not in opened_files:
                                opened_files.append(str(external_file))
                                tool_context.state["opened_files"] = opened_files
                                
                        return {"path": str(external_file), "content": content}
            
            # Fallback to local project root for relative paths
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
                opened_files = tool_context.state.get("opened_files")
                if opened_files is None:
                    opened_files = []
                else:
                    opened_files = list(opened_files)
                if path not in opened_files:
                    opened_files.append(path)
                    tool_context.state["opened_files"] = opened_files
                    
            return {"path": path, "content": content}
            
        except Exception as e:
            return {"error": f"Error reading file {path}: {str(e)}"}

    return open_project_file


__all__ = ["make_file_open_tool"]

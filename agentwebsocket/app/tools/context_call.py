"""Context call tool for reading the Context.MD file from the demo directory."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Dict, Optional

from google.adk.tools import ToolContext

# Path to the demo directory
DEMO_DIR = Path("/Users/aryan/projects/Pikachu-Pair-Programming-Demo")
CONTEXT_FILE = DEMO_DIR / "Context.MD"

ContextCallCallable = Callable[..., Any]


def make_context_call_tool() -> ContextCallCallable:
    """Create an async callable that reads the Context.MD file from the demo directory.
    
    Returns:
        An async function that reads the Context.MD file and returns its contents
    """

    async def read_context_file(
        tool_context: Optional[ToolContext] = None
    ) -> Dict[str, Any]:
        """Read the Context.MD file from the Pikachu-Pair-Programming-Demo directory.
        
        This tool provides access to the project context and guidelines that help
        the AI understand the current project's requirements, conventions, and goals.
        
        Args:
            tool_context: Optional tool context for state tracking
            
        Returns:
            Dict with context file path and content, or error message
        """
        try:
            # Check if the context file exists
            if not CONTEXT_FILE.exists():
                return {
                    "error": f"Context.MD file not found at {CONTEXT_FILE}",
                    "suggestion": "Make sure the Pikachu-Pair-Programming-Demo directory exists and contains Context.MD"
                }
            
            if not CONTEXT_FILE.is_file():
                return {"error": f"{CONTEXT_FILE} exists but is not a file"}
            
            # Read the context file content
            content = CONTEXT_FILE.read_text(encoding="utf-8")
            
            # Track in tool context if available
            if tool_context is not None:
                context_reads = tool_context.state.get("context_reads")
                if context_reads is None:
                    context_reads = 0
                context_reads += 1
                tool_context.state["context_reads"] = context_reads
                tool_context.state["last_context_read"] = str(CONTEXT_FILE)
                    
            return {
                "path": str(CONTEXT_FILE),
                "content": content,
                "message": "Successfully read project context from Context.MD"
            }
            
        except Exception as e:
            return {"error": f"Error reading Context.MD file: {str(e)}"}

    return read_context_file


__all__ = ["make_context_call_tool"]

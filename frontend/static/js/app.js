import { startAudioPlayerWorklet } from "./audio-player.js";
import { startAudioRecorderWorklet } from "./audio-recorder.js";

// Session management
const sessionId = Math.random().toString().substring(10);
const ws_url = "ws://localhost:8000/ws/" + sessionId;

// Audio nodes
let audioPlayerNode = null;
let audioPlayerContext = null;
let audioRecorderNode = null;
let audioRecorderContext = null;
let micStream = null;
let isAssistantSpeaking = false;

// Message tracking
let currentMessageId = null;
let websocket = null;

// DOM elements
const messagesDiv = document.getElementById("messages");

// Helper function to convert Base64 to ArrayBuffer
function base64ToArray(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Tool event handlers
function handleToolEvent(data) {
  console.log("[TOOL EVENT]", data);

  if (data.type === "clipboard") {
    handleClipboardTool(data);
  } else if (data.type === "cursor_move") {
    handleCursorMoveTool(data);
  }
}

function handleClipboardTool(data) {
  const { text, title, instructions } = data;

  // Display clipboard notification
  const notification = document.createElement("div");
  notification.style.position = "fixed";
  notification.style.top = "20px";
  notification.style.right = "20px";
  notification.style.backgroundColor = "rgba(50, 200, 100, 0.95)";
  notification.style.color = "white";
  notification.style.padding = "12px 20px";
  notification.style.borderRadius = "8px";
  notification.style.zIndex = "10000";
  notification.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
  notification.style.maxWidth = "300px";
  notification.innerHTML = `
    <strong>📋 ${title || "Clipboard"}</strong><br>
    <small>${instructions || "Text copied to clipboard"}</small>
  `;
  document.body.appendChild(notification);

  // Try to focus the window first
  window.focus();

  // Copy to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        console.log("[CLIPBOARD] Text copied successfully");
        // Auto-remove notification after 3 seconds
        setTimeout(() => {
          notification.style.opacity = "0";
          notification.style.transition = "opacity 0.3s";
          setTimeout(() => notification.remove(), 300);
        }, 3000);
      })
      .catch((err) => {
        console.error("[CLIPBOARD] Failed to copy:", err);
        // Fallback: show text area for manual copy
        notification.style.backgroundColor = "rgba(200, 150, 50, 0.95)";
        notification.innerHTML = `
          <strong>📋 ${title || "Copy this text:"}</strong><br>
          <small>Click to select, then Cmd+C</small><br>
          <textarea id="clipboard-fallback" style="width:100%;margin-top:8px;padding:4px;font-size:11px;" readonly>${text}</textarea>
        `;
        // Auto-select text
        setTimeout(() => {
          const textarea = document.getElementById("clipboard-fallback");
          if (textarea) {
            textarea.select();
            textarea.focus();
          }
        }, 100);
      });
  } else {
    // Fallback: show the text for manual copying
    console.warn("[CLIPBOARD] Clipboard API not available");
    notification.innerHTML = `
      <strong>📋 ${title || "Copy this text:"}</strong><br>
      <textarea style="width:100%;margin-top:8px;padding:4px;" readonly>${text}</textarea>
    `;
  }
}

function handleCursorMoveTool(data) {
  const { x, y, label } = data;

  // Show visual cursor indicator at the specified position
  showCursorIndicator(x, y, label);
}

function showCursorIndicator(x, y, label) {
  // Remove existing cursor indicator if any
  const existing = document.getElementById("cursor-indicator");
  if (existing) {
    existing.remove();
  }

  // Create cursor indicator element
  const indicator = document.createElement("div");
  indicator.id = "cursor-indicator";
  indicator.style.position = "fixed";
  indicator.style.left = `${x * 100}%`;
  indicator.style.top = `${y * 100}%`;
  indicator.style.transform = "translate(-50%, -50%)";
  indicator.style.pointerEvents = "none";
  indicator.style.zIndex = "9999";
  indicator.style.transition = "all 0.3s ease";

  // Create cursor dot
  const dot = document.createElement("div");
  dot.style.width = "20px";
  dot.style.height = "20px";
  dot.style.borderRadius = "50%";
  dot.style.backgroundColor = "rgba(255, 200, 50, 0.9)";
  dot.style.border = "3px solid rgba(255, 100, 100, 0.8)";
  dot.style.boxShadow = "0 0 20px rgba(255, 200, 50, 0.6)";
  dot.style.animation = "pulse 1.5s infinite";

  indicator.appendChild(dot);

  // Add label if provided
  if (label) {
    const labelEl = document.createElement("div");
    labelEl.style.position = "absolute";
    labelEl.style.top = "30px";
    labelEl.style.left = "50%";
    labelEl.style.transform = "translateX(-50%)";
    labelEl.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    labelEl.style.color = "white";
    labelEl.style.padding = "4px 8px";
    labelEl.style.borderRadius = "4px";
    labelEl.style.fontSize = "12px";
    labelEl.style.whiteSpace = "nowrap";
    labelEl.textContent = label;
    indicator.appendChild(labelEl);
  }

  document.body.appendChild(indicator);

  // Add pulse animation if not already defined
  if (!document.getElementById("cursor-pulse-animation")) {
    const style = document.createElement("style");
    style.id = "cursor-pulse-animation";
    style.textContent = `
      @keyframes pulse {
        0%, 100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.3);
          opacity: 0.7;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (indicator && indicator.parentNode) {
      indicator.style.opacity = "0";
      setTimeout(() => indicator.remove(), 300);
    }
  }, 3000);

  console.log(`[CURSOR] Moved to (${x}, ${y})${label ? " - " + label : ""}`);
}

// WebSocket handlers
function connectWebSocket() {
  // Connect to WebSocket endpoint (always audio mode)
  websocket = new WebSocket(ws_url);

  // Handle connection open
  websocket.onopen = function () {
    console.log("WebSocket connection opened.");
    document.getElementById("messages").textContent = "Connection opened";

    // Enable the Send button
    document.getElementById("sendButton").disabled = false;
    addSubmitHandler();
  };

  // Handle incoming messages
  websocket.onmessage = function (event) {
    // Parse the incoming message
    const message_from_server = JSON.parse(event.data);
    console.log("[AGENT TO CLIENT] ", message_from_server);

    // Check if the turn is complete
    // if turn complete, add new message
    if (message_from_server.turn_complete && message_from_server.turn_complete == true) {
      currentMessageId = null;
      isAssistantSpeaking = false;
      return;
    }
    if (message_from_server.interrupted === true) {
      isAssistantSpeaking = false;
      return;
    }

    // If it's audio, play it
    if (message_from_server.mime_type == "audio/pcm" && audioPlayerNode) {
      isAssistantSpeaking = true;
      audioPlayerNode.port.postMessage(base64ToArray(message_from_server.data));
    }

    // If it's a text, print it
    if (message_from_server.mime_type == "text/plain") {
      // add a new message for a new turn
      if (currentMessageId == null) {
        currentMessageId = Math.random().toString(36).substring(7);
        const message = document.createElement("p");
        message.id = currentMessageId;
        // Append the message element to the messagesDiv
        messagesDiv.appendChild(message);
      }

      // Add message text to the existing message element
      const message = document.getElementById(currentMessageId);
      message.textContent += message_from_server.data;

      // Scroll down to the bottom of the messagesDiv
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Handle tool events
    if (
      message_from_server.mime_type == "application/json" &&
      message_from_server.message_type == "tool_event"
    ) {
      handleToolEvent(message_from_server.data);
    }
  };

  // Handle connection close
  websocket.onclose = function (event) {
    console.log("WebSocket connection closed.");
    document.getElementById("sendButton").disabled = true;
    document.getElementById("messages").textContent = "Connection closed";
    setTimeout(function () {
      console.log("Reconnecting...");
      connectWebSocket();
    }, 5000);
  };

  // Handle errors
  websocket.onerror = function (error) {
    console.error("WebSocket error:", error);
    document.getElementById("messages").textContent = "Connection error";
  };
}

// Send message to server via WebSocket
function sendMessage(message) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify(message));
  } else {
    console.error("WebSocket is not connected");
  }
}

// Add submit handler for the form
function addSubmitHandler() {
  const messageForm = document.getElementById("messageForm");
  messageForm.onsubmit = function (event) {
    event.preventDefault();

    const messageInput = document.getElementById("message");
    const messageText = messageInput.value;

    if (!messageText) {
      return;
    }

    console.log("[CLIENT TO AGENT]: ", messageText);

    // Add user message to the messages div
    const userMessage = document.createElement("p");
    userMessage.textContent = "User: " + messageText;
    messagesDiv.appendChild(userMessage);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Send the message
    sendMessage({
      mime_type: "text/plain",
      data: messageText,
    });

    // Clear the input
    messageInput.value = "";
  };
}

// Audio button handler
document.getElementById("startAudioButton").onclick = async function () {
  // Close existing WebSocket connection
  if (websocket) {
    websocket.close();
  }

  // Start audio player
  [audioPlayerNode, audioPlayerContext] = await startAudioPlayerWorklet();

  // Start audio recorder
  [audioRecorderNode, audioRecorderContext, micStream] = await startAudioRecorderWorklet(function (
    audioData
  ) {
    console.log("[CLIENT TO AGENT]: audio/pcm:", audioData.byteLength, "bytes");

    // Convert audioData to base64
    const bytes = new Uint8Array(audioData);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // Simple VAD barge-in: if assistant is speaking and mic RMS is high, clear playback buffer
    try {
      const int16 = new Int16Array(audioData);
      let sumSquares = 0;
      for (let i = 0; i < int16.length; i++) {
        const v = int16[i] / 32768.0;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / Math.max(1, int16.length));
      if (isAssistantSpeaking && rms > 0.04) {
        if (audioPlayerNode) audioPlayerNode.port.postMessage("clear");
        isAssistantSpeaking = false;
      }
    } catch (_) {}

    // Send audio data
    sendMessage({
      mime_type: "audio/pcm",
      data: base64,
    });
  });

  // Reconnect WebSocket with audio mode
  connectWebSocket();

  // Disable the button
  this.disabled = true;
  this.textContent = "Audio Mode Active";
};

// Initialize WebSocket connection on page load
connectWebSocket();

import { startAudioPlayerWorklet } from "./audio-player.js";
import { startAudioRecorderWorklet } from "./audio-recorder.js";

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

  try {
    // Use Electron's clipboard API (works without document focus)
    const { clipboard } = require("electron");
    clipboard.writeText(text);
    console.log("[CLIPBOARD] Text copied successfully:", title || "clipboard");
  } catch (err) {
    console.error("[CLIPBOARD] Failed to copy:", err);
  }
}

function handleCursorMoveTool(data) {
  const { x, y, label } = data;

  // Show visual cursor indicator at the specified position
  showCursorIndicator(x, y, label);
}

function showCursorIndicator(x, y, label) {
  // Remove existing cursor indicator if any
  const existing = document.getElementById("pikachu-cursor-indicator");
  if (existing) {
    existing.remove();
  }

  // Create cursor indicator element
  const indicator = document.createElement("div");
  indicator.id = "pikachu-cursor-indicator";
  indicator.style.position = "fixed";
  indicator.style.left = `${x * 100}%`;
  indicator.style.top = `${y * 100}%`;
  indicator.style.transform = "translate(-50%, -50%)";
  indicator.style.pointerEvents = "none";
  indicator.style.zIndex = "999999";
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

// Double-click the speech bubble to mute/unmute; drag Pikachu to move
const pikachuImg = document.getElementById("pikachu-img");
const thoughtBubble = document.getElementById("thought-bubble");

let websocket = null;
let audioPlayerNode = null;
let audioPlayerContext = null;
let audioRecorderNode = null;
let audioRecorderContext = null;
let micStream = null;
let isRecording = false;
let isMuted = false;
let isAssistantSpeaking = false;

const sessionId = Math.random().toString().substring(10);
const wsUrl = `ws://localhost:8000/ws/${sessionId}?is_audio=true`;

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArray(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function connectWebSocket() {
  websocket = new WebSocket(wsUrl);

  websocket.onopen = () => {
    window.pikachuAPI.setListening("connected (audio mode)");
    // If user has highlighted text, send it as an initial text context message
    try {
      const selection = window && window.__pikachuSelection ? window.__pikachuSelection : "";
      if (selection) {
        const selectionBlock = `Current highlighted code (from user system):\n\n${selection}\n\n— End selection —`;
        websocket.send(JSON.stringify({ mime_type: "text/plain", data: selectionBlock }));
      }
    } catch (_) {}
  };

  websocket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.turn_complete) {
      isAssistantSpeaking = false;
      return;
    }
    if (msg.interrupted) {
      isAssistantSpeaking = false;
      return;
    }

    if (msg.mime_type === "audio/pcm" && audioPlayerNode) {
      // Don't play audio if muted
      if (!isMuted) {
        isAssistantSpeaking = true;
        audioPlayerNode.port.postMessage(base64ToArray(msg.data));
      }
    } else if (msg.mime_type === "text/plain") {
      window.pikachuAPI.showMessage(msg.data);
    } else if (msg.mime_type === "application/json" && msg.message_type === "tool_event") {
      // Handle tool events
      handleToolEvent(msg.data);
    }
  };

  websocket.onclose = () => {
    if (isRecording) {
      setTimeout(connectWebSocket, 1500);
    }
  };
}

async function startAudio() {
  const [playerNode, playerCtx] = await startAudioPlayerWorklet();
  audioPlayerNode = playerNode;
  audioPlayerContext = playerCtx;

  const [recorderNode, recorderCtx, stream] = await startAudioRecorderWorklet((pcmData) => {
    // Don't send audio if muted
    if (isMuted) return;
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
    // Simple VAD-based barge-in: if user voice detected while assistant speaking, clear buffer
    try {
      const int16 = new Int16Array(pcmData);
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
    websocket.send(JSON.stringify({ mime_type: "audio/pcm", data: arrayBufferToBase64(pcmData) }));
  });
  audioRecorderNode = recorderNode;
  audioRecorderContext = recorderCtx;
  micStream = stream;
}

function stopAudio() {
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  if (audioRecorderContext && audioRecorderContext.state !== "closed") {
    audioRecorderContext.close();
    audioRecorderContext = null;
  }
  if (audioPlayerContext && audioPlayerContext.state !== "closed") {
    audioPlayerContext.close();
    audioPlayerContext = null;
  }
  audioRecorderNode = null;
  audioPlayerNode = null;
}

async function startRecording() {
  try {
    window.pikachuAPI.setThinking("starting audio...");
    await startAudio();
    connectWebSocket();
    isRecording = true;
    window.pikachuAPI.setListening("listening...");
  } catch (e) {
    window.pikachuAPI.showMessage("mic permission denied");
  }
}

function stopRecording() {
  isRecording = false;
  if (websocket) websocket.close();
  stopAudio();
  window.pikachuAPI.setListening("stopped");
}

// Make Pikachu draggable
if (pikachuImg) {
  pikachuImg.style["-webkit-app-region"] = "drag";
}

// Double-click the thought bubble to toggle mute
if (thoughtBubble) {
  thoughtBubble.addEventListener("dblclick", (e) => {
    e.preventDefault();
    isMuted = !isMuted;
    console.log("[pikachu] mute toggle, muted=%s", isMuted);

    if (isMuted) {
      // Clear the audio buffer to stop agent talking immediately
      if (audioPlayerNode) {
        audioPlayerNode.port.postMessage("clear");
      }
      window.pikachuAPI.setListening("muted (double-click to unmute)");
    } else {
      window.pikachuAPI.setListening("listening...");
    }
  });

  // Make thought bubble clickable but not draggable
  thoughtBubble.style["-webkit-app-region"] = "no-drag";
  thoughtBubble.style.cursor = "pointer";
}

// Auto-start on load and stop on window close
const autoStart = async () => {
  try {
    if (!isRecording) await startRecording();
  } catch (e) {
    console.error("Auto-start failed:", e);
  }
};

if (document.readyState === "complete" || document.readyState === "interactive") {
  autoStart();
} else {
  window.addEventListener("DOMContentLoaded", autoStart);
}

window.addEventListener("beforeunload", () => {
  try {
    if (isRecording) stopRecording();
  } catch (_) {}
});

console.log("Overlay audio ready (auto-start enabled)");

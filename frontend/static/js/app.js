import { startAudioPlayerWorklet } from './audio-player.js';
import { startAudioRecorderWorklet } from './audio-recorder.js';

// Session management
const sessionId = Math.random().toString().substring(10);
const ws_url = "ws://localhost:8000/ws/" + sessionId;

// Audio nodes
let audioPlayerNode = null;
let audioPlayerContext = null;
let audioRecorderNode = null;
let audioRecorderContext = null;
let micStream = null;

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
    if (
      message_from_server.turn_complete &&
      message_from_server.turn_complete == true
    ) {
      currentMessageId = null;
      return;
    }

    // If it's audio, play it
    if (message_from_server.mime_type == "audio/pcm" && audioPlayerNode) {
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
    console.error('WebSocket is not connected');
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
      data: messageText
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
  [audioRecorderNode, audioRecorderContext, micStream] = await startAudioRecorderWorklet(function (audioData) {
    console.log("[CLIENT TO AGENT]: audio/pcm:", audioData.byteLength, "bytes");
    
    // Convert audioData to base64
    const bytes = new Uint8Array(audioData);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // Send audio data
    sendMessage({
      mime_type: "audio/pcm",
      data: base64
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

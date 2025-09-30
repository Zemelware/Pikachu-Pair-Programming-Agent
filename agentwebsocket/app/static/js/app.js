// Import the audio worklets
import { startAudioPlayerWorklet } from "./audio-player.js";
import { startAudioRecorderWorklet } from "./audio-recorder.js";

// Connect the server with a WebSocket connection
const sessionId = Math.random().toString().substring(10);
const ws_url = "ws://" + window.location.host + "/ws/" + sessionId;
let websocket = null;
let is_audio = false;

// Audio variables
let audioPlayerNode;
let audioPlayerContext;
let audioRecorderNode;
let audioRecorderContext;
let micStream;

// Get DOM elements
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("message");
const messagesDiv = document.getElementById("messages");
const statusDiv = document.getElementById("status");
const audioIndicator = document.getElementById("audioIndicator");
let currentMessageId = null;

// WebSocket handlers
function connectWebsocket() {
  // Connect websocket
  websocket = new WebSocket(ws_url + "?is_audio=" + is_audio);

  // Handle connection open
  websocket.onopen = function () {
    // Connection opened messages
    console.log("WebSocket connection opened.");
    statusDiv.textContent = is_audio ? "Connected (Audio Mode)" : "Connected (Text Mode)";
    statusDiv.style.color = "#34a853";

    // Enable the Send button
    document.getElementById("sendButton").disabled = false;
    addSubmitHandler();
    
    // Show audio indicator if in audio mode
    if (is_audio) {
      audioIndicator.classList.add("active");
    }
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
        message.style.backgroundColor = "#e8f5e8";
        message.style.borderLeft = "4px solid #34a853";
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
  websocket.onclose = function () {
    console.log("WebSocket connection closed.");
    document.getElementById("sendButton").disabled = true;
    statusDiv.textContent = "Connection closed - Reconnecting...";
    statusDiv.style.color = "#ea4335";
    audioIndicator.classList.remove("active");
    
    setTimeout(function () {
      console.log("Reconnecting...");
      connectWebsocket();
    }, 5000);
  };

  websocket.onerror = function (e) {
    console.log("WebSocket error: ", e);
    statusDiv.textContent = "Connection error";
    statusDiv.style.color = "#ea4335";
  };
}

// Initial connection
connectWebsocket();

// Add submit handler to the form
function addSubmitHandler() {
  messageForm.onsubmit = function (e) {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (message) {
      const p = document.createElement("p");
      p.textContent = "> " + message;
      p.style.backgroundColor = "#fff3e0";
      p.style.borderLeft = "4px solid #ff9800";
      messagesDiv.appendChild(p);
      messageInput.value = "";
      sendMessage({
        mime_type: "text/plain",
        data: message,
      });
      console.log("[CLIENT TO AGENT] " + message);
      
      // Scroll to bottom
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    return false;
  };
}

// Send a message to the server as a JSON string
function sendMessage(message) {
  if (websocket && websocket.readyState == WebSocket.OPEN) {
    const messageJson = JSON.stringify(message);
    websocket.send(messageJson);
  }
}

// Start audio
async function startAudio() {
  try {
    // Start audio output
    const [playerNode, playerCtx] = await startAudioPlayerWorklet();
    audioPlayerNode = playerNode;
    audioPlayerContext = playerCtx;
    console.log("Audio player worklet started");
    
    // Start audio input (this will request microphone permission)
    const [recorderNode, recorderCtx, stream] = await startAudioRecorderWorklet(audioRecorderHandler);
    audioRecorderNode = recorderNode;
    audioRecorderContext = recorderCtx;
    micStream = stream;
    console.log("Audio recorder worklet started");
    
  } catch (error) {
    console.error("Failed to start audio:", error);
    throw error; // Re-throw to be handled by the caller
  }
}

// Stop audio
function stopAudio() {
  try {
    // Stop microphone stream
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      micStream = null;
    }
    
    // Close audio contexts
    if (audioRecorderContext && audioRecorderContext.state !== 'closed') {
      audioRecorderContext.close();
      audioRecorderContext = null;
    }
    
    if (audioPlayerContext && audioPlayerContext.state !== 'closed') {
      audioPlayerContext.close();
      audioPlayerContext = null;
    }
    
    // Clear nodes
    audioRecorderNode = null;
    audioPlayerNode = null;
    
    console.log("Audio stopped");
  } catch (error) {
    console.error("Error stopping audio:", error);
  }
}

// Start the audio only when the user clicked the button
// (due to the gesture requirement for the Web Audio API)
const startAudioButton = document.getElementById("startAudioButton");
let isAudioActive = false;

startAudioButton.addEventListener("click", async () => {
  if (!isAudioActive) {
    // Start audio mode
    try {
      startAudioButton.disabled = true;
      startAudioButton.textContent = "Starting Audio...";
      
      await startAudio();
      is_audio = true;
      isAudioActive = true;
      
      // Close existing websocket and reconnect with audio mode
      if (websocket) {
        websocket.close();
      }
      
      setTimeout(() => {
        connectWebsocket(); // reconnect with the audio mode
        startAudioButton.textContent = "Stop Audio";
        startAudioButton.style.backgroundColor = "#ea4335";
        startAudioButton.disabled = false;
      }, 1000);
      
    } catch (error) {
      console.error("Failed to start audio:", error);
      startAudioButton.textContent = "Start Audio";
      startAudioButton.style.backgroundColor = "#34a853";
      startAudioButton.disabled = false;
      
      // Show error message to user
      statusDiv.textContent = "Microphone access denied or not available";
      statusDiv.style.color = "#ea4335";
    }
  } else {
    // Stop audio mode
    stopAudio();
    is_audio = false;
    isAudioActive = false;
    
    // Close existing websocket and reconnect in text mode
    if (websocket) {
      websocket.close();
    }
    
    setTimeout(() => {
      connectWebsocket(); // reconnect in text mode
      startAudioButton.textContent = "Start Audio";
      startAudioButton.style.backgroundColor = "#34a853";
      audioIndicator.classList.remove("active");
    }, 500);
  }
});

// Audio recorder handler
function audioRecorderHandler(pcmData) {
  // Send the pcm data as base64
  sendMessage({
    mime_type: "audio/pcm",
    data: arrayBufferToBase64(pcmData),
  });
  console.log("[CLIENT TO AGENT] sent %s bytes", pcmData.byteLength);
}

// Decode Base64 data to Array
function base64ToArray(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Encode an array buffer with Base64
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

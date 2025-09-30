import { startAudioPlayerWorklet } from './audio-player.js';
import { startAudioRecorderWorklet } from './audio-recorder.js';

// Session management
const sessionId = Math.random().toString().substring(10);
const sse_url = "http://" + window.location.host + "/events/" + sessionId;
const send_url = "http://" + window.location.host + "/send/" + sessionId;
let is_audio = false;

// Audio nodes
let audioPlayerNode = null;
let audioRecorderNode = null;

// Message tracking
let currentMessageId = null;
let eventSource = null;

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

// SSE handlers
function connectSSE() {
  // Connect to SSE endpoint
  eventSource = new EventSource(sse_url + "?is_audio=" + is_audio);

  // Handle connection open
  eventSource.onopen = function () {
    // Connection opened messages
    console.log("SSE connection opened.");
    document.getElementById("messages").textContent = "Connection opened";

    // Enable the Send button
    document.getElementById("sendButton").disabled = false;
    addSubmitHandler();
  };

  // Handle incoming messages
  eventSource.onmessage = function (event) {
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
  eventSource.onerror = function (event) {
    console.log("SSE connection error or closed.");
    document.getElementById("sendButton").disabled = true;
    document.getElementById("messages").textContent = "Connection closed";
    eventSource.close();
    setTimeout(function () {
      console.log("Reconnecting...");
      connectSSE();
    }, 5000);
  };
}

// Send message to server
async function sendMessage(message) {
  try {
    const response = await fetch(send_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      console.error('Failed to send message:', response.statusText);
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Add submit handler for the form
function addSubmitHandler() {
  const messageForm = document.getElementById("messageForm");
  messageForm.onsubmit = async function (event) {
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
    await sendMessage({
      mime_type: "text/plain",
      data: messageText
    });

    // Clear the input
    messageInput.value = "";
  };
}

// Audio button handler
document.getElementById("startAudioButton").onclick = async function () {
  // Close existing SSE connection
  if (eventSource) {
    eventSource.close();
  }

  // Set audio mode
  is_audio = true;

  // Start audio player
  audioPlayerNode = await startAudioPlayerWorklet();

  // Start audio recorder
  audioRecorderNode = await startAudioRecorderWorklet(async function (audioData) {
    console.log("[CLIENT TO AGENT]: audio/pcm:", audioData.byteLength, "bytes");
    
    // Convert audioData to base64
    const bytes = new Uint8Array(audioData);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // Send audio data
    await sendMessage({
      mime_type: "audio/pcm",
      data: base64
    });
  });

  // Reconnect SSE with audio mode
  connectSSE();

  // Disable the button
  this.disabled = true;
  this.textContent = "Audio Mode Active";
};

// Initialize SSE connection on page load
connectSSE();

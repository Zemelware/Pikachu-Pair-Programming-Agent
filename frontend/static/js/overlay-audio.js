import { startAudioPlayerWorklet } from './audio-player.js';
import { startAudioRecorderWorklet } from './audio-recorder.js';

// Command-click (Meta) Pikachu to start/stop audio; drag to move
const pikachuImg = document.getElementById('pikachu-img');
let mouseDownPos = null;
let mouseMoved = false;
let metaDownAtMouseDown = false;

let websocket = null;
let audioPlayerNode = null;
let audioPlayerContext = null;
let audioRecorderNode = null;
let audioRecorderContext = null;
let micStream = null;
let isRecording = false;

const sessionId = Math.random().toString().substring(10);
const wsUrl = `ws://localhost:8000/ws/${sessionId}?is_audio=true`;

function arrayBufferToBase64(buffer) {
  let binary = '';
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
    window.pikachuAPI.setListening('connected (audio mode)');
    // If user has highlighted text, send it as an initial text context message
    try {
      const selection = (window && window.__pikachuSelection) ? window.__pikachuSelection : '';
      if (selection) {
        const selectionBlock = `Current highlighted code (from user system):\n\n${selection}\n\n— End selection —`;
        websocket.send(JSON.stringify({ mime_type: 'text/plain', data: selectionBlock }));
      }
    } catch (_) {}
  };

  websocket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.turn_complete) return;

    if (msg.mime_type === 'audio/pcm' && audioPlayerNode) {
      audioPlayerNode.port.postMessage(base64ToArray(msg.data));
    } else if (msg.mime_type === 'text/plain') {
      window.pikachuAPI.showMessage(msg.data);
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
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
    websocket.send(JSON.stringify({ mime_type: 'audio/pcm', data: arrayBufferToBase64(pcmData) }));
  });
  audioRecorderNode = recorderNode;
  audioRecorderContext = recorderCtx;
  micStream = stream;
}

function stopAudio() {
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  if (audioRecorderContext && audioRecorderContext.state !== 'closed') {
    audioRecorderContext.close();
    audioRecorderContext = null;
  }
  if (audioPlayerContext && audioPlayerContext.state !== 'closed') {
    audioPlayerContext.close();
    audioPlayerContext = null;
  }
  audioRecorderNode = null;
  audioPlayerNode = null;
}

async function startRecording() {
  try {
    window.pikachuAPI.setThinking('starting audio...');
    await startAudio();
    connectWebSocket();
    isRecording = true;
    window.pikachuAPI.setListening('listening...');
  } catch (e) {
    window.pikachuAPI.showMessage('mic permission denied');
  }
}

function stopRecording() {
  isRecording = false;
  if (websocket) websocket.close();
  stopAudio();
  window.pikachuAPI.setListening('stopped');
}

if (pikachuImg) {
  // Manage drag vs click behavior
  pikachuImg.addEventListener('mousedown', (e) => {
    mouseMoved = false;
    mouseDownPos = { x: e.clientX, y: e.clientY };
    metaDownAtMouseDown = !!e.metaKey;
    // While Meta (Command) is pressed, allow click by disabling drag temporarily
    if (metaDownAtMouseDown) {
      pikachuImg.style['-webkit-app-region'] = 'no-drag';
    } else {
      pikachuImg.style['-webkit-app-region'] = 'drag';
    }
    // Debug
    console.log('[pikachu] mousedown meta=%s at %s,%s', metaDownAtMouseDown, e.clientX, e.clientY);
  });

  pikachuImg.addEventListener('mousemove', (e) => {
    if (!mouseDownPos) return;
    if (Math.abs(e.clientX - mouseDownPos.x) > 4 || Math.abs(e.clientY - mouseDownPos.y) > 4) {
      mouseMoved = true;
    }
  });

  const resetDragRegion = () => {
    // Default to drag so the avatar can be moved normally
    pikachuImg.style['-webkit-app-region'] = 'drag';
    mouseDownPos = null;
    mouseMoved = false;
    metaDownAtMouseDown = false;
  };

  pikachuImg.addEventListener('mouseup', resetDragRegion);
  pikachuImg.addEventListener('mouseleave', resetDragRegion);

  pikachuImg.addEventListener('contextmenu', (e) => {
    // Prevent macOS Command-click context menu when used for talk
    if (e.metaKey) e.preventDefault();
  });

  pikachuImg.addEventListener('click', (e) => {
    // Only toggle when Meta (Command) was held on mousedown and it was a click (no drag)
    if (!metaDownAtMouseDown || mouseMoved) {
      return;
    }
    e.preventDefault();
    console.log('[pikachu] command-click toggle, recording=%s', isRecording);
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  });
}

// Auto-start on load and stop on window close
const autoStart = async () => {
  try {
    if (!isRecording) await startRecording();
  } catch (e) {
    console.error('Auto-start failed:', e);
  }
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  autoStart();
} else {
  window.addEventListener('DOMContentLoaded', autoStart);
}

window.addEventListener('beforeunload', () => {
  try { if (isRecording) stopRecording(); } catch (_) {}
});

console.log('Overlay audio ready (auto-start enabled)');



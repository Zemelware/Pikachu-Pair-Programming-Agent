import { startAudioPlayerWorklet } from './audio-player.js';
import { startAudioRecorderWorklet } from './audio-recorder.js';

// Overlay record button logic to control audio + websocket from Electron UI

const recordBtn = document.getElementById('overlay-record-btn');
const messagesDiv = document.getElementById('thought-text');

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
    recordBtn.disabled = true;
    window.pikachuAPI.setThinking('starting audio...');
    await startAudio();
    connectWebSocket();
    isRecording = true;
    recordBtn.classList.add('recording');
    recordBtn.textContent = '■';
    window.pikachuAPI.setListening('listening...');
  } catch (e) {
    window.pikachuAPI.showMessage('mic permission denied');
  } finally {
    recordBtn.disabled = false;
  }
}

function stopRecording() {
  isRecording = false;
  if (websocket) websocket.close();
  stopAudio();
  recordBtn.classList.remove('recording');
  recordBtn.textContent = '●';
  window.pikachuAPI.setListening('stopped');
}

if (recordBtn) {
  recordBtn.addEventListener('click', () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  });
}

console.log('Overlay audio ready');



# Client-Side SDK for ADK Streaming (SSE)

This directory contains the client-side implementation for real-time bidirectional audio and text communication using Server-Sent Events (SSE).

## Architecture

### Files Overview

- **`index.html`** - Main web interface with message display and controls
- **`js/app.js`** - Core application logic, SSE connection, and message handling
- **`js/audio-player.js`** - Audio player worklet initialization
- **`js/audio-recorder.js`** - Audio recorder worklet initialization
- **`js/pcm-player-processor.js`** - AudioWorklet processor for playing PCM audio
- **`js/pcm-recorder-processor.js`** - AudioWorklet processor for recording microphone input

## Key Features

### Real-Time Communication
- **Server-Sent Events (SSE)** - Persistent connection for streaming responses from server
- **HTTP POST** - Sends user messages (text/audio) to server
- **Bidirectional** - Send messages while receiving responses

### Audio Processing
- **Web Audio API** - Professional audio processing using AudioWorklet
- **PCM Format** - 16kHz recording, 24kHz playback
- **Ring Buffer** - Smooth audio playback with 180-second buffer
- **Base64 Encoding** - Audio data transmission over JSON

### Mode Switching
- **Text Mode** - Default mode with text input/output
- **Audio Mode** - Voice input/output with microphone access
- **Seamless Transition** - Reconnect SSE when switching modes

## Usage

### Text Mode
1. Page loads and automatically connects to SSE endpoint
2. Type message in input field and click "Send"
3. View streaming responses in real-time

### Audio Mode
1. Click "Start Audio" button
2. Grant microphone permissions when prompted
3. Speak to send audio messages
4. Hear audio responses through speakers

## Technical Details

### Session Management
```javascript
const sessionId = Math.random().toString().substring(10);
const sse_url = "http://" + window.location.host + "/events/" + sessionId;
const send_url = "http://" + window.location.host + "/send/" + sessionId;
```

### SSE Connection
- Connects to `/events/{sessionId}?is_audio={true|false}`
- Auto-reconnects after 5 seconds on disconnect
- Handles `turn_complete`, text, and audio messages

### Message Format
```json
{
  "mime_type": "text/plain" | "audio/pcm",
  "data": "text content" | "base64-encoded-audio"
}
```

### Audio Pipeline

#### Recording (Client → Server)
```
Microphone → MediaStreamSource → AudioWorklet (16kHz) → Float32 → Int16 PCM → Base64 → POST
```

#### Playback (Server → Client)
```
SSE → Base64 → Int16 PCM → Float32 → AudioWorklet (24kHz) → Ring Buffer → Speakers
```

## Browser Requirements

- **Modern Browser** - Chrome, Edge, Firefox (latest versions)
- **HTTPS** - Required for microphone access (or localhost)
- **Web Audio API** - For audio processing
- **EventSource API** - For SSE support

## Integration with Server

This client expects a FastAPI server with the following endpoints:

- `GET /events/{user_id}?is_audio={true|false}` - SSE endpoint for streaming
- `POST /send/{user_id}` - Endpoint for sending messages

See the ADK Streaming server documentation for implementation details.

## Error Handling

- **Connection Errors** - Auto-reconnect with exponential backoff
- **Audio Errors** - Logged to console with graceful degradation
- **Session Errors** - Display error messages to user

## Development

To test locally:
1. Start the FastAPI server with ADK Streaming
2. Open `index.html` in a browser
3. Check browser console for connection status and data flow
4. Monitor server logs for incoming/outgoing messages

## Security Considerations

For production deployment:
- Implement proper authentication (replace random session IDs)
- Use HTTPS/WSS for encrypted communication
- Add rate limiting to prevent abuse
- Validate and sanitize all user inputs

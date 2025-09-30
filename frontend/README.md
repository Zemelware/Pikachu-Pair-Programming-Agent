# Pikachu AI Agent Overlay 🎮⚡

An Electron-based desktop overlay application featuring Pikachu as your AI coding companion, designed to work with Gemini Live for real-time AI assistance.

## Features

✨ **Overlay Mode** - Runs as a transparent, always-on-top window
🎨 **Draggable Character** - Click and drag Pikachu anywhere on your screen
💭 **Thought Bubble** - Displays what Pikachu/AI is thinking or working on
🔲 **Enhanced Screen Border** - Multi-layered animated gradient border with particles and scan effects
🖱️ **Click-through Border** - The border won't interfere with your other applications
💫 **Idle Animations** - Pikachu performs random actions when idle
🤖 **Gemini Live Ready** - API ready for integration with Gemini Live AI

## Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

Start the application:
```bash
npm start
```

### Controls

- **Drag** - Click and hold Pikachu to move it around
- **Cmd/Ctrl + B** - Toggle screen border
- **Cmd/Ctrl + Q** - Quit application

## Gemini Live Integration

The app exposes a `window.pikachuAPI` object for controlling Pikachu from your AI agent:

### API Methods

```javascript
// Show a thought bubble
window.pikachuAPI.showThought("Analyzing your code...", 5000);
// Parameters: (text, duration_ms) - use 0 for permanent display

// Set working state (changes bubble to purple)
window.pikachuAPI.setWorking(true);  // Show as working
window.pikachuAPI.setWorking(false); // Show as idle

// Hide thought bubble
window.pikachuAPI.hideThought();

// Animate Pikachu
window.pikachuAPI.animate('wave');   // Wave animation
window.pikachuAPI.animate('dance');  // Dance animation
window.pikachuAPI.animate('bounce'); // Bounce animation
window.pikachuAPI.animate('sleep');  // Sleep mode
window.pikachuAPI.animate('wake');   // Wake from sleep

// Toggle screen border
window.pikachuAPI.toggleBorder();     // Toggle
window.pikachuAPI.toggleBorder(true); // Show border
window.pikachuAPI.toggleBorder(false); // Hide border
```

### Example Usage Patterns

#### When AI is processing:
```javascript
window.pikachuAPI.setWorking(true);
window.pikachuAPI.showThought("Thinking...", 0);
```

#### When AI responds:
```javascript
window.pikachuAPI.setWorking(false);
window.pikachuAPI.animate('bounce');
window.pikachuAPI.showThought("Here's what I found!", 5000);
```

#### For long-running tasks:
```javascript
window.pikachuAPI.setWorking(true);
window.pikachuAPI.showThought("Analyzing codebase... 🔍", 0);
// ... do work ...
window.pikachuAPI.setWorking(false);
window.pikachuAPI.showThought("Analysis complete! ✅", 5000);
```

## Technical Details

### How It Works

1. **Overlay Window** - Uses Electron's transparent, frameless window with `alwaysOnTop` enabled
2. **Screen Border** - A separate fullscreen window with multi-layered animations:
   - Flowing gradient border that continuously animates
   - Pulsing secondary border layer
   - Animated corner accents
   - Particle effects that travel around the border
   - Scanline effect for extra visual flair
3. **Click-through** - The border window uses `setIgnoreMouseEvents(true)` so it doesn't block your interactions with other apps
4. **Draggable UI** - Implemented using `-webkit-app-region: drag` CSS property
5. **JavaScript API** - Exposed via `window.pikachuAPI` for external control

### Architecture

- **main.js** - Electron main process, manages windows and IPC
- **index.html** - Main overlay UI (character and thought bubble)
- **border.html** - Fullscreen border overlay
- **styles.css** - Character styling and animations
- **renderer.js** - API and interaction handling
- **assets/pikachu.png** - Character image

## Customization

### Use Your Own Character Image

To replace Pikachu with another character:

1. Save your image as `assets/character.png`
2. Update `index.html` line 21:
   ```html
   <img src="assets/character.png" alt="Character" class="pikachu-img" id="pikachu-img">
   ```
3. For best results, use a transparent PNG (200x200 to 400x400 pixels)

### Change Border Colors

Edit `border.html` and modify the gradient colors in the `.border-overlay::before` selector.

### Adjust Border Thickness

In `border.html`, change the `padding` property in `.border-overlay::before`.

## Integration with Gemini Live

To integrate with Gemini Live or other AI services:

1. **Create a separate script** that connects to Gemini Live API
2. **Use IPC or shared context** to communicate with the Electron renderer process
3. **Call `window.pikachuAPI` methods** based on AI state:
   - When user speaks → `showThought("User: ...", 3000)`
   - When AI is thinking → `setWorking(true)` + `showThought("Thinking...", 0)`
   - When AI responds → `setWorking(false)` + `showThought("AI: ...", 10000)`
   - On important events → `animate('bounce')` or `animate('wave')`

### Example Integration Structure

```javascript
// In your Gemini Live handler
geminiLive.on('user_speech', (text) => {
  window.pikachuAPI.showThought(`You: ${text}`, 3000);
});

geminiLive.on('ai_thinking', () => {
  window.pikachuAPI.setWorking(true);
  window.pikachuAPI.showThought('Processing...', 0);
});

geminiLive.on('ai_response', (text) => {
  window.pikachuAPI.setWorking(false);
  window.pikachuAPI.animate('bounce');
  window.pikachuAPI.showThought(text, 0);
});
```

## Platform Notes

- **macOS** - Fully supported
- **Windows** - Fully supported
- **Linux** - Supported, but transparency may vary by window manager

## Development

The app exposes the API in the developer console for testing:

```javascript
// Open DevTools (if enabled) and try:
window.pikachuAPI.showThought("Hello from console!", 3000);
window.pikachuAPI.animate('dance');
```

## License

MIT
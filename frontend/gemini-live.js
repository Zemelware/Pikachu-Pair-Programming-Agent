/**
 * Gemini Live Integration for Pikachu Agent
 * Handles voice input and AI responses with automatic state management
 */

const { ipcRenderer } = require('electron');

class PikachuGeminiLive {
  constructor() {
    this.isConnected = false;
    this.recognition = null;
    this.isProcessing = false;
    this.eventSource = null;
    
    // Session management
    this.sessionId = Math.random().toString().substring(10);
    this.backendHost = 'http://localhost:8000'; // Update this to match your backend
    this.sse_url = `${this.backendHost}/events/${this.sessionId}`;
    this.send_url = `${this.backendHost}/send/${this.sessionId}`;
    
    // Connect to SSE backend
    this.connectSSE();
    
    // Initialize speech recognition
    this.initSpeechRecognition();
    
    // Start in listening state
    this.startListening();
  }

  initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      // Continuous listening
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        console.log('🎤 Listening started');
        window.pikachuAPI.setListening();
      };

      this.recognition.onresult = async (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        console.log('User said:', transcript);
        
        // Process the speech
        await this.processUserInput(transcript);
      };

      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        // Restart listening after error
        setTimeout(() => {
          if (!this.isProcessing) {
            this.startListening();
          }
        }, 1000);
      };

      this.recognition.onend = () => {
        console.log('🎤 Listening ended');
        
        // Auto-restart if not processing
        if (!this.isProcessing) {
          setTimeout(() => this.startListening(), 500);
        }
      };
    } else {
      console.error('Speech recognition not supported');
      window.pikachuAPI.showMessage('speech not supported :(');
    }
  }

  startListening() {
    if (this.recognition && !this.isProcessing) {
      try {
        this.recognition.start();
        window.pikachuAPI.setListening();
      } catch (error) {
        // Ignore if already started
        if (error.message.includes('already started')) {
          return;
        }
        console.error('Error starting recognition:', error);
      }
    }
  }

  stopListening() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  async processUserInput(userInput) {
    this.isProcessing = true;
    this.stopListening();

    try {
      // Switch to thinking state
      window.pikachuAPI.setThinking('processing...');

      // Send to backend via SSE
      await this.callGeminiAPI(userInput);

      // Response will come through SSE event handler
      // The SSE onmessage handler will display the response and return to listening

    } catch (error) {
      console.error('Error processing input:', error);
      window.pikachuAPI.showMessage('oops! something went wrong');
      
      setTimeout(() => {
        this.isProcessing = false;
        this.startListening();
      }, 3000);
    }
  }

  async callGeminiAPI(userInput) {
    // Send message to backend via SSE
    try {
      const response = await fetch(this.send_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mime_type: "text/plain",
          data: userInput
        })
      });

      if (!response.ok) {
        console.error('Failed to send message:', response.statusText);
        throw new Error('Failed to send message');
      }

      // Response will come through SSE, so we return a placeholder
      return "processing...";
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Method to integrate with real Gemini API
  async connectToGemini(apiKey) {
    try {
      // TODO: Initialize Gemini SDK
      // const { GoogleGenerativeAI } = require('@google/generative-ai');
      // this.genAI = new GoogleGenerativeAI(apiKey);
      // this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      this.isConnected = true;
      console.log('✅ Connected to Gemini');
      return true;
    } catch (error) {
      console.error('Failed to connect to Gemini:', error);
      this.isConnected = false;
      return false;
    }
  }

  connectSSE() {
    // Connect to SSE endpoint (text mode)
    this.eventSource = new EventSource(`${this.sse_url}?is_audio=false`);

    // Handle connection open
    this.eventSource.onopen = () => {
      console.log('✅ SSE connection opened');
      this.isConnected = true;
      window.pikachuAPI.showMessage('connected!');
      
      // Return to listening after showing connected message
      setTimeout(() => {
        if (!this.isProcessing) {
          this.startListening();
        }
      }, 2000);
    };

    // Handle incoming messages from the agent
    this.eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('[AGENT TO CLIENT]', message);

      // Check if the turn is complete
      if (message.turn_complete) {
        console.log('Turn complete, returning to listening');
        setTimeout(() => {
          this.isProcessing = false;
          this.startListening();
        }, 3000);
        return;
      }

      // Handle text responses
      if (message.mime_type === 'text/plain') {
        window.pikachuAPI.showMessage(message.data);
      }
    };

    // Handle connection errors
    this.eventSource.onerror = (event) => {
      console.error('SSE connection error:', event);
      this.isConnected = false;
      window.pikachuAPI.showMessage('connection lost :(');
      
      // Try to reconnect after 5 seconds
      this.eventSource.close();
      setTimeout(() => {
        console.log('Reconnecting to SSE...');
        this.connectSSE();
      }, 5000);
    };
  }

  disconnect() {
    this.stopListening();
    if (this.eventSource) {
      this.eventSource.close();
    }
    this.isConnected = false;
    console.log('Disconnected from Gemini Live');
  }
}

// Initialize and export
const geminiLive = new PikachuGeminiLive();

// Expose to window for debugging
window.geminiLive = geminiLive;

console.log('🤖 Gemini Live integration ready');
console.log('Pikachu is always listening...');

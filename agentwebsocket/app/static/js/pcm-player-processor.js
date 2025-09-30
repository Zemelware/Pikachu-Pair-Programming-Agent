// PCM Player Processor - AudioWorklet for playing PCM audio data

class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioQueue = [];
    this.isPlaying = false;
    
    // Handle messages from main thread
    this.port.onmessage = (event) => {
      if (event.data === 'clear') {
        this.clearBuffer();
      } else if (event.data instanceof ArrayBuffer) {
        this.addAudioData(event.data);
      }
    };
  }

  clearBuffer() {
    // Clear all queued audio
    this.audioQueue = [];
  }

  addAudioData(arrayBuffer) {
    // Convert ArrayBuffer to Float32Array
    const int16Array = new Int16Array(arrayBuffer);
    const float32Array = new Float32Array(int16Array.length);
    
    // Convert from 16-bit PCM to float32 (-1.0 to 1.0)
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    
    this.audioQueue.push(float32Array);
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const outputChannel = output[0];
    
    if (this.audioQueue.length > 0 && outputChannel) {
      const audioData = this.audioQueue.shift();
      const framesToCopy = Math.min(audioData.length, outputChannel.length);
      
      // Copy audio data to output
      for (let i = 0; i < framesToCopy; i++) {
        outputChannel[i] = audioData[i];
      }
      
      // If there's remaining data, put it back in the queue
      if (audioData.length > framesToCopy) {
        const remaining = audioData.slice(framesToCopy);
        this.audioQueue.unshift(remaining);
      }
    } else {
      // Fill with silence if no audio data
      if (outputChannel) {
        outputChannel.fill(0);
      }
    }
    
    return true;
  }
}

registerProcessor('pcm-player-processor', PCMPlayerProcessor);

// PCM Recorder Processor - AudioWorklet for capturing microphone audio

class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 1024; // Buffer size for audio chunks
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const inputChannel = input[0];
    
    if (inputChannel) {
      // Process input audio data
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex++;
        
        // When buffer is full, send it to main thread
        if (this.bufferIndex >= this.bufferSize) {
          this.sendAudioData();
          this.bufferIndex = 0;
        }
      }
    }
    
    return true;
  }

  sendAudioData() {
    // Convert float32 to 16-bit PCM
    const int16Array = new Int16Array(this.bufferSize);
    for (let i = 0; i < this.bufferSize; i++) {
      // Clamp to [-1, 1] and convert to 16-bit
      const sample = Math.max(-1, Math.min(1, this.buffer[i]));
      int16Array[i] = sample * 32767;
    }
    
    // Send as ArrayBuffer to main thread
    this.port.postMessage({
      type: 'audio-data',
      buffer: int16Array.buffer
    });
  }
}

registerProcessor('pcm-recorder-processor', PCMRecorderProcessor);

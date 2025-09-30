/**
 * PCM Player Processor - AudioWorklet processor for playing PCM audio
 * Handles audio playback using a ring buffer for smooth streaming
 */
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Ring buffer for 180 seconds of audio at 24kHz
    this.bufferSize = 24000 * 180;
    this.ringBuffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.samplesAvailable = 0;

    // Listen for incoming audio data and commands
    this.port.onmessage = (event) => {
      if (event.data === 'clear') {
        this.clearBuffer();
      } else {
        this.addAudioData(event.data);
      }
    };
  }

  /**
   * Clears the audio buffer (stops playback immediately)
   */
  clearBuffer() {
    this.writeIndex = 0;
    this.readIndex = 0;
    this.samplesAvailable = 0;
    this.ringBuffer.fill(0);
  }

  /**
   * Adds audio data to the ring buffer
   * @param {ArrayBuffer} arrayBuffer - PCM audio data (Int16)
   */
  addAudioData(arrayBuffer) {
    // Convert Int16 ArrayBuffer to Float32 samples
    const int16Array = new Int16Array(arrayBuffer);
    const float32Array = new Float32Array(int16Array.length);
    
    for (let i = 0; i < int16Array.length; i++) {
      // Convert Int16 to Float32 (-1.0 to 1.0)
      float32Array[i] = int16Array[i] / 32768.0;
    }

    // Add samples to ring buffer
    for (let i = 0; i < float32Array.length; i++) {
      this.ringBuffer[this.writeIndex] = float32Array[i];
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
      
      // Update samples available (with overflow handling)
      if (this.samplesAvailable < this.bufferSize) {
        this.samplesAvailable++;
      } else {
        // Buffer overflow - move read index forward
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
      }
    }
  }

  /**
   * Process audio - called by the audio system to fill output buffers
   * @param {Array} inputs - Input audio buffers (unused)
   * @param {Array} outputs - Output audio buffers to fill
   * @returns {boolean} - true to keep processor alive
   */
  process(inputs, outputs) {
    const output = outputs[0];
    
    if (output.length === 0) {
      return true;
    }

    const channelData = output[0];
    const samplesToRead = Math.min(channelData.length, this.samplesAvailable);

    // Fill output buffer with samples from ring buffer
    for (let i = 0; i < samplesToRead; i++) {
      channelData[i] = this.ringBuffer[this.readIndex];
      this.readIndex = (this.readIndex + 1) % this.bufferSize;
      this.samplesAvailable--;
    }

    // Fill remaining samples with silence if not enough data
    for (let i = samplesToRead; i < channelData.length; i++) {
      channelData[i] = 0;
    }

    // Copy to all channels if stereo
    for (let channel = 1; channel < output.length; channel++) {
      output[channel].set(channelData);
    }

    return true;
  }
}

registerProcessor('pcm-player-processor', PCMPlayerProcessor);

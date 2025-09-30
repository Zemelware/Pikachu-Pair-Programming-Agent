/**
 * PCM Recorder Processor - AudioWorklet processor for recording microphone input
 * Captures audio frames and sends them to the main thread
 */
class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  /**
   * Process audio - called by the audio system with input buffers
   * @param {Array} inputs - Input audio buffers from microphone
   * @param {Array} outputs - Output audio buffers (unused)
   * @returns {boolean} - true to keep processor alive
   */
  process(inputs, outputs) {
    const input = inputs[0];
    
    if (input.length === 0) {
      return true;
    }

    // Get the first channel (mono audio)
    const channelData = input[0];
    
    if (channelData && channelData.length > 0) {
      // Copy the audio data
      const audioData = new Float32Array(channelData.length);
      audioData.set(channelData);
      
      // Send the audio data to the main thread
      this.port.postMessage(audioData);
    }

    return true;
  }
}

registerProcessor('pcm-recorder-processor', PCMRecorderProcessor);

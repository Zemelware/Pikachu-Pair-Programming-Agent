/**
 * Starts the audio recorder worklet for capturing microphone input
 * @param {Function} onAudioData - Callback function to handle recorded audio data
 * @returns {Promise<AudioWorkletNode>} The audio recorder worklet node
 */
export async function startAudioRecorderWorklet(onAudioData) {
  // Create audio context with 16kHz sample rate for recording
  const audioContext = new AudioContext({ sampleRate: 16000 });

  // Request microphone access
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      channelCount: 1,
      sampleRate: 16000
    } 
  });

  // Create media stream source from microphone
  const source = audioContext.createMediaStreamSource(stream);

  // Load the PCM recorder processor worklet
  await audioContext.audioWorklet.addModule('/static/js/pcm-recorder-processor.js');

  // Create the worklet node
  const audioRecorderNode = new AudioWorkletNode(audioContext, 'pcm-recorder-processor');

  // Handle audio data from the worklet
  audioRecorderNode.port.onmessage = (event) => {
    const audioData = event.data;
    
    // Convert Float32Array to Int16Array (PCM 16-bit)
    const int16Data = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    // Call the callback with the PCM data
    onAudioData(int16Data.buffer);
  };

  // Connect microphone to the recorder worklet
  source.connect(audioRecorderNode);

  console.log('Audio recorder worklet started');

  return audioRecorderNode;
}

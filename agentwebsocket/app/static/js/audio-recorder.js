// Audio recorder worklet for capturing microphone audio

const SAMPLE_RATE = 24000;
const CHANNELS = 1;

export async function startAudioRecorderWorklet(onAudioData) {
  try {
    // Get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: CHANNELS,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    // Create audio context
    const audioContext = new AudioContext({
      sampleRate: SAMPLE_RATE,
      latencyHint: 'interactive'
    });

    // Add the worklet module
    await audioContext.audioWorklet.addModule('/static/js/pcm-recorder-processor.js');

    // Create source from microphone
    const source = audioContext.createMediaStreamSource(stream);

    // Create the worklet node
    const recorderNode = new AudioWorkletNode(audioContext, 'pcm-recorder-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: CHANNELS
    });

    // Handle audio data from worklet
    recorderNode.port.onmessage = (event) => {
      if (event.data.type === 'audio-data') {
        onAudioData(event.data.buffer);
      }
    };

    // Connect source to recorder
    source.connect(recorderNode);

    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    console.log('Audio recorder worklet initialized');
    return [recorderNode, audioContext, stream];
  } catch (error) {
    console.error('Error starting audio recorder worklet:', error);
    throw error;
  }
}

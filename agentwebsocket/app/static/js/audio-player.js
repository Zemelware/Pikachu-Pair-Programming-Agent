// Audio player worklet for playing PCM audio data

const SAMPLE_RATE = 24000;
const CHANNELS = 1;

export async function startAudioPlayerWorklet() {
  try {
    // Create audio context
    const audioContext = new AudioContext({
      sampleRate: SAMPLE_RATE,
      latencyHint: 'interactive'
    });

    // Add the worklet module
    await audioContext.audioWorklet.addModule('/static/js/pcm-player-processor.js');

    // Create the worklet node
    const playerNode = new AudioWorkletNode(audioContext, 'pcm-player-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [CHANNELS]
    });

    // Connect to destination
    playerNode.connect(audioContext.destination);

    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    console.log('Audio player worklet initialized');
    return [playerNode, audioContext];
  } catch (error) {
    console.error('Error starting audio player worklet:', error);
    throw error;
  }
}

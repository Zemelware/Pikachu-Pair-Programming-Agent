/**
 * Starts the audio player worklet for playing PCM audio from the server
 * @returns {Promise<AudioWorkletNode>} The audio player worklet node
 */
export async function startAudioPlayerWorklet() {
  // Create audio context with 24kHz sample rate for playback
  const audioContext = new AudioContext({ sampleRate: 24000 });

  // Load the PCM player processor worklet
  await audioContext.audioWorklet.addModule('/static/js/pcm-player-processor.js');

  // Create the worklet node
  const audioPlayerNode = new AudioWorkletNode(audioContext, 'pcm-player-processor');

  // Connect the worklet to the audio destination (speakers)
  audioPlayerNode.connect(audioContext.destination);

  console.log('Audio player worklet started');

  return audioPlayerNode;
}

/**
 * VoiceProvider - Base class for voice service providers
 * 
 * This abstract base class defines the interface that all voice providers
 * must implement. It supports both speech-to-text (transcription) and
 * text-to-speech (synthesis) operations.
 */
export class VoiceProvider {
  constructor(config = {}) {
    this.config = config;
    this.name = 'base';
  }

  /**
   * Transcribe audio to text
   * @param {Buffer|string} audioData - Audio data (Buffer or base64 string)
   * @param {Object} options - Transcription options
   * @param {string} options.format - Audio format (mp3, wav, webm, etc.)
   * @param {string} options.language - Language code (optional)
   * @param {string} options.prompt - Context prompt (optional)
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(audioData, options = {}) {
    throw new Error(`transcribe() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Synthesize text to speech
   * @param {string} text - Text to convert to speech
   * @param {Object} options - Synthesis options
   * @param {string} options.voice - Voice identifier
   * @param {string} options.model - Model to use
   * @param {number} options.speed - Speech speed (0.25-4.0)
   * @param {string} options.format - Output format (mp3, opus, etc.)
   * @returns {Promise<Object>} Audio data and metadata
   */
  async synthesize(text, options = {}) {
    throw new Error(`synthesize() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Get available voices
   * @returns {Promise<Array>} List of available voices
   */
  async getVoices() {
    throw new Error(`getVoices() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Get provider capabilities
   * @returns {Object} Provider capabilities
   */
  getCapabilities() {
    return {
      transcription: false,
      synthesis: false,
      languages: [],
      formats: [],
      features: []
    };
  }
}
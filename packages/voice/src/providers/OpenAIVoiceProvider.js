import OpenAI from 'openai';
import { VoiceProvider } from './VoiceProvider.js';

/**
 * OpenAIVoiceProvider - Voice provider using OpenAI's Whisper and TTS APIs
 * 
 * Implements speech-to-text using Whisper API and text-to-speech using
 * OpenAI's TTS models.
 */
export class OpenAIVoiceProvider extends VoiceProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'openai';
    
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    this.client = new OpenAI({
      apiKey: config.apiKey
    });
    
    // Available voices for TTS
    this.voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    
    // Supported audio formats
    this.transcriptionFormats = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];
    this.synthesisFormats = ['mp3', 'opus', 'aac', 'flac'];
  }

  /**
   * Transcribe audio to text using Whisper API
   */
  async transcribe(audioData, options = {}) {
    try {
      // Convert audio data to File object
      let audioFile;
      
      if (typeof audioData === 'string') {
        // Base64 encoded audio
        const buffer = Buffer.from(audioData, 'base64');
        const blob = new Blob([buffer], { type: `audio/${options.format || 'webm'}` });
        audioFile = new File([blob], `audio.${options.format || 'webm'}`, {
          type: `audio/${options.format || 'webm'}`
        });
      } else if (audioData instanceof Buffer) {
        // Buffer
        const blob = new Blob([audioData], { type: `audio/${options.format || 'webm'}` });
        audioFile = new File([blob], `audio.${options.format || 'webm'}`, {
          type: `audio/${options.format || 'webm'}`
        });
      } else {
        // Assume it's already a File or Blob
        audioFile = audioData;
      }
      
      // Prepare transcription parameters
      const params = {
        file: audioFile,
        model: 'whisper-1'
      };
      
      if (options.language) {
        params.language = options.language;
      }
      
      if (options.prompt) {
        params.prompt = options.prompt;
      }
      
      // Call Whisper API
      const transcription = await this.client.audio.transcriptions.create(params);
      
      return {
        text: transcription.text,
        provider: this.name,
        model: 'whisper-1',
        language: options.language || 'auto-detected'
      };
      
    } catch (error) {
      throw new Error(`OpenAI transcription failed: ${error.message}`);
    }
  }

  /**
   * Synthesize text to speech using OpenAI TTS API
   */
  async synthesize(text, options = {}) {
    try {
      const voice = options.voice || 'alloy';
      const model = options.model || 'tts-1';
      const speed = options.speed || 1.0;
      const format = options.format || 'mp3';
      
      // Validate voice
      if (!this.voices.includes(voice)) {
        throw new Error(`Invalid voice: ${voice}. Available voices: ${this.voices.join(', ')}`);
      }
      
      // Validate format
      if (!this.synthesisFormats.includes(format)) {
        throw new Error(`Invalid format: ${format}. Supported formats: ${this.synthesisFormats.join(', ')}`);
      }
      
      // Call TTS API
      const response = await this.client.audio.speech.create({
        model: model,
        voice: voice,
        input: text,
        speed: speed,
        response_format: format
      });
      
      // Get audio data as buffer
      const audioBuffer = Buffer.from(await response.arrayBuffer());
      
      return {
        audio: audioBuffer,
        format: format,
        voice: voice,
        model: model,
        provider: this.name,
        duration: null // OpenAI doesn't provide duration
      };
      
    } catch (error) {
      throw new Error(`OpenAI synthesis failed: ${error.message}`);
    }
  }

  /**
   * Get available voices
   */
  async getVoices() {
    return this.voices.map(voice => ({
      id: voice,
      name: voice.charAt(0).toUpperCase() + voice.slice(1),
      provider: this.name,
      gender: this.getVoiceGender(voice),
      description: this.getVoiceDescription(voice)
    }));
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      transcription: true,
      synthesis: true,
      languages: ['auto-detect', 'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ko'],
      transcriptionFormats: this.transcriptionFormats,
      synthesisFormats: this.synthesisFormats,
      features: ['whisper', 'tts', 'multi-language', 'voice-selection', 'speed-control']
    };
  }

  /**
   * Helper to get voice gender
   */
  getVoiceGender(voice) {
    const femaleVoices = ['nova', 'shimmer'];
    const maleVoices = ['echo', 'onyx'];
    const neutralVoices = ['alloy', 'fable'];
    
    if (femaleVoices.includes(voice)) return 'female';
    if (maleVoices.includes(voice)) return 'male';
    return 'neutral';
  }

  /**
   * Helper to get voice description
   */
  getVoiceDescription(voice) {
    const descriptions = {
      alloy: 'Neutral and balanced',
      echo: 'Male, warm and conversational',
      fable: 'British accent, neutral',
      onyx: 'Male, deep and authoritative',
      nova: 'Female, energetic and friendly',
      shimmer: 'Female, soft and gentle'
    };
    
    return descriptions[voice] || 'Standard voice';
  }
}
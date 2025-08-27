/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool } from '@legion/tools-registry';
import fs from 'fs/promises';

/**
 * TranscribeAudioTool - Tool for converting audio to text
 * 
 * Supports multiple audio formats and languages using the configured
 * voice provider (e.g., OpenAI Whisper).
 */
// Input schema as plain JSON Schema
const transcribeAudioToolInputSchema = {
  type: 'object',
  properties: {
    audio: {
      type: 'string',
      description: 'Base64 encoded audio data or file path'
    },
    format: {
      type: 'string',
      enum: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
      default: 'webm',
      description: 'Audio format'
    },
    language: {
      type: 'string',
      description: 'Language code (e.g., "en", "es", "fr"). Auto-detect if not specified'
    },
    prompt: {
      type: 'string',
      description: 'Optional prompt to guide the transcription'
    }
  },
  required: ['audio']
};

// Output schema as plain JSON Schema
const transcribeAudioToolOutputSchema = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description: 'Transcribed text'
    },
    language: {
      type: 'string',
      description: 'Detected or specified language'
    },
    duration: {
      type: 'number',
      description: 'Audio duration in seconds'
    },
    confidence: {
      type: 'number',
      description: 'Transcription confidence score'
    },
    provider: {
      type: 'string',
      description: 'Provider used for transcription'
    }
  },
  required: ['text', 'language', 'provider']
};

export class TranscribeAudioTool extends Tool {
  constructor(provider) {
    super({
      name: 'transcribe_audio',
      description: 'Convert audio to text using speech recognition',
      schema: {
        input: transcribeAudioToolInputSchema,
        output: transcribeAudioToolOutputSchema
      }
    });
    
    this.provider = provider;
  }
  
  async execute(params) {
    try {
      this.progress('Starting transcription...', 0, {
        status: 'Starting transcription...'
      });
      
      // No validation here - happens at invocation layer
      // Use input parameters directly
      const { audio, format = 'webm', language, prompt } = params;
      
      // Handle audio input
      let audioData;
      
      if (audio.startsWith('/') || audio.startsWith('./')) {
        // File path - read the file
        this.progress('Reading audio file...', 10, {
          status: 'Reading audio file...'
        });
        
        try {
          audioData = await fs.readFile(audio);
        } catch (error) {
          throw new Error(`Failed to read audio file: ${error.message}`);
        }
      } else if (audio.startsWith('data:')) {
        // Data URL - extract base64 data
        const base64Data = audio.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid data URL format');
        }
        audioData = base64Data;
      } else {
        // Assume it's already base64 encoded
        audioData = audio;
      }
      
      this.progress('Processing audio...', 30, {
        status: 'Processing audio...'
      });
      
      // Prepare options
      const options = {
        format,
        language,
        prompt
      };
      
      // Call provider to transcribe
      this.progress('Transcribing audio...', 50, {
        status: 'Transcribing audio...'
      });
      
      const result = await this.provider.transcribe(audioData, options);
      
      this.progress('Finalizing transcription...', 90, {
        status: 'Finalizing transcription...'
      });
      
      // Log info about the transcription
      this.info(`Transcribed ${result.text.split(' ').length} words`, {
        data: {
          wordCount: result.text.split(' ').length,
          language: result.language
        }
      });
      
      this.progress('Transcription complete', 100, {
        status: 'Transcription complete'
      });
      
      return {
        text: result.text,
        language: result.language || 'unknown',
        duration: result.duration,
        confidence: result.confidence,
        provider: result.provider
      };
      
    } catch (error) {
      this.error(`Transcription failed: ${error.message}`, {
        error: error
      });
      throw error;
    }
  }
  
  getMetadata() {
    return {
      description: 'Convert audio to text using speech recognition',
      input: transcribeAudioToolInputSchema,
      output: transcribeAudioToolOutputSchema
    };
  }

}
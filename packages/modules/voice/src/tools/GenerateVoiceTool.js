/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool } from '@legion/tools-registry';
import fs from 'fs/promises';
import path from 'path';

/**
 * GenerateVoiceTool - Tool for converting text to speech
 * 
 * Generates natural-sounding speech from text using the configured
 * voice provider (e.g., OpenAI TTS).
 */
// Input schema as plain JSON Schema
const generateVoiceToolInputSchema = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      minLength: 1,
      maxLength: 4096,
      description: 'Text to convert to speech'
    },
    voice: {
      type: 'string',
      enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
      default: 'alloy',
      description: 'Voice to use for speech generation'
    },
    model: {
      type: 'string',
      enum: ['tts-1', 'tts-1-hd'],
      default: 'tts-1',
      description: 'TTS model (tts-1 is faster, tts-1-hd is higher quality)'
    },
    speed: {
      type: 'number',
      minimum: 0.25,
      maximum: 4.0,
      default: 1.0,
      description: 'Speech speed multiplier'
    },
    format: {
      type: 'string',
      enum: ['mp3', 'opus', 'aac', 'flac'],
      default: 'mp3',
      description: 'Output audio format'
    },
    outputPath: {
      type: 'string',
      description: 'Optional file path to save the audio'
    }
  },
  required: ['text']
};

// Output schema as plain JSON Schema
const generateVoiceToolOutputSchema = {
  type: 'object',
  properties: {
    audio: {
      type: 'string',
      description: 'Base64 encoded audio data'
    },
    format: {
      type: 'string',
      description: 'Audio format'
    },
    voice: {
      type: 'string',
      description: 'Voice used'
    },
    model: {
      type: 'string',
      description: 'Model used'
    },
    duration: {
      type: 'number',
      description: 'Audio duration in seconds'
    },
    size: {
      type: 'number',
      description: 'Audio size in bytes'
    },
    filePath: {
      type: 'string',
      description: 'File path if saved'
    },
    provider: {
      type: 'string',
      description: 'Provider used for synthesis'
    }
  },
  required: ['audio', 'format', 'voice', 'model', 'size', 'provider']
};

export class GenerateVoiceTool extends Tool {
  constructor(provider) {

    super({
      name: 'generate_voice',
      description: 'Convert text to speech audio',
      inputSchema: generateVoiceToolInputSchema,
      outputSchema: generateVoiceToolOutputSchema,
      execute: async (params) => {
        try {
          this.progress('Starting text-to-speech generation...', 0, {
            status: 'Starting text-to-speech generation...'
          });
          
          // Check text length
          const wordCount = params.text.split(' ').length;
          const charCount = params.text.length;
          
          this.info(`Processing ${wordCount} words (${charCount} characters)`, {
            data: { wordCount, charCount }
          });
          
          this.progress('Preparing synthesis options...', 20, {
            status: 'Preparing synthesis options...'
          });
          
          // Prepare synthesis options
          const options = {
            voice: params.voice || 'alloy',
            model: params.model || 'tts-1',
            speed: params.speed || 1.0,
            format: params.format || 'mp3'
          };
          
          // Call provider to synthesize
          this.progress(`Generating speech with ${options.voice} voice...`, 40, {
            status: `Generating speech with ${options.voice} voice...`
          });
          
          const result = await this.provider.synthesize(params.text, options);
          
          this.progress('Processing audio data...', 80, {
            status: 'Processing audio data...'
          });
          
          // Convert buffer to base64
          const base64Audio = result.audio.toString('base64');
          
          // Save to file if requested
          let filePath;
          if (params.outputPath) {
            this.progress('Saving audio file...', 90, {
              status: 'Saving audio file...'
            });
            
            try {
              // Ensure directory exists
              const dir = path.dirname(params.outputPath);
              await fs.mkdir(dir, { recursive: true });
              
              // Save the audio file
              await fs.writeFile(params.outputPath, result.audio);
              filePath = params.outputPath;
              
              this.info(`Audio saved to ${params.outputPath}`, {
                data: { filePath: params.outputPath }
              });
            } catch (error) {
              this.warning(`Failed to save audio file: ${error.message}`, {
                error: error
              });
            }
          }
          
          this.progress('Text-to-speech generation complete', 100, {
            status: 'Text-to-speech generation complete'
          });
          
          return {
            audio: base64Audio,
            format: result.format,
            voice: result.voice,
            model: result.model,
            duration: result.duration,
            size: result.audio.length,
            filePath: filePath,
            provider: result.provider
          };
          
        } catch (error) {
          this.error(`Speech synthesis failed: ${error.message}`, {
            error: error
          });
          throw error;
        }
      },
      getMetadata: () => ({
        description: 'Convert text to speech audio',
        input: generateVoiceToolInputSchema,
        output: generateVoiceToolOutputSchema
      })
    });
    
    this.provider = provider;
  }

}
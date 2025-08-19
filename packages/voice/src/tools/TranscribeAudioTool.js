import { Tool } from '@legion/tools-registry';
import { z } from 'zod';
import fs from 'fs/promises';

/**
 * TranscribeAudioTool - Tool for converting audio to text
 * 
 * Supports multiple audio formats and languages using the configured
 * voice provider (e.g., OpenAI Whisper).
 */
export class TranscribeAudioTool extends Tool {
  constructor(provider) {
    const inputSchema = z.object({
      audio: z.string().describe('Base64 encoded audio data or file path'),
      format: z.enum(['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'])
        .default('webm')
        .optional()
        .describe('Audio format'),
      language: z.string()
        .optional()
        .describe('Language code (e.g., "en", "es", "fr"). Auto-detect if not specified'),
      prompt: z.string()
        .optional()
        .describe('Optional prompt to guide the transcription')
    });
    
    const outputSchema = z.object({
      text: z.string().describe('Transcribed text'),
      language: z.string().describe('Detected or specified language'),
      duration: z.number().optional().describe('Audio duration in seconds'),
      confidence: z.number().optional().describe('Transcription confidence score'),
      provider: z.string().describe('Provider used for transcription')
    });

    super({
      name: 'transcribe_audio',
      description: 'Convert audio to text using speech recognition',
      inputSchema: inputSchema,
      execute: async (params) => {
        try {
          this.progress('Starting transcription...', 0, {
            status: 'Starting transcription...'
          });
          
          // Validate input
          const validated = inputSchema.parse(params);
          
          // Handle audio input
          let audioData;
          
          if (validated.audio.startsWith('/') || validated.audio.startsWith('./')) {
            // File path - read the file
            this.progress('Reading audio file...', 10, {
              status: 'Reading audio file...'
            });
            
            try {
              audioData = await fs.readFile(validated.audio);
            } catch (error) {
              throw new Error(`Failed to read audio file: ${error.message}`);
            }
          } else if (validated.audio.startsWith('data:')) {
            // Data URL - extract base64 data
            const base64Data = validated.audio.split(',')[1];
            if (!base64Data) {
              throw new Error('Invalid data URL format');
            }
            audioData = base64Data;
          } else {
            // Assume it's already base64 encoded
            audioData = validated.audio;
          }
          
          this.progress('Processing audio...', 30, {
            status: 'Processing audio...'
          });
          
          // Prepare options
          const options = {
            format: validated.format,
            language: validated.language,
            prompt: validated.prompt
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
      },
      getMetadata: () => ({
        description: 'Convert audio to text using speech recognition',
        input: inputSchema,
        output: outputSchema
      })
    });
    
    this.provider = provider;
  }

}
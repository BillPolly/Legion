import { Tool } from '@legion/tools';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

/**
 * GenerateVoiceTool - Tool for converting text to speech
 * 
 * Generates natural-sounding speech from text using the configured
 * voice provider (e.g., OpenAI TTS).
 */
export class GenerateVoiceTool extends Tool {
  constructor(provider) {
    super();
    
    this.name = 'generate_voice';
    this.description = 'Convert text to speech audio';
    
    this.inputSchema = z.object({
      text: z.string()
        .min(1)
        .max(4096)
        .describe('Text to convert to speech'),
      voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'])
        .default('alloy')
        .optional()
        .describe('Voice to use for speech generation'),
      model: z.enum(['tts-1', 'tts-1-hd'])
        .default('tts-1')
        .optional()
        .describe('TTS model (tts-1 is faster, tts-1-hd is higher quality)'),
      speed: z.number()
        .min(0.25)
        .max(4.0)
        .default(1.0)
        .optional()
        .describe('Speech speed multiplier'),
      format: z.enum(['mp3', 'opus', 'aac', 'flac'])
        .default('mp3')
        .optional()
        .describe('Output audio format'),
      outputPath: z.string()
        .optional()
        .describe('Optional file path to save the audio')
    });
    
    this.outputSchema = z.object({
      audio: z.string().describe('Base64 encoded audio data'),
      format: z.string().describe('Audio format'),
      voice: z.string().describe('Voice used'),
      model: z.string().describe('Model used'),
      duration: z.number().optional().describe('Audio duration in seconds'),
      size: z.number().describe('Audio size in bytes'),
      filePath: z.string().optional().describe('File path if saved'),
      provider: z.string().describe('Provider used for synthesis')
    });
    
    this.provider = provider;
  }

  async execute(params) {
    try {
      this.emit('progress', {
        percentage: 0,
        status: 'Starting text-to-speech generation...'
      });
      
      // Validate input
      const validated = this.inputSchema.parse(params);
      
      // Check text length
      const wordCount = validated.text.split(' ').length;
      const charCount = validated.text.length;
      
      this.emit('info', {
        message: `Processing ${wordCount} words (${charCount} characters)`,
        data: { wordCount, charCount }
      });
      
      this.emit('progress', {
        percentage: 20,
        status: 'Preparing synthesis options...'
      });
      
      // Prepare synthesis options
      const options = {
        voice: validated.voice,
        model: validated.model,
        speed: validated.speed,
        format: validated.format
      };
      
      // Call provider to synthesize
      this.emit('progress', {
        percentage: 40,
        status: `Generating speech with ${validated.voice} voice...`
      });
      
      const result = await this.provider.synthesize(validated.text, options);
      
      this.emit('progress', {
        percentage: 80,
        status: 'Processing audio data...'
      });
      
      // Convert buffer to base64
      const base64Audio = result.audio.toString('base64');
      
      // Save to file if requested
      let filePath;
      if (validated.outputPath) {
        this.emit('progress', {
          percentage: 90,
          status: 'Saving audio file...'
        });
        
        try {
          // Ensure directory exists
          const dir = path.dirname(validated.outputPath);
          await fs.mkdir(dir, { recursive: true });
          
          // Save the audio file
          await fs.writeFile(validated.outputPath, result.audio);
          filePath = validated.outputPath;
          
          this.emit('info', {
            message: `Audio saved to ${validated.outputPath}`,
            data: { filePath: validated.outputPath }
          });
        } catch (error) {
          this.emit('warning', {
            message: `Failed to save audio file: ${error.message}`,
            error: error
          });
        }
      }
      
      this.emit('progress', {
        percentage: 100,
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
      this.emit('error', {
        message: `Speech synthesis failed: ${error.message}`,
        error: error
      });
      throw error;
    }
  }
}
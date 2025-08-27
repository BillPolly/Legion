import { jest } from '@jest/globals';
import VoiceModule from '../../src/VoiceModule.js';
import { OpenAIVoiceProvider } from '../../src/providers/OpenAIVoiceProvider.js';
import { TranscribeAudioTool } from '../../src/tools/TranscribeAudioTool.js';
import { GenerateVoiceTool } from '../../src/tools/GenerateVoiceTool.js';

describe('VoiceModule', () => {
  const mockConfig = {
    apiKey: 'test-api-key',
    provider: 'openai'
  };

  describe('initialization', () => {
    test('should initialize with OpenAI provider by default', () => {
      const module = new VoiceModule(mockConfig);
      
      expect(module.name).toBe('voice');
      expect(module.provider).toBeInstanceOf(OpenAIVoiceProvider);
      expect(module.tools).toHaveLength(2);
    });

    test('should throw error if no API key provided', () => {
      expect(() => {
        new VoiceModule({ provider: 'openai' });
      }).toThrow('OpenAI API key is required');
    });

    test('should throw error for unknown provider', () => {
      expect(() => {
        new VoiceModule({ ...mockConfig, provider: 'unknown' });
      }).toThrow('Unknown voice provider: unknown');
    });
  });

  describe('getTools', () => {
    test('should return transcribe and generate tools', () => {
      const module = new VoiceModule(mockConfig);
      const tools = module.getTools();
      
      expect(tools).toHaveLength(2);
      expect(tools[0]).toBeInstanceOf(TranscribeAudioTool);
      expect(tools[1]).toBeInstanceOf(GenerateVoiceTool);
      expect(tools[0].name).toBe('transcribe_audio');
      expect(tools[1].name).toBe('generate_voice');
    });
  });

  describe('transcribeAudio', () => {
    test('should delegate to TranscribeAudioTool', async () => {
      const module = new VoiceModule(mockConfig);
      const mockExecute = jest.fn().mockResolvedValue({ text: 'Hello world' });
      module.transcribeTool.execute = mockExecute;
      
      const params = { audio: 'base64data', format: 'webm' };
      const result = await module.transcribeAudio(params);
      
      expect(mockExecute).toHaveBeenCalledWith(params);
      expect(result).toEqual({ text: 'Hello world' });
    });
  });

  describe('generateVoice', () => {
    test('should delegate to GenerateVoiceTool', async () => {
      const module = new VoiceModule(mockConfig);
      const mockExecute = jest.fn().mockResolvedValue({ audio: 'base64audio' });
      module.generateTool.execute = mockExecute;
      
      const params = { text: 'Hello world', voice: 'alloy' };
      const result = await module.generateVoice(params);
      
      expect(mockExecute).toHaveBeenCalledWith(params);
      expect(result).toEqual({ audio: 'base64audio' });
    });
  });

  describe('getAvailableVoices', () => {
    test('should return provider voices', async () => {
      const module = new VoiceModule(mockConfig);
      const mockVoices = [
        { id: 'alloy', name: 'Alloy' },
        { id: 'echo', name: 'Echo' }
      ];
      module.provider.getVoices = jest.fn().mockResolvedValue(mockVoices);
      
      const voices = await module.getAvailableVoices();
      
      expect(voices).toEqual(mockVoices);
    });
  });

  describe('getInfo', () => {
    test('should return module information', () => {
      const module = new VoiceModule(mockConfig);
      const info = module.getInfo();
      
      expect(info).toMatchObject({
        name: 'voice',
        version: '1.0.0',
        provider: 'openai',
        capabilities: expect.any(Object),
        tools: expect.arrayContaining([
          { name: 'transcribe_audio', description: expect.any(String) },
          { name: 'generate_voice', description: expect.any(String) }
        ])
      });
    });
  });
});
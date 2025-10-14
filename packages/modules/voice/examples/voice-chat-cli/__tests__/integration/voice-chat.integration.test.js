import { ResourceManager } from '@legion/resource-manager';
import VoiceModule from '../../../../src/VoiceModule.js';
import { VoiceChatBot } from '../../src/VoiceChatBot.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Voice Chat Integration Tests', () => {
  let resourceManager;
  let voiceModule;
  let chatbot;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();

    // Initialize Voice Module
    voiceModule = await VoiceModule.create(resourceManager);

    // Get ZAI config from ResourceManager
    const zaiApiKey = resourceManager.get('env.ZAI_API_KEY');
    const zaiBaseURL = resourceManager.get('env.ZAI_BASE_URL');
    const zaiModel = resourceManager.get('env.ZAI_MODEL') || 'glm-4.6';

    // Initialize chatbot with ZAI
    chatbot = new VoiceChatBot({
      provider: 'zai',
      apiKey: zaiApiKey,
      baseURL: zaiBaseURL,
      model: zaiModel,
      systemPrompt: 'You are a helpful assistant. Keep responses very short (1-2 sentences).',
      maxHistoryLength: 10
    });
  }, 30000);

  afterEach(() => {
    // Clear history between tests
    chatbot.clearHistory();
  });

  describe('Text chatbot', () => {
    test('should send message and get response from ZAI', async () => {
      const response = await chatbot.sendMessage('What is 2+2? Just give the number.');

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);

      console.log('ZAI Response:', response);
    }, 30000);

    test('should maintain conversation history', async () => {
      await chatbot.sendMessage('My name is Alice.');
      const response = await chatbot.sendMessage('What is my name?');

      expect(response.toLowerCase()).toContain('alice');

      const history = chatbot.getHistory();
      expect(history).toHaveLength(4); // 2 user + 2 assistant
    }, 30000);

    test('should handle multiple turns', async () => {
      await chatbot.sendMessage('My favorite color is blue.');
      await chatbot.sendMessage('What is my favorite color?');
      const response = await chatbot.sendMessage('Confirm my favorite color in one word.');

      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(0);
      expect(response.toLowerCase()).toContain('blue');

      const history = chatbot.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(6);
    }, 45000);
  });

  describe('Voice integration (transcription only)', () => {
    test('should transcribe audio and chat with result', async () => {
      const audioPath = join(__dirname, '../../../../__tests__/data/test-alloy.mp3');

      // Transcribe audio
      const transcribeResult = await voiceModule.transcribeAudio({
        audio: audioPath,
        format: 'mp3'
      });

      expect(transcribeResult.success).toBe(true);
      expect(transcribeResult.data.text).toBeDefined();

      const transcription = transcribeResult.data.text;
      console.log('Transcription:', transcription);

      // Send transcription to chatbot
      const response = await chatbot.sendMessage(transcription);

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      console.log('Chatbot response:', response);
    }, 45000);
  });

  describe('TTS generation', () => {
    test('should generate speech from text', async () => {
      const testText = 'Hello, this is a test of the text to speech system.';

      const ttsResult = await voiceModule.generateVoice({
        text: testText,
        voice: 'nova',
        model: 'tts-1'
      });

      expect(ttsResult.success).toBe(true);
      expect(ttsResult.data.audio).toBeDefined();

      // Verify it's base64 encoded audio
      const audioBuffer = Buffer.from(ttsResult.data.audio, 'base64');
      expect(audioBuffer.length).toBeGreaterThan(0);

      console.log(`Generated audio size: ${audioBuffer.length} bytes`);
    }, 30000);
  });

  describe('Full voice conversation flow', () => {
    test('should handle transcription -> chat -> TTS', async () => {
      const audioPath = join(__dirname, '../../../../__tests__/data/test-nova.mp3');

      // 1. Transcribe audio
      const transcribeResult = await voiceModule.transcribeAudio({
        audio: audioPath,
        format: 'mp3'
      });

      expect(transcribeResult.success).toBe(true);
      const transcription = transcribeResult.data.text;
      console.log('1. Transcribed:', transcription);

      // 2. Chat with transcription
      const response = await chatbot.sendMessage(transcription);
      expect(response).toBeDefined();
      console.log('2. Chatbot response:', response);

      // 3. Generate TTS for response
      const ttsResult = await voiceModule.generateVoice({
        text: response.substring(0, 100), // Limit length to save credits
        voice: 'nova',
        model: 'tts-1'
      });

      expect(ttsResult.success).toBe(true);
      const audioBuffer = Buffer.from(ttsResult.data.audio, 'base64');
      console.log('3. Generated TTS audio:', audioBuffer.length, 'bytes');

      // Optional: Save to temp file for manual testing
      const tempFile = `/tmp/voice-chat-test-${Date.now()}.mp3`;
      await fs.writeFile(tempFile, audioBuffer);
      console.log(`   Saved to: ${tempFile}`);
    }, 60000);
  });

  describe('Provider info', () => {
    test('should return correct provider information', () => {
      const info = chatbot.getProviderInfo();

      expect(info.provider).toBe('zai');
      expect(info.model).toBe('glm-4.6');
    });
  });
});

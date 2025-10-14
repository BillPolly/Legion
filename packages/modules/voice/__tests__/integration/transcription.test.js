import { ResourceManager } from '@legion/resource-manager';
import VoiceModule from '../../src/VoiceModule.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Voice Transcription Integration Tests', () => {
  let resourceManager;
  let voiceModule;

  beforeAll(async () => {
    // Get ResourceManager singleton - it auto-initializes
    resourceManager = await ResourceManager.getInstance();

    // Create voice module using ResourceManager
    voiceModule = await VoiceModule.create(resourceManager);
  }, 30000); // 30 second timeout for initialization

  test('should transcribe audio file', async () => {
    const audioPath = join(__dirname, '../data/test-alloy.mp3');

    const result = await voiceModule.transcribeAudio({
      audio: audioPath,
      format: 'mp3'
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.text).toBeDefined();
    expect(typeof result.data.text).toBe('string');
    expect(result.data.text.length).toBeGreaterThan(0);
    expect(result.data.provider).toBe('openai');
    expect(result.data.language).toBeDefined();

    console.log('Transcription result:', result.data.text);
  }, 30000);
});

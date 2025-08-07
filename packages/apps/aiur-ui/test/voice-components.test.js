/**
 * Voice Components Unit Tests
 * 
 * Tests the individual voice components in isolation
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { VoiceRecorder } from '../src/components/chat/voice/VoiceRecorder.js';
import { VoiceController } from '../src/components/chat/voice/VoiceController.js';

// Set up JSDOM
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true
});

global.window = dom.window;
global.document = window.document;
global.navigator = window.navigator;
global.Blob = window.Blob;
global.File = window.File;
global.FileReader = window.FileReader;
global.Audio = jest.fn(() => ({
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  volume: 1
}));

// Mock MediaRecorder
class MockMediaRecorder {
  constructor(stream, options) {
    this.stream = stream;
    this.options = options;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
  }
  
  start(timeslice) {
    this.state = 'recording';
    setTimeout(() => {
      if (this.ondataavailable) {
        const mockData = new Blob(['mock-audio'], { type: 'audio/webm' });
        this.ondataavailable({ data: mockData });
      }
    }, 10);
  }
  
  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      setTimeout(() => this.onstop(), 0);
    }
  }
  
  static isTypeSupported(type) {
    return type.includes('webm');
  }
}

global.MediaRecorder = MockMediaRecorder;

// Mock getUserMedia
navigator.mediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue({
    getTracks: () => [{
      stop: jest.fn()
    }]
  })
};

describe('VoiceRecorder', () => {
  let recorder;
  
  beforeEach(() => {
    recorder = new VoiceRecorder();
  });
  
  afterEach(() => {
    recorder.destroy();
  });
  
  test('initializes and requests microphone permission', async () => {
    const result = await recorder.initialize();
    
    expect(result).toBe(true);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  });
  
  test('starts and stops recording', async () => {
    await recorder.initialize();
    
    const dataPromise = new Promise(resolve => {
      recorder.onDataAvailable = resolve;
    });
    
    await recorder.start();
    expect(recorder.isRecording).toBe(true);
    
    const data = await dataPromise;
    
    recorder.stop();
    expect(recorder.isRecording).toBe(false);
    
    expect(data).toHaveProperty('audio');
    expect(data).toHaveProperty('format');
    expect(data.format).toBe('webm');
  });
  
  test('handles permission denied', async () => {
    navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(
      new Error('Permission denied')
    );
    
    const errorPromise = new Promise(resolve => {
      recorder.onError = resolve;
    });
    
    const result = await recorder.initialize();
    
    expect(result).toBe(false);
    
    const error = await errorPromise;
    expect(error.type).toBe('permission');
    expect(error.message).toContain('Microphone access denied');
  });
});

describe('VoiceController', () => {
  let controller;
  
  beforeEach(() => {
    controller = new VoiceController();
  });
  
  afterEach(() => {
    controller.destroy();
  });
  
  test('plays audio data', async () => {
    const startPromise = new Promise(resolve => {
      controller.onPlaybackStart = resolve;
    });
    
    const mockAudioData = 'bW9jay1hdWRpbw=='; // base64
    await controller.play(mockAudioData, 'test-msg', { format: 'mp3' });
    
    const messageId = await startPromise;
    expect(messageId).toBe('test-msg');
    expect(controller.isPlaying).toBe(true);
  });
  
  test('manages audio queue', async () => {
    // Play first audio
    await controller.play('audio1', 'msg1');
    expect(controller.audioQueue.length).toBe(0);
    
    // Queue second audio while first is playing
    await controller.play('audio2', 'msg2');
    expect(controller.audioQueue.length).toBe(1);
    
    // High priority bypasses queue
    await controller.play('audio3', 'msg3', { priority: 'high' });
    expect(controller.currentMessageId).toBe('msg3');
  });
  
  test('auto-play mode', () => {
    controller.setAutoPlay(true);
    expect(controller.autoPlayEnabled).toBe(true);
    
    // Test shouldAutoPlay logic
    expect(controller.shouldAutoPlay({
      role: 'assistant',
      content: 'Hello there'
    })).toBe(true);
    
    expect(controller.shouldAutoPlay({
      role: 'user',
      content: 'Hello'
    })).toBe(false);
    
    expect(controller.shouldAutoPlay({
      role: 'assistant',
      content: '```code block```'
    })).toBe(false);
  });
  
  test('volume control', () => {
    controller.setVolume(0.5);
    expect(controller.volume).toBe(0.5);
    
    controller.setVolume(1.5);
    expect(controller.volume).toBe(1); // Clamped to max
    
    controller.setVolume(-0.5);
    expect(controller.volume).toBe(0); // Clamped to min
  });
});

describe('Voice Integration Flow', () => {
  test('recording to base64 conversion', async () => {
    const recorder = new VoiceRecorder();
    await recorder.initialize();
    
    const dataPromise = new Promise(resolve => {
      recorder.onDataAvailable = (data) => resolve(data);
    });
    
    await recorder.start();
    const result = await dataPromise;
    recorder.stop();
    
    expect(result.audio).toBeTruthy();
    expect(typeof result.audio).toBe('string'); // base64 string
    expect(result.format).toBe('webm');
    expect(result.duration).toBeGreaterThan(0);
    
    recorder.destroy();
  });
  
  test('base64 to audio playback', async () => {
    const controller = new VoiceController();
    
    const mockBase64Audio = btoa('mock-audio-data');
    
    let playbackStarted = false;
    controller.onPlaybackStart = () => {
      playbackStarted = true;
    };
    
    await controller.play(mockBase64Audio, 'test-message');
    
    expect(playbackStarted).toBe(true);
    expect(controller.isPlaying).toBe(true);
    
    controller.destroy();
  });
});
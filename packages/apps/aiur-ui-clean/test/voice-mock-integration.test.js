/**
 * Voice Mock Integration Test
 * 
 * Tests voice flow with mocked actor system to avoid module resolution issues
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { MockWebSocket } from './mocks/MockWebSocket.js';
import { ChatModel } from '../src/components/chat/model/ChatModel.js';
import { ChatView } from '../src/components/chat/view/ChatView.js';
import { ChatViewModel } from '../src/components/chat/viewmodel/ChatViewModel.js';
import { ChatActor } from '../src/actors/ChatActor.js';

// Set up JSDOM
const dom = new JSDOM('<!DOCTYPE html><div id="chat-container"></div>', {
  url: 'http://localhost',
  pretendToBeVisual: true
});

global.window = dom.window;
global.document = window.document;
global.navigator = window.navigator;
global.WebSocket = MockWebSocket;
global.Audio = window.Audio;
global.Blob = window.Blob;
global.File = window.File;
global.FileReader = window.FileReader;
global.MediaRecorder = jest.fn();
global.AudioContext = window.AudioContext || jest.fn();

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
        const mockAudioData = new Blob(['mock-audio-data'], { type: 'audio/webm' });
        this.ondataavailable({ data: mockAudioData });
      }
    }, 100);
  }
  
  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      setTimeout(() => this.onstop(), 0);
    }
  }
  
  static isTypeSupported(mimeType) {
    return mimeType.includes('webm');
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

describe('Voice Mock Integration Tests', () => {
  let chatModel;
  let chatView;
  let chatViewModel;
  let chatActor;
  let mockServerSocket;
  
  beforeEach(() => {
    // Clear DOM
    document.getElementById('chat-container').innerHTML = '';
    
    // Create components
    const container = document.getElementById('chat-container');
    chatModel = new ChatModel();
    chatView = new ChatView(container);
    chatActor = new ChatActor();
    
    // Create mock server socket
    const [clientSocket, serverSocket] = MockWebSocket.createPair();
    mockServerSocket = serverSocket;
    
    // Simulate connection
    chatActor.connected = true;
    chatActor.remoteAgent = {
      receive: (message) => {
        // Simulate sending through WebSocket
        clientSocket.send(JSON.stringify({
          targetGuid: 'server-chat-agent',
          payload: message
        }));
      }
    };
    
    // Handle server responses
    serverSocket.onmessage = (event) => {
      const { payload } = JSON.parse(event.data);
      
      // Simulate server processing
      if (payload.type === 'voice_input') {
        setTimeout(() => {
          chatActor.receive({
            type: 'voice_transcription',
            text: 'Test transcription result',
            language: 'en'
          });
        }, 50);
      } else if (payload.type === 'generate_speech') {
        setTimeout(() => {
          chatActor.receive({
            type: 'voice_audio',
            audio: 'bW9jay1hdWRpby1kYXRh',
            format: 'mp3',
            messageId: payload.messageId
          });
        }, 50);
      }
    };
    
    // Create view model
    chatViewModel = new ChatViewModel(chatModel, chatView, chatActor);
  });
  
  afterEach(() => {
    chatViewModel.destroy();
    jest.clearAllMocks();
  });
  
  test('Voice recording flow', async () => {
    // Start recording
    await chatViewModel.startVoiceRecording();
    
    // Check UI state
    expect(chatView.voiceState.isRecording).toBe(true);
    expect(chatView.elements.voiceIndicator.style.display).toBe('block');
    
    // Stop recording
    chatViewModel.stopVoiceRecording();
    
    // Wait for audio processing
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check that voice input was sent
    const messages = mockServerSocket.sentMessages;
    const voiceInput = messages.find(msg => {
      const parsed = JSON.parse(msg);
      return parsed.payload?.type === 'voice_input';
    });
    
    expect(voiceInput).toBeDefined();
  });
  
  test('Text-to-speech flow', async () => {
    // Add assistant message
    const message = chatModel.addMessage('Test message', 'assistant');
    
    // Request TTS
    chatViewModel.playMessageAudio(message);
    
    // Wait for request
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check TTS request was sent
    const messages = mockServerSocket.sentMessages;
    const ttsRequest = messages.find(msg => {
      const parsed = JSON.parse(msg);
      return parsed.payload?.type === 'generate_speech';
    });
    
    expect(ttsRequest).toBeDefined();
    
    // Wait for audio response
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check voice controller received audio
    expect(chatViewModel.voiceController.isPlaying).toBe(true);
  });
  
  test('Auto-play mode toggle', () => {
    // Enable auto-play
    chatViewModel.setVoiceAutoPlay(true);
    
    // Check state
    expect(chatView.voiceState.autoPlayEnabled).toBe(true);
    expect(chatViewModel.voiceController.autoPlayEnabled).toBe(true);
    
    // Check UI
    const toggle = chatView.elements.voiceModeToggle;
    expect(toggle.classList.contains('active')).toBe(true);
    expect(toggle.innerHTML).toBe('🔊');
  });
  
  test('Voice error handling', async () => {
    // Mock getUserMedia failure
    navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(
      new Error('Permission denied')
    );
    
    // Try to record
    await chatViewModel.startVoiceRecording();
    
    // Check error state
    expect(chatModel.error).toContain('Failed to start voice recording');
    expect(chatView.voiceState.isRecording).toBe(false);
  });
  
  test('Voice transcription feedback', async () => {
    // Simulate receiving transcription
    chatActor.receive({
      type: 'voice_transcription',
      text: 'Hello world',
      language: 'en'
    });
    
    // Check feedback shown
    expect(chatView.elements.voiceIndicator.style.display).toBe('block');
    expect(chatView.elements.voiceIndicator.textContent).toContain('Hello world');
    
    // Wait for auto-hide
    await new Promise(resolve => setTimeout(resolve, 2100));
    expect(chatView.elements.voiceIndicator.style.display).toBe('none');
  });
});
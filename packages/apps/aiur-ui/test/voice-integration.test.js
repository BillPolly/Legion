/**
 * Voice Integration Test
 * 
 * Tests the complete voice flow from frontend to backend using real components
 * with a mock WebSocket for in-process communication.
 */

import { JSDOM } from 'jsdom';
import { jest } from '@jest/globals';
import { MockWebSocket } from './mocks/MockWebSocket.js';
import { FrontendActorSpace } from '../src/actors/FrontendActorSpace.js';
import { ServerActorSpace } from '../../../../aiur/src/server/ServerActorSpace.js';
import { ChatModel } from '../src/components/chat/model/ChatModel.js';
import { ChatView } from '../src/components/chat/view/ChatView.js';
import { ChatViewModel } from '../src/components/chat/viewmodel/ChatViewModel.js';
import { ModuleLoader } from '../../../../module-loader/src/ModuleLoader.js';
import { ResourceManager } from '../../../../module-loader/src/ResourceManager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up JSDOM environment
const dom = new JSDOM('<!DOCTYPE html><div id="chat-container"></div>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
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

// Mock MediaRecorder for voice recording
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
    // Simulate data available after a delay
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
    return mimeType.includes('webm') || mimeType.includes('opus');
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

describe('Voice Integration Tests', () => {
  let frontendActorSpace;
  let serverActorSpace;
  let chatModel;
  let chatView;
  let chatViewModel;
  let resourceManager;
  let moduleLoader;
  let clientSocket;
  let serverSocket;
  
  beforeAll(async () => {
    // Initialize ResourceManager and ModuleLoader for backend
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    moduleLoader = new ModuleLoader();
    await moduleLoader.initialize();
    
    // Load the real voice module
    const voiceModulePath = path.join(__dirname, '../../../../voice/module.json');
    await moduleLoader.loadModuleFromJson(voiceModulePath);
  });
  
  beforeEach(async () => {
    // Clear DOM
    document.getElementById('chat-container').innerHTML = '';
    
    // Create paired mock WebSockets
    [clientSocket, serverSocket] = MockWebSocket.createPair();
    
    // Override WebSocket constructor to return our mock
    global.WebSocket = jest.fn(() => clientSocket);
    
    // Initialize backend actor space
    serverActorSpace = new ServerActorSpace({
      resourceManager,
      moduleLoader
    });
    
    // Initialize frontend components
    const container = document.getElementById('chat-container');
    chatModel = new ChatModel();
    chatView = new ChatView(container);
    
    // Initialize frontend actor space
    frontendActorSpace = new FrontendActorSpace();
    
    // Connect frontend to "backend" via mock WebSocket
    await frontendActorSpace.connect('ws://localhost:8080');
    
    // Get the chat actor
    const chatActor = frontendActorSpace.getActor('chat');
    
    // Create view model
    chatViewModel = new ChatViewModel(chatModel, chatView, chatActor);
    
    // Set up backend to handle the mock connection
    serverActorSpace.handleConnection(serverSocket, 'test-client');
  });
  
  afterEach(() => {
    // Cleanup
    if (chatViewModel) {
      chatViewModel.destroy();
    }
    if (frontendActorSpace) {
      frontendActorSpace.disconnect();
    }
    if (serverActorSpace) {
      serverActorSpace.destroy();
    }
    
    jest.clearAllMocks();
  });
  
  test('Voice recording and transcription flow', async () => {
    // Mock the voice module's transcribe tool to return predictable result
    const transcribeTool = moduleLoader.getTool('transcribe_audio');
    const originalExecute = transcribeTool.execute;
    transcribeTool.execute = jest.fn().mockResolvedValue({
      text: 'Hello, this is a test message',
      language: 'en'
    });
    
    // Start voice recording
    await chatViewModel.startVoiceRecording();
    
    // Verify recording UI state
    expect(chatView.voiceState.isRecording).toBe(true);
    expect(chatView.elements.voiceIndicator.style.display).toBe('block');
    
    // Stop recording (triggers transcription)
    chatViewModel.stopVoiceRecording();
    
    // Wait for voice data to be sent
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check that voice_input message was sent
    const sentMessages = clientSocket.getSentMessages();
    const voiceInputMsg = sentMessages.find(msg => {
      const parsed = JSON.parse(msg);
      return parsed.payload?.type === 'voice_input';
    });
    
    expect(voiceInputMsg).toBeDefined();
    
    // Wait for transcription result
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify transcription was processed
    expect(transcribeTool.execute).toHaveBeenCalled();
    
    // Restore original execute
    transcribeTool.execute = originalExecute;
  });
  
  test('Text-to-speech generation flow', async () => {
    // Add a message to the chat
    const message = chatModel.addMessage('Test message for TTS', 'assistant');
    
    // Mock the voice module's generate_voice tool
    const generateVoiceTool = moduleLoader.getTool('generate_voice');
    const originalExecute = generateVoiceTool.execute;
    generateVoiceTool.execute = jest.fn().mockResolvedValue({
      audio: 'bW9jay1hdWRpby1kYXRh', // base64 mock audio
      format: 'mp3'
    });
    
    // Click the speaker button (request TTS)
    chatViewModel.playMessageAudio(message);
    
    // Wait for the request to be sent
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that generate_speech message was sent
    const sentMessages = clientSocket.getSentMessages();
    const generateSpeechMsg = sentMessages.find(msg => {
      const parsed = JSON.parse(msg);
      return parsed.payload?.type === 'generate_speech';
    });
    
    expect(generateSpeechMsg).toBeDefined();
    
    // Wait for audio generation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify TTS was called
    expect(generateVoiceTool.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Test message for TTS',
        voice: 'nova',
        format: 'mp3'
      })
    );
    
    // Restore original execute
    generateVoiceTool.execute = originalExecute;
  });
  
  test('Auto-play mode', async () => {
    // Mock the generate_voice tool
    const generateVoiceTool = moduleLoader.getTool('generate_voice');
    const originalExecute = generateVoiceTool.execute;
    generateVoiceTool.execute = jest.fn().mockResolvedValue({
      audio: 'bW9jay1hdWRpby1kYXRh',
      format: 'mp3'
    });
    
    // Enable auto-play mode
    chatViewModel.setVoiceAutoPlay(true);
    
    // Verify UI state
    expect(chatView.voiceState.autoPlayEnabled).toBe(true);
    expect(chatView.elements.voiceModeToggle.classList.contains('active')).toBe(true);
    
    // Send a user message
    await chatViewModel.sendMessage('Test question');
    
    // Simulate assistant response
    const assistantResponse = {
      type: 'chat_response',
      content: 'This is the assistant response',
      isComplete: true
    };
    
    // Send response through the mock socket
    serverSocket.send(JSON.stringify({
      targetGuid: frontendActorSpace.getActor('chat').guid,
      payload: assistantResponse
    }));
    
    // Wait for response processing and auto-play trigger
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Verify that speech generation was requested automatically
    const sentMessages = clientSocket.getSentMessages();
    const autoPlayRequest = sentMessages.find(msg => {
      const parsed = JSON.parse(msg);
      return parsed.payload?.type === 'generate_speech' && 
             parsed.payload?.text === 'This is the assistant response';
    });
    
    expect(autoPlayRequest).toBeDefined();
    
    // Restore original execute
    generateVoiceTool.execute = originalExecute;
  });
  
  test('Error handling - microphone permission denied', async () => {
    // Mock getUserMedia to reject
    navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(
      new Error('Permission denied')
    );
    
    // Try to start recording
    await chatViewModel.startVoiceRecording();
    
    // Verify error state
    expect(chatModel.error).toContain('Failed to start voice recording');
    expect(chatView.voiceState.isRecording).toBe(false);
  });
  
  test('Voice preferences synchronization', async () => {
    // Set voice preferences
    chatViewModel.chatActor.setVoicePreferences(true, 'echo');
    
    // Wait for message to be sent
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that preferences were sent to backend
    const sentMessages = clientSocket.getSentMessages();
    const prefsMsg = sentMessages.find(msg => {
      const parsed = JSON.parse(msg);
      return parsed.payload?.type === 'voice_preferences';
    });
    
    expect(prefsMsg).toBeDefined();
    const payload = JSON.parse(prefsMsg).payload;
    expect(payload.enabled).toBe(true);
    expect(payload.voice).toBe('echo');
  });
});

// Test utilities
export async function waitForCondition(condition, timeout = 5000) {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
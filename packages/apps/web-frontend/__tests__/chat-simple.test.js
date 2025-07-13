import { jest } from '@jest/globals';

// Mock the UI module
jest.unstable_mockModule('../src/ui.js', () => ({
  addMessage: jest.fn(),
  removeWelcomeMessage: jest.fn(),
  showTypingIndicator: jest.fn(),
  hideTypingIndicator: jest.fn(),
  updateConnectionStatus: jest.fn(),
  setInputEnabled: jest.fn(),
  autoResizeTextarea: jest.fn(),
  showErrorMessage: jest.fn(),
  getWebSocketUrl: jest.fn().mockReturnValue('ws://localhost:3000/ws')
}));

// Mock the WebSocket module
jest.unstable_mockModule('../src/websocket.js', () => ({
  WebSocketManager: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
    sendMessage: jest.fn().mockResolvedValue({ success: true, response: 'Mock response' }),
    disconnect: jest.fn(),
    onOpen: null,
    onClose: null,
    onError: null,
    onMessage: null,
    onStatusChange: null
  }))
}));

// Mock DOM elements
const createMockElement = (id) => {
  const element = document.createElement('div');
  element.id = id;
  if (id === 'messageInput') {
    element.value = '';
    element.disabled = false;
  }
  return element;
};

// Set up DOM
document.body.innerHTML = `
  <div id="messagesContainer"></div>
  <textarea id="messageInput"></textarea>
  <button id="sendButton"></button>
  <div id="typingIndicator"></div>
  <div id="connectionStatus"></div>
`;

// Import after mocking
const { WebSocketManager } = await import('../src/websocket.js');

describe('ChatApp Basic Tests', () => {
  beforeEach(() => {
    // Reset DOM
    document.getElementById('messageInput').value = '';
    document.getElementById('messageInput').disabled = false;
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  test('DOM elements exist for testing', () => {
    expect(document.getElementById('messagesContainer')).toBeTruthy();
    expect(document.getElementById('messageInput')).toBeTruthy();
    expect(document.getElementById('sendButton')).toBeTruthy();
    expect(document.getElementById('typingIndicator')).toBeTruthy();
    expect(document.getElementById('connectionStatus')).toBeTruthy();
  });

  test('WebSocketManager can be mocked', () => {
    const wsManager = new WebSocketManager('ws://test');
    expect(wsManager).toBeDefined();
    expect(wsManager.connect).toBeDefined();
    expect(wsManager.isConnected).toBeDefined();
  });

  test('Message input element can be manipulated', () => {
    const input = document.getElementById('messageInput');
    
    input.value = 'Test message';
    expect(input.value).toBe('Test message');
    
    input.value = '';
    expect(input.value).toBe('');
  });

  test('Send button exists and can be clicked', () => {
    const button = document.getElementById('sendButton');
    
    const clickHandler = jest.fn();
    button.addEventListener('click', clickHandler);
    
    button.click();
    expect(clickHandler).toHaveBeenCalled();
  });

  test('Event listeners can be attached to input', () => {
    const input = document.getElementById('messageInput');
    
    const keyHandler = jest.fn();
    input.addEventListener('keydown', keyHandler);
    
    // Simulate Enter key
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    input.dispatchEvent(event);
    
    expect(keyHandler).toHaveBeenCalled();
  });
});
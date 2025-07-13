import { jest } from '@jest/globals';
import { 
  formatTime, 
  getWebSocketUrl,
  createMessageElement,
  showTypingIndicator,
  hideTypingIndicator
} from '../src/ui.js';

describe('UI Utils Simple Tests', () => {
  test('formatTime works with Date object', () => {
    const date = new Date('2024-01-01T12:30:00');
    const result = formatTime(date);
    expect(result).toBe('12:30');
  });

  test('formatTime works with string date', () => {
    const result = formatTime('2024-01-01T15:45:00');
    expect(result).toBe('15:45');
  });

  test('getWebSocketUrl returns correct format', () => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        protocol: 'http:',
        host: 'localhost:3000'
      }
    });

    const result = getWebSocketUrl();
    expect(result).toBe('ws://localhost:3000/ws');
  });

  test('getWebSocketUrl uses wss for https', () => {
    Object.defineProperty(window, 'location', {
      value: {
        protocol: 'https:',
        host: 'example.com'
      }
    });

    const result = getWebSocketUrl();
    expect(result).toBe('wss://example.com/ws');
  });

  test('createMessageElement creates user message', () => {
    const element = createMessageElement('Hello', 'user');
    
    expect(element.className).toBe('message user');
    expect(element.querySelector('.message-avatar').textContent).toBe('👤');
    expect(element.querySelector('.message-bubble').textContent).toBe('Hello');
    expect(element.querySelector('.message-time')).toBeTruthy();
  });

  test('createMessageElement creates agent message', () => {
    const element = createMessageElement('Hi there', 'agent');
    
    expect(element.className).toBe('message agent');
    expect(element.querySelector('.message-avatar').textContent).toBe('🤖');
    expect(element.querySelector('.message-bubble').textContent).toBe('Hi there');
  });
});
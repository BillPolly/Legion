import { jest } from '@jest/globals';
import { 
  addMessage,
  removeWelcomeMessage,
  updateConnectionStatus,
  setInputEnabled,
  autoResizeTextarea,
  showErrorMessage
} from '../src/ui.js';

describe('UI DOM Manipulation Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('addMessage adds message to container', () => {
    const container = document.createElement('div');
    
    const messageEl = addMessage(container, 'Test message', 'user');
    
    expect(container.children.length).toBe(1);
    expect(messageEl.className).toBe('message user');
    expect(messageEl.querySelector('.message-bubble').textContent).toBe('Test message');
  });

  test('removeWelcomeMessage removes welcome element', () => {
    const container = document.createElement('div');
    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'welcome-message';
    welcomeMsg.textContent = 'Welcome!';
    container.appendChild(welcomeMsg);
    
    expect(container.children.length).toBe(1);
    
    removeWelcomeMessage(container);
    
    // Should start fade animation
    expect(welcomeMsg.style.animation).toBe('fadeOut 0.3s ease');
  });

  test('updateConnectionStatus updates status elements', () => {
    const statusElement = document.createElement('div');
    const indicator = document.createElement('div');
    indicator.className = 'status-indicator';
    const text = document.createElement('div');
    text.className = 'status-text';
    
    statusElement.appendChild(indicator);
    statusElement.appendChild(text);
    
    updateConnectionStatus(statusElement, 'connected');
    
    expect(indicator.classList.contains('connected')).toBe(true);
    expect(text.textContent).toBe('Connected');
  });

  test('updateConnectionStatus handles disconnected state', () => {
    const statusElement = document.createElement('div');
    const indicator = document.createElement('div');
    indicator.className = 'status-indicator';
    const text = document.createElement('div');
    text.className = 'status-text';
    
    statusElement.appendChild(indicator);
    statusElement.appendChild(text);
    
    updateConnectionStatus(statusElement, 'disconnected');
    
    expect(indicator.classList.contains('disconnected')).toBe(true);
    expect(text.textContent).toBe('Disconnected');
  });

  test('setInputEnabled enables input and button', () => {
    const input = document.createElement('input');
    const button = document.createElement('button');
    
    setInputEnabled(input, button, true);
    
    expect(input.disabled).toBe(false);
    expect(button.disabled).toBe(false);
  });

  test('setInputEnabled disables input and button', () => {
    const input = document.createElement('input');
    const button = document.createElement('button');
    
    setInputEnabled(input, button, false);
    
    expect(input.disabled).toBe(true);
    expect(button.disabled).toBe(true);
  });

  test('autoResizeTextarea adjusts height', () => {
    const textarea = document.createElement('textarea');
    Object.defineProperty(textarea, 'scrollHeight', {
      value: 80
    });
    
    autoResizeTextarea(textarea);
    
    expect(textarea.style.height).toBe('80px');
  });

  test('showErrorMessage adds error to container', () => {
    const container = document.createElement('div');
    
    const errorEl = showErrorMessage(container, 'Test error');
    
    expect(container.children.length).toBe(1);
    expect(errorEl.className).toBe('message agent');
    expect(errorEl.querySelector('.message-bubble').textContent).toContain('Test error');
  });
});
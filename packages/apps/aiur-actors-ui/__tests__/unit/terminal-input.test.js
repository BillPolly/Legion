/**
 * Test for terminal input functionality
 */
import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { TerminalView } from '../../src/components/terminal/TerminalView.js';
import { TerminalViewModel } from '../../src/components/terminal/TerminalViewModel.js';
import { TerminalModel } from '../../src/models/TerminalModel.js';

describe('Terminal Input Tests', () => {
  let dom;
  let document;
  let container;
  let model;
  let view;
  let viewModel;

  beforeEach(() => {
    // Setup DOM
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="terminal"></div></body></html>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    
    container = document.getElementById('terminal');
    
    // Create components
    model = new TerminalModel();
    view = new TerminalView(container);
    viewModel = new TerminalViewModel(model, view, null);
    
    // Render the view
    view.render({ prompt: '> ' });
    
    // Initialize viewModel
    viewModel.initialize();
  });

  afterEach(() => {
    // Cleanup
    view.destroy();
    delete global.document;
    delete global.window;
  });

  test('should render input element correctly', () => {
    // Check that input element exists
    const inputElement = container.querySelector('input.terminal-input');
    expect(inputElement).toBeTruthy();
    expect(inputElement.type).toBe('text');
    expect(inputElement.getAttribute('autocomplete')).toBe('off');
    expect(inputElement.getAttribute('spellcheck')).toBe('false');
  });

  test('should handle text input', () => {
    const inputElement = container.querySelector('input.terminal-input');
    
    // Simulate typing
    inputElement.value = 'test command';
    const inputEvent = new dom.window.Event('input', { bubbles: true });
    inputElement.dispatchEvent(inputEvent);
    
    // Check that model was updated
    expect(model.currentCommand).toBe('test command');
  });

  test('should handle Enter key', () => {
    const inputElement = container.querySelector('input.terminal-input');
    
    // Type a command
    inputElement.value = 'test command';
    const inputEvent = new dom.window.Event('input', { bubbles: true });
    inputElement.dispatchEvent(inputEvent);
    
    // Press Enter
    const enterEvent = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true
    });
    inputElement.dispatchEvent(enterEvent);
    
    // Check that command was added to history
    expect(model.commandHistory).toContain('test command');
    
    // Check that input was cleared
    expect(inputElement.value).toBe('');
    expect(model.currentCommand).toBe('');
  });

  test('should navigate history with arrow keys', () => {
    const inputElement = container.querySelector('input.terminal-input');
    
    // Add some commands to history
    model.addCommand('command1');
    model.addCommand('command2');
    model.addCommand('command3');
    
    // Press up arrow
    const upEvent = new dom.window.KeyboardEvent('keydown', {
      key: 'ArrowUp',
      bubbles: true
    });
    inputElement.dispatchEvent(upEvent);
    
    // Should show last command
    expect(inputElement.value).toBe('command3');
    
    // Press up again
    inputElement.dispatchEvent(upEvent);
    expect(inputElement.value).toBe('command2');
    
    // Press down arrow
    const downEvent = new dom.window.KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true
    });
    inputElement.dispatchEvent(downEvent);
    expect(inputElement.value).toBe('command3');
  });

  test('should handle Escape key', () => {
    const inputElement = container.querySelector('input.terminal-input');
    
    // Type something
    inputElement.value = 'partial command';
    const inputEvent = new dom.window.Event('input', { bubbles: true });
    inputElement.dispatchEvent(inputEvent);
    
    // Press Escape
    const escapeEvent = new dom.window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true
    });
    inputElement.dispatchEvent(escapeEvent);
    
    // Input should be cleared
    expect(inputElement.value).toBe('');
    expect(model.currentCommand).toBe('');
  });

  test('should focus input when clicking terminal', () => {
    const inputElement = container.querySelector('input.terminal-input');
    const terminal = container.querySelector('.terminal');
    
    // Mock focus method
    inputElement.focus = jest.fn();
    
    // Click on terminal
    const clickEvent = new dom.window.MouseEvent('click', { bubbles: true });
    terminal.dispatchEvent(clickEvent);
    
    // Input should be focused
    expect(inputElement.focus).toHaveBeenCalled();
  });

  test('should handle paste event', () => {
    const inputElement = container.querySelector('input.terminal-input');
    
    // Create paste event with multi-line text
    const pasteEvent = new dom.window.ClipboardEvent('paste', {
      clipboardData: new dom.window.DataTransfer(),
      bubbles: true
    });
    
    // Add text to clipboard data
    Object.defineProperty(pasteEvent.clipboardData, 'getData', {
      value: jest.fn().mockReturnValue('line1\nline2\nline3')
    });
    
    // Current position
    inputElement.value = 'before ';
    model.setCurrentCommand('before ');
    
    // Dispatch paste
    inputElement.dispatchEvent(pasteEvent);
    
    // Should only paste first line
    expect(model.currentCommand).toContain('line1');
    expect(model.currentCommand).not.toContain('line2');
  });

  test('should display prompt correctly', () => {
    const promptElement = container.querySelector('.terminal-prompt');
    expect(promptElement).toBeTruthy();
    expect(promptElement.textContent).toBe('> ');
  });

  test('should disable input during execution', () => {
    const inputElement = container.querySelector('input.terminal-input');
    
    // Set executing state
    viewModel.model.setExecuting(true);
    
    // Input should be disabled
    expect(inputElement.disabled).toBe(true);
    
    // Clear executing state
    viewModel.model.setExecuting(false);
    
    // Input should be enabled
    expect(inputElement.disabled).toBe(false);
  });
});
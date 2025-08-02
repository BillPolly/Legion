/**
 * Test to verify .help command doesn't cause input jumping
 * This tests the specific bug reported by the user
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('.help Command Input Bug Test', () => {
  let dom;
  let document;
  let container;
  let TerminalView;
  let view;

  beforeEach(async () => {
    // Dynamic imports
    ({ TerminalView } = await import('../../src/components/terminal/TerminalView.js'));
    
    // Setup JSDOM
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .terminal { display: flex; flex-direction: column; height: 100%; }
            .terminal-output-container { flex: 1; overflow: hidden; }
            .terminal-input-container { flex: 0 0 auto; }
          </style>
        </head>
        <body>
          <div id="terminal-container"></div>
        </body>
      </html>
    `, {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.MutationObserver = dom.window.MutationObserver;
    
    container = document.getElementById('terminal-container');
    
    // Create view
    view = new TerminalView(container);
  });

  afterEach(() => {
    if (view) {
      view.destroy();
    }
  });

  test('input element should not jump or be recreated when typing .help', async () => {
    // Initialize view
    view.render();
    
    // Get initial input element and its position
    const initialInput = container.querySelector('.terminal-input');
    expect(initialInput).toBeTruthy();
    
    // Store the input element's identity
    const inputId = 'test-input-' + Date.now();
    initialInput.id = inputId;
    
    // Get the input container's initial parent
    const inputContainer = container.querySelector('.terminal-input-container');
    expect(inputContainer).toBeTruthy();
    const initialParent = inputContainer.parentElement;
    
    // Set up input handler
    view.onInput = jest.fn((value, event) => {
      // After each input, verify DOM hasn't been recreated
      const currentInput = document.getElementById(inputId);
      expect(currentInput).toBe(initialInput); // Same reference!
    });
    
    // Type ".help" character by character
    const helpCommand = '.help';
    for (let i = 0; i < helpCommand.length; i++) {
      const char = helpCommand[i];
      
      // Type character
      initialInput.value += char;
      const event = new dom.window.Event('input', { bubbles: true });
      initialInput.dispatchEvent(event);
      
      // After each character, verify:
      // 1. Input element is the same element (not recreated)
      const currentInput = document.getElementById(inputId);
      expect(currentInput).toBe(initialInput);
      expect(currentInput).toBeTruthy();
      
      // 2. Input is still in the input container
      expect(currentInput.closest('.terminal-input-container')).toBeTruthy();
      
      // 3. Input container is still at the bottom of terminal
      const currentInputContainer = container.querySelector('.terminal-input-container');
      expect(currentInputContainer).toBe(inputContainer);
      expect(currentInputContainer.parentElement).toBe(initialParent);
      
      // 4. No duplicate inputs exist
      const allInputs = container.querySelectorAll('.terminal-input');
      expect(allInputs.length).toBe(1);
      
      // 5. Value is preserved
      expect(currentInput.value).toBe(helpCommand.substring(0, i + 1));
    }
    
    // Verify input handler was called correctly
    expect(view.onInput).toHaveBeenCalled();
  });

  test('DOM elements should persist across multiple operations', async () => {
    view.render();
    
    // Track DOM mutations
    const mutations = [];
    const observer = new dom.window.MutationObserver((mutationsList) => {
      mutations.push(...mutationsList);
    });
    
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    // Get initial elements
    const outputContainer = container.querySelector('.terminal-output-container');
    const inputContainer = container.querySelector('.terminal-input-container');
    const inputElement = container.querySelector('.terminal-input');
    
    // Mark elements for tracking
    outputContainer.id = 'output-test';
    inputContainer.id = 'input-container-test';
    inputElement.id = 'input-test';
    
    // Perform multiple operations
    const operations = [
      () => view.appendOutput({ content: 'Test line 1', type: 'info' }),
      () => view.setPrompt('$ '),
      () => view.setCurrentInput('.help'),
      () => view.clearInput(),
      () => view.appendOutput({ content: 'Test line 2', type: 'result' }),
      () => view.setExecuting(true),
      () => view.setExecuting(false),
      () => view.updateConnectionStatus(false),
      () => view.updateConnectionStatus(true)
    ];
    
    for (const operation of operations) {
      operation();
      
      // Verify elements still exist with same identity
      expect(document.getElementById('output-test')).toBe(outputContainer);
      expect(document.getElementById('input-container-test')).toBe(inputContainer);
      expect(document.getElementById('input-test')).toBe(inputElement);
    }
    
    // Stop observing
    observer.disconnect();
    
    // Check that no major DOM reconstructions happened
    const majorReconstructions = mutations.filter(m => {
      if (m.type === 'childList') {
        // Check if input or output containers were removed/added
        for (const node of m.removedNodes) {
          if (node.id === 'output-test' || 
              node.id === 'input-container-test' || 
              node.id === 'input-test') {
            return true;
          }
        }
      }
      return false;
    });
    
    expect(majorReconstructions.length).toBe(0);
  });

  test('input focus should be maintained during updates', async () => {
    view.render();
    
    const inputElement = container.querySelector('.terminal-input');
    
    // Focus the input
    inputElement.focus();
    expect(document.activeElement).toBe(inputElement);
    
    // Type something
    inputElement.value = '.hel';
    inputElement.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    
    // Verify focus is maintained
    expect(document.activeElement).toBe(inputElement);
    
    // Add output (simulating server response)
    view.appendOutput({ content: 'Server response', type: 'info' });
    
    // Focus should still be on input
    expect(document.activeElement).toBe(inputElement);
    
    // Continue typing
    inputElement.value = '.help';
    inputElement.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    
    // Focus should still be maintained
    expect(document.activeElement).toBe(inputElement);
  });

  test('multiple render calls should not recreate DOM', async () => {
    // First render
    view.render();
    
    const firstInput = container.querySelector('.terminal-input');
    const firstOutput = container.querySelector('.terminal-output');
    const firstInputContainer = container.querySelector('.terminal-input-container');
    
    // Mark elements
    firstInput.id = 'first-input';
    firstOutput.id = 'first-output';
    firstInputContainer.id = 'first-container';
    
    // Call render multiple times (this was causing the bug)
    view.render();
    view.render({ theme: 'dark' });
    view.render({ prompt: '$ ' });
    
    // Elements should be the same references
    expect(document.getElementById('first-input')).toBe(firstInput);
    expect(document.getElementById('first-output')).toBe(firstOutput);
    expect(document.getElementById('first-container')).toBe(firstInputContainer);
    
    // Should still only have one of each element
    expect(container.querySelectorAll('.terminal-input').length).toBe(1);
    expect(container.querySelectorAll('.terminal-output').length).toBe(1);
    expect(container.querySelectorAll('.terminal-input-container').length).toBe(1);
  });

  test('clearing output should not affect input position', async () => {
    view.render();
    
    const inputElement = container.querySelector('.terminal-input');
    const inputContainer = container.querySelector('.terminal-input-container');
    
    // Add tracking
    inputElement.id = 'clear-test-input';
    
    // Add some output
    view.appendOutput({ content: 'Line 1', type: 'info' });
    view.appendOutput({ content: 'Line 2', type: 'info' });
    view.appendOutput({ content: 'Line 3', type: 'info' });
    
    // Input should still be at bottom
    expect(document.getElementById('clear-test-input')).toBe(inputElement);
    expect(inputElement.closest('.terminal-input-container')).toBe(inputContainer);
    
    // Clear output (this could cause issues if using innerHTML)
    view.clearOutput();
    
    // Input should STILL be at bottom and same element
    expect(document.getElementById('clear-test-input')).toBe(inputElement);
    expect(inputElement.closest('.terminal-input-container')).toBe(inputContainer);
    
    // Should be able to type after clearing
    inputElement.value = 'test after clear';
    expect(inputElement.value).toBe('test after clear');
  });
});
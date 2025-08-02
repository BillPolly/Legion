/**
 * Test for parameter coordination fix in TerminalView
 * Verifies that values are correctly passed through event handlers
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('TerminalView Parameter Coordination', () => {
  let TerminalView;
  let TerminalInputView;
  let view;
  let container;
  
  beforeEach(async () => {
    ({ TerminalView } = await import('../../../../src/components/terminal/TerminalView.js'));
    ({ TerminalInputView } = await import('../../../../src/components/terminal/subcomponents/TerminalInputView.js'));
    
    // Create container
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create view
    view = new TerminalView(container);
  });
  
  afterEach(() => {
    if (view) {
      view.destroy();
    }
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('Parameter Passing Through Layers', () => {
    test('should pass both value and event from inputView.onInput to view.onInput', () => {
      // Render the view to initialize subcomponents
      view.render();
      
      // Create mock handler to verify parameters
      const mockOnInput = jest.fn();
      view.onInput = mockOnInput;
      
      // Simulate input from TerminalInputView
      const testValue = 'test input value';
      const mockEvent = { 
        target: { value: testValue },
        type: 'input'
      };
      
      // Trigger the callback chain
      view.inputView.onInput(testValue, mockEvent);
      
      // Verify the handler was called with BOTH parameters
      expect(mockOnInput).toHaveBeenCalledTimes(1);
      expect(mockOnInput).toHaveBeenCalledWith(testValue, mockEvent);
      
      // Verify first parameter is the value, not the event
      const firstArg = mockOnInput.mock.calls[0][0];
      expect(firstArg).toBe(testValue);
      expect(typeof firstArg).toBe('string');
    });

    test('should pass both key and event from inputView.onKeyDown to view.onKeyDown', () => {
      // Render the view to initialize subcomponents
      view.render();
      
      // Create mock handler to verify parameters
      const mockOnKeyDown = jest.fn();
      view.onKeyDown = mockOnKeyDown;
      
      // Simulate key press from TerminalInputView
      const testKey = 'Enter';
      const mockEvent = { 
        key: testKey,
        type: 'keydown',
        preventDefault: jest.fn()
      };
      
      // Trigger the callback chain
      view.inputView.onKeyDown(testKey, mockEvent);
      
      // Verify the handler was called with BOTH parameters
      expect(mockOnKeyDown).toHaveBeenCalledTimes(1);
      expect(mockOnKeyDown).toHaveBeenCalledWith(testKey, mockEvent);
      
      // Verify first parameter is the key, not the event
      const firstArg = mockOnKeyDown.mock.calls[0][0];
      expect(firstArg).toBe(testKey);
      expect(typeof firstArg).toBe('string');
    });

    test('should NOT have [object InputEvent] bug', () => {
      // Render the view to initialize subcomponents
      view.render();
      
      // Track what values are passed
      let receivedValue = null;
      view.onInput = (value, event) => {
        receivedValue = value;
      };
      
      // Simulate input with an event that would trigger the bug
      const testValue = 'correct value';
      const mockEvent = {
        target: { value: testValue },
        toString: () => '[object InputEvent]' // This would be the bug if passed as value
      };
      
      // Trigger the callback
      view.inputView.onInput(testValue, mockEvent);
      
      // Verify we got the correct value, not the event toString
      expect(receivedValue).toBe(testValue);
      expect(receivedValue).not.toContain('[object');
      expect(receivedValue).not.toBe(mockEvent);
    });

    test('should handle command callback correctly', () => {
      view.render();
      
      const mockOnCommand = jest.fn();
      view.onCommand = mockOnCommand;
      
      const testCommand = 'test command';
      view.inputView.onCommand(testCommand);
      
      expect(mockOnCommand).toHaveBeenCalledTimes(1);
      expect(mockOnCommand).toHaveBeenCalledWith(testCommand);
    });

    test('should handle autocomplete callback correctly', () => {
      view.render();
      
      const mockOnAutocomplete = jest.fn();
      view.onAutocomplete = mockOnAutocomplete;
      
      const testPartial = 'test';
      view.inputView.onAutocomplete(testPartial);
      
      expect(mockOnAutocomplete).toHaveBeenCalledTimes(1);
      expect(mockOnAutocomplete).toHaveBeenCalledWith(testPartial);
    });
  });

  describe('Integration with Real Input Events', () => {
    test('should extract value from actual input events', () => {
      view.render();
      
      let capturedValue = null;
      view.onInput = (value) => {
        capturedValue = value;
      };
      
      // Get the actual input element
      const inputElement = container.querySelector('.terminal-input');
      expect(inputElement).toBeTruthy();
      
      // Set value and trigger input event
      inputElement.textContent = 'typed text';
      const inputEvent = new Event('input', { bubbles: true });
      inputElement.dispatchEvent(inputEvent);
      
      // Verify the value was extracted correctly
      expect(capturedValue).toBe('typed text');
      expect(typeof capturedValue).toBe('string');
    });

    test('should handle keyboard events with correct key extraction', () => {
      view.render();
      
      let capturedKey = null;
      view.onKeyDown = (key) => {
        capturedKey = key;
      };
      
      // Get the actual input element
      const inputElement = container.querySelector('.terminal-input');
      expect(inputElement).toBeTruthy();
      
      // Trigger keydown event
      const keyEvent = new KeyboardEvent('keydown', { 
        key: 'Enter',
        bubbles: true 
      });
      inputElement.dispatchEvent(keyEvent);
      
      // Verify the key was extracted correctly
      expect(capturedKey).toBe('Enter');
      expect(typeof capturedKey).toBe('string');
    });
  });

  describe('Coordination Bug Prevention', () => {
    test('should maintain parameter order through multiple layers', () => {
      view.render();
      
      // Create a chain of handlers to verify parameter order
      const handler1 = jest.fn((value, event) => {
        expect(value).toBe('test');
        expect(event).toHaveProperty('type', 'input');
      });
      
      const handler2 = jest.fn((value, event) => {
        handler1(value, event);
      });
      
      view.onInput = handler2;
      
      // Trigger the chain
      view.inputView.onInput('test', { type: 'input' });
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    test('should not lose data when event is undefined', () => {
      view.render();
      
      const mockHandler = jest.fn();
      view.onInput = mockHandler;
      
      // Some scenarios might pass undefined event
      view.inputView.onInput('value without event', undefined);
      
      expect(mockHandler).toHaveBeenCalledWith('value without event', undefined);
      expect(mockHandler.mock.calls[0][0]).toBe('value without event');
    });

    test('should handle empty values correctly', () => {
      view.render();
      
      const mockHandler = jest.fn();
      view.onInput = mockHandler;
      
      // Empty string should still be passed correctly
      view.inputView.onInput('', { type: 'input' });
      
      expect(mockHandler).toHaveBeenCalledWith('', { type: 'input' });
      expect(mockHandler.mock.calls[0][0]).toBe('');
      expect(mockHandler.mock.calls[0][0]).not.toBe(undefined);
      expect(mockHandler.mock.calls[0][0]).not.toBe(null);
    });
  });
});
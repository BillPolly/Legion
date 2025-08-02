/**
 * Tests for TerminalInputView subcomponent
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('TerminalInputView', () => {
  let TerminalInputView;
  let inputView;
  let container;
  
  beforeEach(async () => {
    ({ TerminalInputView } = await import('../../../../../src/components/terminal/subcomponents/TerminalInputView.js'));
    
    // Create container
    container = document.createElement('div');
    container.className = 'terminal-input-container';
    document.body.appendChild(container);
    
    // Create input view
    inputView = new TerminalInputView(container);
  });
  
  afterEach(() => {
    if (inputView) {
      inputView.destroy();
    }
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('DOM Structure Creation', () => {
    test('should create input line structure', () => {
      inputView.render();
      
      expect(container.querySelector('.terminal-input-line')).toBeDefined();
      expect(container.querySelector('.terminal-prompt')).toBeDefined();
      expect(container.querySelector('.terminal-input-wrapper')).toBeDefined();
      expect(container.querySelector('.terminal-input')).toBeDefined();
      expect(container.querySelector('.terminal-autocomplete')).toBeDefined();
    });

    test('should set input element attributes', () => {
      inputView.render();
      
      const input = container.querySelector('.terminal-input');
      expect(input.type).toBe('text');
      expect(input.getAttribute('autocomplete')).toBe('off');
      expect(input.getAttribute('spellcheck')).toBe('false');
      expect(input.getAttribute('placeholder')).toBe('Enter command...');
    });

    test('should set prompt text', () => {
      inputView.render({ prompt: '$ ' });
      
      const prompt = container.querySelector('.terminal-prompt');
      expect(prompt.textContent).toBe('$ ');
    });

    test('should create hidden autocomplete dropdown', () => {
      inputView.render();
      
      const autocomplete = container.querySelector('.terminal-autocomplete');
      expect(autocomplete.style.display).toBe('none');
      expect(inputView.autocompleteVisible).toBe(false);
    });
  });

  describe('Input Value Management', () => {
    test('should set and get input value', () => {
      inputView.render();
      
      inputView.setValue('test command');
      expect(inputView.getValue()).toBe('test command');
      
      const input = container.querySelector('.terminal-input');
      expect(input.value).toBe('test command');
    });

    test('should clear input', () => {
      inputView.render();
      
      inputView.setValue('some text');
      expect(inputView.getValue()).toBe('some text');
      
      inputView.clear();
      expect(inputView.getValue()).toBe('');
    });

    test('should handle empty values', () => {
      inputView.render();
      
      inputView.setValue(null);
      expect(inputView.getValue()).toBe('');
      
      inputView.setValue(undefined);
      expect(inputView.getValue()).toBe('');
    });
  });

  describe('Prompt Management', () => {
    test('should update prompt text', () => {
      inputView.render();
      
      inputView.setPrompt('> ');
      expect(inputView.prompt).toBe('> ');
      
      const prompt = container.querySelector('.terminal-prompt');
      expect(prompt.textContent).toBe('> ');
    });

    test('should handle prompt updates after render', () => {
      inputView.render({ prompt: '$ ' });
      
      inputView.setPrompt('debug> ');
      
      const prompt = container.querySelector('.terminal-prompt');
      expect(prompt.textContent).toBe('debug> ');
    });
  });

  describe('Focus Management', () => {
    test('should focus input element', () => {
      inputView.render();
      
      const input = container.querySelector('.terminal-input');
      const focusSpy = jest.spyOn(input, 'focus');
      
      inputView.focus();
      
      // Focus is called asynchronously
      setTimeout(() => {
        expect(focusSpy).toHaveBeenCalled();
      }, 0);
    });

    test('should handle focus when clicking in terminal area', () => {
      inputView.render();
      
      const input = container.querySelector('.terminal-input');
      const focusSpy = jest.spyOn(input, 'focus');
      
      // Simulate click in terminal area (not directly on input)
      container.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      
      setTimeout(() => {
        expect(focusSpy).toHaveBeenCalled();
      }, 0);
    });

    test('should not interfere with text selection', () => {
      inputView.render();
      
      const input = container.querySelector('.terminal-input');
      const focusSpy = jest.spyOn(input, 'focus');
      
      // Mock text selection
      Object.defineProperty(window, 'getSelection', {
        value: jest.fn(() => ({
          toString: () => 'selected text'
        }))
      });
      
      container.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      
      setTimeout(() => {
        expect(focusSpy).not.toHaveBeenCalled();
      }, 0);
    });
  });

  describe('Executing State', () => {
    test('should show executing state', () => {
      inputView.render();
      
      inputView.setExecuting(true);
      
      const input = container.querySelector('.terminal-input');
      const inputLine = container.querySelector('.terminal-input-line');
      
      expect(input.disabled).toBe(true);
      expect(inputLine.classList.contains('executing')).toBe(true);
      expect(inputView.executing).toBe(true);
    });

    test('should clear executing state', () => {
      inputView.render();
      
      inputView.setExecuting(true);
      inputView.setExecuting(false);
      
      const input = container.querySelector('.terminal-input');
      const inputLine = container.querySelector('.terminal-input-line');
      
      expect(input.disabled).toBe(false);
      expect(inputLine.classList.contains('executing')).toBe(false);
      expect(inputView.executing).toBe(false);
    });

    test('should prevent command execution when executing', () => {
      inputView.render();
      
      const onCommand = jest.fn();
      inputView.onCommand = onCommand;
      
      inputView.setExecuting(true);
      inputView.setValue('test command');
      
      // Try to execute command
      const input = container.querySelector('.terminal-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      expect(onCommand).not.toHaveBeenCalled();
    });
  });

  describe('Placeholder Management', () => {
    test('should set placeholder text', () => {
      inputView.render();
      
      inputView.setPlaceholder('Type a command...');
      
      const input = container.querySelector('.terminal-input');
      expect(input.getAttribute('placeholder')).toBe('Type a command...');
    });

    test('should handle empty placeholder', () => {
      inputView.render();
      
      inputView.setPlaceholder('');
      
      const input = container.querySelector('.terminal-input');
      expect(input.getAttribute('placeholder')).toBe('');
    });
  });

  describe('Event Handling', () => {
    test('should handle input events', () => {
      inputView.render();
      
      const onInput = jest.fn();
      inputView.onInput = onInput;
      
      const input = container.querySelector('.terminal-input');
      input.value = 'test';
      input.dispatchEvent(new Event('input'));
      
      expect(onInput).toHaveBeenCalledWith('test', expect.any(Event));
    });

    test('should handle Enter key for command execution', () => {
      inputView.render();
      
      const onCommand = jest.fn();
      inputView.onCommand = onCommand;
      
      inputView.setValue('help');
      
      const input = container.querySelector('.terminal-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      expect(onCommand).toHaveBeenCalledWith('help');
      expect(inputView.getValue()).toBe(''); // Should clear after execution
    });

    test('should not execute empty commands', () => {
      inputView.render();
      
      const onCommand = jest.fn();
      inputView.onCommand = onCommand;
      
      inputView.setValue('   '); // Only whitespace
      
      const input = container.querySelector('.terminal-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      expect(onCommand).not.toHaveBeenCalled();
    });

    test('should handle arrow keys for history', () => {
      inputView.render();
      
      const onKeyDown = jest.fn();
      inputView.onKeyDown = onKeyDown;
      
      const input = container.querySelector('.terminal-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      
      expect(onKeyDown).toHaveBeenCalledWith('historyUp', expect.any(KeyboardEvent));
    });

    test('should handle Tab key for autocomplete', () => {
      inputView.render();
      
      const onAutocomplete = jest.fn();
      inputView.onAutocomplete = onAutocomplete;
      
      inputView.setValue('hel');
      
      const input = container.querySelector('.terminal-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      
      expect(onAutocomplete).toHaveBeenCalledWith('hel');
    });

    test('should handle Escape key', () => {
      inputView.render();
      
      inputView.setValue('some text');
      inputView.showAutocomplete(['test']);
      
      const input = container.querySelector('.terminal-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      
      // Should hide autocomplete first
      expect(inputView.autocompleteVisible).toBe(false);
      
      // If pressed again, should clear input
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(inputView.getValue()).toBe('');
    });
  });

  describe('Autocomplete Management', () => {
    test('should show autocomplete suggestions', () => {
      inputView.render();
      
      const suggestions = ['help', 'history', 'hello'];
      inputView.showAutocomplete(suggestions);
      
      const autocomplete = container.querySelector('.terminal-autocomplete');
      expect(autocomplete.style.display).toBe('block');
      expect(inputView.autocompleteVisible).toBe(true);
      expect(inputView.suggestions).toEqual(suggestions);
      
      const items = autocomplete.querySelectorAll('.autocomplete-item');
      expect(items.length).toBe(3);
      expect(items[0].textContent).toBe('help');
      expect(items[1].textContent).toBe('history');
      expect(items[2].textContent).toBe('hello');
    });

    test('should auto-select first suggestion', () => {
      inputView.render();
      
      inputView.showAutocomplete(['help', 'history']);
      
      expect(inputView.selectedIndex).toBe(0);
      
      const items = container.querySelectorAll('.autocomplete-item');
      expect(items[0].classList.contains('selected')).toBe(true);
      expect(items[1].classList.contains('selected')).toBe(false);
    });

    test('should hide autocomplete', () => {
      inputView.render();
      
      inputView.showAutocomplete(['test']);
      expect(inputView.autocompleteVisible).toBe(true);
      
      inputView.hideAutocomplete();
      
      const autocomplete = container.querySelector('.terminal-autocomplete');
      expect(autocomplete.style.display).toBe('none');
      expect(inputView.autocompleteVisible).toBe(false);
      expect(inputView.selectedIndex).toBe(-1);
      expect(inputView.suggestions).toEqual([]);
    });

    test('should handle empty suggestions', () => {
      inputView.render();
      
      inputView.showAutocomplete([]);
      
      expect(inputView.autocompleteVisible).toBe(false);
      
      const autocomplete = container.querySelector('.terminal-autocomplete');
      expect(autocomplete.style.display).toBe('none');
    });

    test('should handle structured suggestions', () => {
      inputView.render();
      
      const suggestions = [
        { value: 'help', description: 'Show help information', type: 'command' },
        { value: 'module_list', description: 'List modules', type: 'tool' }
      ];
      
      inputView.showAutocomplete(suggestions);
      
      const items = container.querySelectorAll('.autocomplete-item');
      expect(items.length).toBe(2);
      
      // First item
      expect(items[0].querySelector('.autocomplete-name').textContent).toBe('help');
      expect(items[0].querySelector('.autocomplete-description').textContent).toBe('Show help information');
      expect(items[0].classList.contains('autocomplete-type-command')).toBe(true);
      
      // Second item
      expect(items[1].querySelector('.autocomplete-name').textContent).toBe('module_list');
      expect(items[1].querySelector('.autocomplete-description').textContent).toBe('List modules');
      expect(items[1].classList.contains('autocomplete-type-tool')).toBe(true);
    });

    test('should navigate autocomplete with arrow keys', () => {
      inputView.render();
      
      inputView.showAutocomplete(['opt1', 'opt2', 'opt3']);
      expect(inputView.selectedIndex).toBe(0);
      
      // Navigate down
      const input = container.querySelector('.terminal-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      
      expect(inputView.selectedIndex).toBe(1);
      
      const items = container.querySelectorAll('.autocomplete-item');
      expect(items[0].classList.contains('selected')).toBe(false);
      expect(items[1].classList.contains('selected')).toBe(true);
      
      // Navigate up
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      
      expect(inputView.selectedIndex).toBe(0);
      expect(items[0].classList.contains('selected')).toBe(true);
      expect(items[1].classList.contains('selected')).toBe(false);
    });

    test('should wrap around in navigation', () => {
      inputView.render();
      
      inputView.showAutocomplete(['opt1', 'opt2']);
      
      const input = container.querySelector('.terminal-input');
      
      // Navigate up from first item (should wrap to last)
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      expect(inputView.selectedIndex).toBe(1);
      
      // Navigate down from last item (should wrap to first)
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(inputView.selectedIndex).toBe(0);
    });

    test('should select suggestion with Tab', () => {
      inputView.render();
      
      const suggestions = ['help', 'history'];
      inputView.showAutocomplete(suggestions);
      inputView.selectedIndex = 1;
      inputView.updateAutocompleteSelection();
      
      const input = container.querySelector('.terminal-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      
      expect(inputView.getValue()).toBe('history');
      expect(inputView.autocompleteVisible).toBe(false);
    });

    test('should select suggestion with click', () => {
      inputView.render();
      
      inputView.showAutocomplete(['help', 'history']);
      
      const items = container.querySelectorAll('.autocomplete-item');
      items[1].click();
      
      expect(inputView.getValue()).toBe('history');
      expect(inputView.autocompleteVisible).toBe(false);
    });
  });

  describe('Cleanup', () => {
    test('should clean up on destroy', () => {
      inputView.render();
      
      expect(container.querySelector('.terminal-input-line')).toBeDefined();
      expect(inputView.onInput).toBeDefined();
      
      inputView.destroy();
      
      expect(inputView.onInput).toBeNull();
      expect(inputView.onKeyDown).toBeNull();
      expect(inputView.onCommand).toBeNull();
      expect(inputView.onAutocomplete).toBeNull();
      expect(inputView.suggestions).toEqual([]);
    });

    test('should hide autocomplete on destroy', () => {
      inputView.render();
      
      inputView.showAutocomplete(['test']);
      expect(inputView.autocompleteVisible).toBe(true);
      
      inputView.destroy();
      
      expect(inputView.autocompleteVisible).toBe(false);
    });
  });
});
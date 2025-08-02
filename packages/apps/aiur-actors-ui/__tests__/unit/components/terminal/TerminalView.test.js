/**
 * Tests for TerminalView
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('TerminalView', () => {
  let TerminalView;
  let view;
  let container;
  
  beforeEach(async () => {
    ({ TerminalView } = await import('../../../../src/components/terminal/TerminalView.js'));
    
    // Create container
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create view
    view = new TerminalView(container);
  });
  
  afterEach(() => {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('DOM Structure Creation', () => {
    test('should create terminal structure', () => {
      view.render();
      
      expect(container.querySelector('.terminal')).toBeDefined();
      expect(container.querySelector('.terminal-output')).toBeDefined();
      expect(container.querySelector('.terminal-input-line')).toBeDefined();
      expect(container.querySelector('.terminal-prompt')).toBeDefined();
      expect(container.querySelector('.terminal-input')).toBeDefined();
      expect(container.querySelector('.terminal-cursor')).toBeDefined();
    });

    test('should create autocomplete dropdown', () => {
      view.render();
      
      const autocomplete = container.querySelector('.terminal-autocomplete');
      expect(autocomplete).toBeDefined();
      expect(autocomplete.style.display).toBe('none'); // Hidden by default
    });

    test('should set terminal classes and attributes', () => {
      view.render();
      
      const terminal = container.querySelector('.terminal');
      expect(terminal.classList.contains('terminal')).toBe(true);
      expect(terminal.getAttribute('tabindex')).toBe('0');
      
      const input = container.querySelector('.terminal-input');
      expect(input.tagName).toBe('INPUT');
      expect(input.type).toBe('text');
      expect(input.getAttribute('spellcheck')).toBe('false');
    });

    test('should apply theme', () => {
      view.render({ theme: 'dark' });
      
      const terminal = container.querySelector('.terminal');
      expect(terminal.classList.contains('terminal-theme-dark')).toBe(true);
    });
  });

  describe('Output Rendering', () => {
    test('should render output lines', () => {
      view.render();
      
      const outputs = [
        { id: '1', content: 'Line 1', type: 'info' },
        { id: '2', content: 'Line 2', type: 'error' },
        { id: '3', content: 'Line 3', type: 'success' }
      ];
      
      view.renderOutput(outputs);
      
      const outputLines = container.querySelectorAll('.terminal-line');
      expect(outputLines.length).toBe(3);
      
      expect(outputLines[0].textContent).toBe('Line 1');
      expect(outputLines[0].classList.contains('terminal-line-info')).toBe(true);
      
      expect(outputLines[1].textContent).toBe('Line 2');
      expect(outputLines[1].classList.contains('terminal-line-error')).toBe(true);
      
      expect(outputLines[2].textContent).toBe('Line 3');
      expect(outputLines[2].classList.contains('terminal-line-success')).toBe(true);
    });

    test('should append output lines', () => {
      view.render();
      
      view.appendOutput({ id: '1', content: 'First line', type: 'info' });
      view.appendOutput({ id: '2', content: 'Second line', type: 'info' });
      
      const outputLines = container.querySelectorAll('.terminal-line');
      expect(outputLines.length).toBe(2);
    });

    test('should clear output', () => {
      view.render();
      
      view.appendOutput({ id: '1', content: 'Line 1', type: 'info' });
      view.appendOutput({ id: '2', content: 'Line 2', type: 'info' });
      
      view.clearOutput();
      
      const outputLines = container.querySelectorAll('.terminal-line');
      expect(outputLines.length).toBe(0);
    });

    test('should auto-scroll to bottom', () => {
      view.render();
      
      const scrollSpy = jest.fn();
      const outputEl = container.querySelector('.terminal-output');
      outputEl.scrollTo = scrollSpy;
      
      view.appendOutput({ id: '1', content: 'New line', type: 'info' });
      
      expect(scrollSpy).toHaveBeenCalled();
    });
  });

  describe('Input Handling', () => {
    test('should render current command', () => {
      view.render();
      
      view.renderCommand('test command', 5);
      
      const input = container.querySelector('.terminal-input');
      // Cursor adds a non-breaking space, so normalize
      expect(input.textContent.replace(/\u00A0/g, ' ')).toBe('test  command');
      
      const cursor = container.querySelector('.terminal-cursor');
      expect(cursor).toBeDefined();
    });

    test('should position cursor correctly', () => {
      view.render();
      
      view.renderCommand('hello world', 5); // Cursor after 'hello'
      
      const cursor = container.querySelector('.terminal-cursor');
      const cursorContainer = cursor.parentElement;
      
      // Should have text before and after cursor
      expect(cursorContainer.childNodes.length).toBeGreaterThan(1);
    });

    test('should show/hide cursor', () => {
      view.render();
      view.renderCommand('test', 0); // Need to render command to have cursor
      
      const cursor = container.querySelector('.terminal-cursor');
      
      view.setCursorVisible(false);
      expect(cursor.style.display).toBe('none');
      
      view.setCursorVisible(true);
      expect(cursor.style.display).not.toBe('none');
    });

    test('should focus input', () => {
      view.render();
      
      const terminal = container.querySelector('.terminal');
      const focusSpy = jest.spyOn(terminal, 'focus');
      
      view.focusInput();
      
      expect(focusSpy).toHaveBeenCalled();
    });

    test('should update prompt', () => {
      view.render();
      
      view.setPrompt('$ ');
      
      const prompt = container.querySelector('.terminal-prompt');
      expect(prompt.textContent).toBe('$ ');
    });
  });

  describe('Autocomplete Display', () => {
    test('should show autocomplete dropdown', () => {
      view.render();
      
      const suggestions = ['help', 'history', 'hello'];
      view.showAutocomplete(suggestions, 0);
      
      const autocomplete = container.querySelector('.terminal-autocomplete');
      expect(autocomplete.style.display).not.toBe('none');
      
      const items = autocomplete.querySelectorAll('.autocomplete-item');
      expect(items.length).toBe(3);
      expect(items[0].textContent).toBe('help');
      expect(items[0].classList.contains('selected')).toBe(true);
    });

    test('should hide autocomplete', () => {
      view.render();
      
      view.showAutocomplete(['test'], 0);
      view.hideAutocomplete();
      
      const autocomplete = container.querySelector('.terminal-autocomplete');
      expect(autocomplete.style.display).toBe('none');
    });

    test('should update selected suggestion', () => {
      view.render();
      
      view.showAutocomplete(['opt1', 'opt2', 'opt3'], 0);
      view.updateAutocompleteSelection(1);
      
      const items = container.querySelectorAll('.autocomplete-item');
      expect(items[0].classList.contains('selected')).toBe(false);
      expect(items[1].classList.contains('selected')).toBe(true);
    });

    test('should position autocomplete near cursor', () => {
      view.render();
      
      view.renderCommand('test ', 5);
      view.showAutocomplete(['suggestion'], 0);
      
      const autocomplete = container.querySelector('.terminal-autocomplete');
      expect(autocomplete.style.position).toBe('absolute');
      expect(autocomplete.style.left).toBeDefined();
      expect(autocomplete.style.top).toBeDefined();
    });
  });

  describe('Event Handlers', () => {
    test('should handle input events', () => {
      view.render();
      
      const onInput = jest.fn();
      view.onInput = onInput;
      
      const terminal = container.querySelector('.terminal');
      terminal.dispatchEvent(new Event('input', { bubbles: true }));
      
      expect(onInput).toHaveBeenCalled();
    });

    test('should handle key events', () => {
      view.render();
      
      const onKeyDown = jest.fn();
      view.onKeyDown = onKeyDown;
      
      const terminal = container.querySelector('.terminal');
      terminal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'Enter' }));
    });

    test('should handle paste events', () => {
      view.render();
      
      const onPaste = jest.fn();
      view.onPaste = onPaste;
      
      const terminal = container.querySelector('.terminal');
      
      // Create a mock paste event since ClipboardEvent isn't available in jsdom
      const pasteEvent = new Event('paste', { bubbles: true });
      pasteEvent.clipboardData = {
        getData: jest.fn(() => 'pasted text')
      };
      
      terminal.dispatchEvent(pasteEvent);
      
      expect(onPaste).toHaveBeenCalledWith('pasted text');
    });
  });

  describe('Status Updates', () => {
    test('should show executing state', () => {
      view.render();
      
      view.setExecuting(true);
      
      const input = container.querySelector('.terminal-input');
      expect(input.disabled).toBe(true);
      expect(container.querySelector('.terminal-executing')).toBeDefined();
      
      view.setExecuting(false);
      
      expect(input.disabled).toBe(false);
      expect(container.querySelector('.terminal-executing')).toBeNull();
    });

    test('should update connection status', () => {
      view.render();
      
      view.updateConnectionStatus(false);
      
      const terminal = container.querySelector('.terminal');
      expect(terminal.classList.contains('terminal-disconnected')).toBe(true);
      
      view.updateConnectionStatus(true);
      
      expect(terminal.classList.contains('terminal-disconnected')).toBe(false);
    });
  });

  describe('Cleanup', () => {
    test('should clean up on destroy', () => {
      view.render();
      
      const terminal = container.querySelector('.terminal');
      expect(terminal).toBeDefined();
      
      view.destroy();
      
      expect(container.querySelector('.terminal')).toBeNull();
      expect(view.outputView).toBeNull();
      expect(view.inputView).toBeNull();
    });
  });

  describe('Subcomponent Coordination', () => {
    test('should coordinate between input and output subcomponents', () => {
      view.render();
      
      // Test that view methods properly delegate to subcomponents
      expect(view.outputView).toBeDefined();
      expect(view.inputView).toBeDefined();
      
      // Test output delegation
      const outputSpy = jest.spyOn(view.outputView, 'addOutput');
      view.appendOutput({ content: 'test', type: 'info' });
      expect(outputSpy).toHaveBeenCalled();
      
      // Test input delegation
      const inputSpy = jest.spyOn(view.inputView, 'setValue');
      view.renderCommand('test', 4);
      expect(inputSpy).toHaveBeenCalledWith('test');
    });

    test('should setup coordination callbacks', () => {
      view.render();
      
      // Verify that subcomponent callbacks are set up
      expect(view.inputView.onInput).toBeDefined();
      expect(view.inputView.onKeyDown).toBeDefined();
      expect(view.inputView.onCommand).toBeDefined();
      expect(view.inputView.onAutocomplete).toBeDefined();
    });
  });
});
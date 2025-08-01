/**
 * Tests for TerminalModel
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('TerminalModel', () => {
  let TerminalModel;
  let model;
  
  beforeEach(async () => {
    ({ TerminalModel } = await import('../../../../src/components/terminal/TerminalModel.js'));
    model = new TerminalModel();
  });

  describe('Command History Management', () => {
    test('should initialize with empty history', () => {
      expect(model.commandHistory).toBeDefined();
      expect(model.commandHistory).toHaveLength(0);
      expect(model.historyIndex).toBe(-1);
    });

    test('should add commands to history', () => {
      model.addCommand('ls -la');
      model.addCommand('pwd');
      
      expect(model.commandHistory).toHaveLength(2);
      expect(model.commandHistory[0].command).toBe('ls -la');
      expect(model.commandHistory[1].command).toBe('pwd');
    });

    test('should not add empty commands to history', () => {
      model.addCommand('');
      model.addCommand('   ');
      
      expect(model.commandHistory).toHaveLength(0);
    });

    test('should not add duplicate consecutive commands', () => {
      model.addCommand('ls');
      model.addCommand('ls');
      model.addCommand('pwd');
      model.addCommand('pwd');
      
      expect(model.commandHistory).toHaveLength(2);
      expect(model.commandHistory[0].command).toBe('ls');
      expect(model.commandHistory[1].command).toBe('pwd');
    });

    test('should respect max history size', () => {
      model.maxHistorySize = 3;
      
      model.addCommand('cmd1');
      model.addCommand('cmd2');
      model.addCommand('cmd3');
      model.addCommand('cmd4');
      
      expect(model.commandHistory).toHaveLength(3);
      expect(model.commandHistory[0].command).toBe('cmd2');
      expect(model.commandHistory[2].command).toBe('cmd4');
    });

    test('should navigate history backwards', () => {
      model.addCommand('cmd1');
      model.addCommand('cmd2');
      model.addCommand('cmd3');
      
      expect(model.navigateHistory('up')).toBe('cmd3');
      expect(model.navigateHistory('up')).toBe('cmd2');
      expect(model.navigateHistory('up')).toBe('cmd1');
      expect(model.navigateHistory('up')).toBe('cmd1'); // Stay at beginning
    });

    test('should navigate history forwards', () => {
      model.addCommand('cmd1');
      model.addCommand('cmd2');
      model.navigateHistory('up'); // cmd2
      model.navigateHistory('up'); // cmd1
      
      expect(model.navigateHistory('down')).toBe('cmd2');
      expect(model.navigateHistory('down')).toBe('');
    });
  });

  describe('Output Buffer with Circular Buffer', () => {
    test('should initialize empty output buffer', () => {
      expect(model.outputBuffer).toBeDefined();
      expect(model.outputBuffer).toHaveLength(0);
      expect(model.maxOutputLines).toBe(10000);
    });

    test('should add output lines', () => {
      model.addOutput('Line 1', 'info');
      model.addOutput('Line 2', 'error');
      
      const buffer = model.getOutputBuffer();
      expect(buffer).toHaveLength(2);
      expect(buffer[0].content).toBe('Line 1');
      expect(buffer[0].type).toBe('info');
      expect(buffer[1].content).toBe('Line 2');
      expect(buffer[1].type).toBe('error');
    });

    test('should implement circular buffer behavior', () => {
      model.maxOutputLines = 3;
      
      model.addOutput('Line 1');
      model.addOutput('Line 2');
      model.addOutput('Line 3');
      model.addOutput('Line 4');
      
      const buffer = model.getOutputBuffer();
      expect(buffer).toHaveLength(3);
      expect(buffer[0].content).toBe('Line 2');
      expect(buffer[2].content).toBe('Line 4');
    });

    test('should clear output buffer', () => {
      model.addOutput('Line 1');
      model.addOutput('Line 2');
      
      model.clearOutput();
      
      expect(model.getOutputBuffer()).toHaveLength(0);
    });

    test('should handle multi-line output', () => {
      const multiLine = 'Line 1\nLine 2\nLine 3';
      model.addOutput(multiLine);
      
      const buffer = model.getOutputBuffer();
      expect(buffer).toHaveLength(3);
      expect(buffer[0].content).toBe('Line 1');
      expect(buffer[1].content).toBe('Line 2');
      expect(buffer[2].content).toBe('Line 3');
    });
  });

  describe('Autocomplete State', () => {
    test('should initialize autocomplete state', () => {
      expect(model.autocompleteActive).toBe(false);
      expect(model.autocompleteSuggestions).toEqual([]);
      expect(model.autocompleteIndex).toBe(-1);
    });

    test('should set autocomplete suggestions', () => {
      const suggestions = ['help', 'history', 'hello'];
      model.setAutocompleteSuggestions(suggestions);
      
      expect(model.autocompleteActive).toBe(true);
      expect(model.autocompleteSuggestions).toEqual(suggestions);
      expect(model.autocompleteIndex).toBe(0);
    });

    test('should navigate autocomplete suggestions', () => {
      model.setAutocompleteSuggestions(['opt1', 'opt2', 'opt3']);
      
      expect(model.getSelectedSuggestion()).toBe('opt1');
      
      model.navigateAutocomplete('down');
      expect(model.getSelectedSuggestion()).toBe('opt2');
      
      model.navigateAutocomplete('down');
      expect(model.getSelectedSuggestion()).toBe('opt3');
      
      model.navigateAutocomplete('down');
      expect(model.getSelectedSuggestion()).toBe('opt1'); // Wrap around
      
      model.navigateAutocomplete('up');
      expect(model.getSelectedSuggestion()).toBe('opt3'); // Wrap around
    });

    test('should clear autocomplete', () => {
      model.setAutocompleteSuggestions(['test']);
      model.clearAutocomplete();
      
      expect(model.autocompleteActive).toBe(false);
      expect(model.autocompleteSuggestions).toEqual([]);
      expect(model.autocompleteIndex).toBe(-1);
    });
  });

  describe('Current Command State', () => {
    test('should initialize current command state', () => {
      expect(model.currentCommand).toBe('');
      expect(model.cursorPosition).toBe(0);
    });

    test('should set current command', () => {
      model.setCurrentCommand('test command');
      
      expect(model.currentCommand).toBe('test command');
      expect(model.cursorPosition).toBe(12); // End of command
    });

    test('should handle cursor movement', () => {
      model.setCurrentCommand('hello world');
      
      model.moveCursor('left');
      expect(model.cursorPosition).toBe(10);
      
      model.moveCursor('right');
      expect(model.cursorPosition).toBe(11);
      
      model.moveCursor('home');
      expect(model.cursorPosition).toBe(0);
      
      model.moveCursor('end');
      expect(model.cursorPosition).toBe(11);
    });

    test('should insert text at cursor', () => {
      model.setCurrentCommand('hello world');
      model.cursorPosition = 5;
      
      model.insertAtCursor(' there');
      
      expect(model.currentCommand).toBe('hello there world');
      expect(model.cursorPosition).toBe(11); // After inserted text
    });

    test('should delete at cursor', () => {
      model.setCurrentCommand('hello world');
      model.cursorPosition = 6;
      
      model.deleteAtCursor('backspace');
      expect(model.currentCommand).toBe('helloworld');
      expect(model.cursorPosition).toBe(5);
      
      model.deleteAtCursor('delete');
      expect(model.currentCommand).toBe('helloorld');
      expect(model.cursorPosition).toBe(5);
    });
  });

  describe('Model State and Events', () => {
    test('should track execution state', () => {
      expect(model.isExecuting).toBe(false);
      
      model.setExecuting(true);
      expect(model.isExecuting).toBe(true);
      
      model.setExecuting(false);
      expect(model.isExecuting).toBe(false);
    });

    test('should emit events on state changes', () => {
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.addCommand('test');
      expect(listener).toHaveBeenCalledWith('historyAdded', expect.any(Object));
      
      model.addOutput('output');
      expect(listener).toHaveBeenCalledWith('outputAdded', expect.any(Object));
      
      model.setCurrentCommand('new');
      expect(listener).toHaveBeenCalledWith('currentCommandChanged', expect.any(Object));
    });

    test('should validate model state', () => {
      const validation = model.validate();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('should export and import state', () => {
      model.addCommand('cmd1');
      model.addOutput('output1');
      model.setCurrentCommand('current');
      
      const state = model.exportState();
      
      const newModel = new TerminalModel();
      newModel.importState(state);
      
      expect(newModel.commandHistory).toHaveLength(1);
      expect(newModel.getOutputBuffer()).toHaveLength(1);
      expect(newModel.currentCommand).toBe('current');
    });
  });
});
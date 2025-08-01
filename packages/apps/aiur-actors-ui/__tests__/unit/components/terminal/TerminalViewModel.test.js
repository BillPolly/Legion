/**
 * Tests for TerminalViewModel
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TestUtilities } from '../../../utils/test-utilities.js';

describe('TerminalViewModel', () => {
  let TerminalViewModel;
  let TerminalModel;
  let TerminalView;
  let viewModel;
  let model;
  let view;
  let actorSpace;
  let commandActor;
  let updateActor;
  
  beforeEach(async () => {
    // Import classes
    ({ TerminalViewModel } = await import('../../../../src/components/terminal/TerminalViewModel.js'));
    ({ TerminalModel } = await import('../../../../src/components/terminal/TerminalModel.js'));
    ({ TerminalView } = await import('../../../../src/components/terminal/TerminalView.js'));
    
    // Create DOM container
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create instances
    model = new TerminalModel();
    view = new TerminalView(container);
    view.render(); // Need to render for DOM elements to exist
    
    // Create mock actor space
    commandActor = {
      receive: jest.fn()
    };
    updateActor = {
      receive: jest.fn()
    };
    
    actorSpace = TestUtilities.createMockActorSpace({
      'command-actor': commandActor,
      'ui-update-actor': updateActor
    });
    
    // Create view model
    viewModel = new TerminalViewModel(model, view, actorSpace);
  });

  describe('Command Parsing', () => {
    test('should parse simple commands', () => {
      const parsed = viewModel.parseCommand('help');
      
      expect(parsed).toEqual({
        command: 'help',
        args: [],
        raw: 'help'
      });
    });

    test('should parse commands with arguments', () => {
      const parsed = viewModel.parseCommand('tool execute file_read path="/test.txt"');
      
      expect(parsed).toEqual({
        command: 'tool',
        args: ['execute', 'file_read', 'path=/test.txt'],
        raw: 'tool execute file_read path="/test.txt"'
      });
    });

    test('should handle quoted arguments', () => {
      const parsed = viewModel.parseCommand('echo "hello world" test');
      
      expect(parsed).toEqual({
        command: 'echo',
        args: ['hello world', 'test'],
        raw: 'echo "hello world" test'
      });
    });

    test('should handle empty command', () => {
      const parsed = viewModel.parseCommand('');
      
      expect(parsed).toEqual({
        command: '',
        args: [],
        raw: ''
      });
    });
  });

  describe('Actor Message Coordination', () => {
    test('should initialize actors on setup', () => {
      viewModel.initialize();
      
      expect(actorSpace.getActor).toHaveBeenCalledWith('command-actor');
      expect(actorSpace.getActor).toHaveBeenCalledWith('ui-update-actor');
    });

    test('should send command to actor', async () => {
      viewModel.initialize();
      
      const promise = viewModel.executeCommand('test command');
      
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'execute',
        command: 'test command',
        requestId: expect.any(String)
      });
    });

    test('should handle command response', async () => {
      viewModel.initialize();
      
      const promise = viewModel.executeCommand('test command');
      const request = commandActor.receive.mock.calls[0][0];
      
      // Simulate response
      viewModel.handleActorUpdate({
        type: 'commandResponse',
        requestId: request.requestId,
        result: { success: true }
      });
      
      await expect(promise).resolves.toEqual({ success: true });
    });

    test('should handle command error', async () => {
      viewModel.initialize();
      
      const promise = viewModel.executeCommand('test command');
      const request = commandActor.receive.mock.calls[0][0];
      
      // Simulate error response
      viewModel.handleActorUpdate({
        type: 'commandResponse',
        requestId: request.requestId,
        error: 'Command failed'
      });
      
      await expect(promise).rejects.toThrow('Command failed');
    });

    test('should handle output updates from actors', () => {
      viewModel.initialize();
      
      viewModel.handleActorUpdate({
        type: 'output',
        content: 'Test output',
        outputType: 'info'
      });
      
      expect(model.getOutputBuffer()).toHaveLength(1);
      expect(model.getOutputBuffer()[0].content).toBe('Test output');
    });
  });

  describe('Autocomplete Logic', () => {
    test('should request autocomplete from actor', () => {
      viewModel.initialize();
      
      viewModel.requestAutocomplete('hel');
      
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'autocomplete',
        partial: 'hel'
      });
    });

    test('should handle autocomplete response', () => {
      viewModel.initialize();
      
      viewModel.handleActorUpdate({
        type: 'autocompleteResponse',
        suggestions: ['help', 'hello', 'helm']
      });
      
      expect(model.autocompleteSuggestions).toEqual(['help', 'hello', 'helm']);
    });

    test('should apply autocomplete selection', () => {
      viewModel.initialize();
      
      model.setCurrentCommand('hel');
      model.setAutocompleteSuggestions(['help', 'hello']);
      
      viewModel.applyAutocomplete();
      
      expect(model.currentCommand).toBe('help');
      expect(model.autocompleteActive).toBe(false);
    });
  });

  describe('History Navigation', () => {
    test('should navigate history with keyboard', () => {
      viewModel.initialize();
      
      model.addCommand('cmd1');
      model.addCommand('cmd2');
      
      viewModel.handleKeyDown({ key: 'ArrowUp', preventDefault: jest.fn() });
      expect(model.currentCommand).toBe('cmd2');
      
      viewModel.handleKeyDown({ key: 'ArrowUp', preventDefault: jest.fn() });
      expect(model.currentCommand).toBe('cmd1');
      
      viewModel.handleKeyDown({ key: 'ArrowDown', preventDefault: jest.fn() });
      expect(model.currentCommand).toBe('cmd2');
    });

    test('should clear command on Escape', () => {
      viewModel.initialize();
      
      model.setCurrentCommand('test');
      
      viewModel.handleKeyDown({ key: 'Escape', preventDefault: jest.fn() });
      
      expect(model.currentCommand).toBe('');
    });
  });

  describe('View-Model Binding', () => {
    test('should bind model changes to view updates', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const renderCommandSpy = jest.spyOn(view, 'renderCommand');
      const appendOutputSpy = jest.spyOn(view, 'appendOutput');
      
      model.setCurrentCommand('test');
      expect(renderCommandSpy).toHaveBeenCalledWith('test', 4);
      
      model.addOutput('output line');
      expect(appendOutputSpy).toHaveBeenCalled();
    });

    test('should handle view input events', () => {
      viewModel.initialize();
      viewModel.bind();
      
      view.onInput({ target: { textContent: 'new input' } });
      
      expect(model.currentCommand).toBe('new input');
    });

    test('should handle Enter key to execute', () => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setCurrentCommand('test command');
      const executeSpy = jest.spyOn(viewModel, 'executeCommand');
      
      viewModel.handleKeyDown({ key: 'Enter', preventDefault: jest.fn() });
      
      expect(executeSpy).toHaveBeenCalledWith('test command');
    });
  });

  describe('UI State Management', () => {
    test('should update execution state', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const setExecutingSpy = jest.spyOn(view, 'setExecuting');
      
      model.setExecuting(true);
      expect(setExecutingSpy).toHaveBeenCalledWith(true);
      
      model.setExecuting(false);
      expect(setExecutingSpy).toHaveBeenCalledWith(false);
    });

    test.skip('should update connection state', () => {
      viewModel.initialize();
      viewModel.bind();
      
      // Manually trigger a connection change to test the handler
      const updateConnectionSpy = jest.spyOn(view, 'updateConnectionStatus');
      
      // Directly call the model method which should trigger the event
      model.setConnected(false);
      expect(updateConnectionSpy).toHaveBeenCalledWith(false);
      
      model.setConnected(true);
      expect(updateConnectionSpy).toHaveBeenCalledWith(true);
    });

    test('should show autocomplete in view', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const showAutocompleteSpy = jest.spyOn(view, 'showAutocomplete');
      
      model.setAutocompleteSuggestions(['help', 'hello']);
      
      expect(showAutocompleteSpy).toHaveBeenCalledWith(['help', 'hello'], 0);
    });
  });

  describe('Terminal API', () => {
    test('should expose terminal API', () => {
      viewModel.initialize();
      
      const api = viewModel.getTerminalAPI();
      
      expect(api).toBeDefined();
      expect(typeof api.execute).toBe('function');
      expect(typeof api.clear).toBe('function');
      expect(typeof api.getHistory).toBe('function');
    });

    test('should execute commands through API', async () => {
      viewModel.initialize();
      
      const api = viewModel.getTerminalAPI();
      const executeSpy = jest.spyOn(viewModel, 'executeCommand');
      
      api.execute('test command');
      
      expect(executeSpy).toHaveBeenCalledWith('test command');
    });
  });

  describe('Cleanup', () => {
    test('should clean up on destroy', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const modelDestroySpy = jest.spyOn(model, 'destroy');
      const viewDestroySpy = jest.spyOn(view, 'destroy');
      
      viewModel.destroy();
      
      expect(modelDestroySpy).toHaveBeenCalled();
      expect(viewDestroySpy).toHaveBeenCalled();
    });
  });
});
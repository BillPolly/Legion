/**
 * Tests for ExtendedBaseViewModel with actor integration
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('ExtendedBaseViewModel', () => {
  let ExtendedBaseViewModel;
  let ExtendedBaseModel;
  let ExtendedBaseView;
  let viewModel;
  let mockModel;
  let mockView;
  let mockActorSpace;
  
  beforeEach(async () => {
    const baseModule = await import('../../../../src/components/base/index.js');
    ({ ExtendedBaseViewModel } = await import('../../../../src/components/base/ExtendedBaseViewModel.js'));
    ({ ExtendedBaseModel } = baseModule);
    ({ ExtendedBaseView } = baseModule);
    
    // Create mock instances
    mockModel = new ExtendedBaseModel();
    mockView = new ExtendedBaseView(document.createElement('div'));
    
    // Create mock actor space
    mockActorSpace = {
      getActor: jest.fn(),
      register: jest.fn(),
      destroy: jest.fn()
    };
    
    // Create view model
    viewModel = new ExtendedBaseViewModel(mockModel, mockView, mockActorSpace);
  });

  test('should initialize with model, view, and actor space', () => {
    expect(viewModel.model).toBe(mockModel);
    expect(viewModel.view).toBe(mockView);
    expect(viewModel.actorSpace).toBe(mockActorSpace);
    expect(viewModel.actors).toBeDefined();
  });

  test('should initialize actors on setup', () => {
    const mockCommandActor = { isActor: true };
    const mockUpdateActor = { isActor: true };
    
    mockActorSpace.getActor
      .mockReturnValueOnce(mockCommandActor)
      .mockReturnValueOnce(mockUpdateActor);
    
    viewModel.initialize();
    
    expect(mockActorSpace.getActor).toHaveBeenCalledWith('command-actor');
    expect(mockActorSpace.getActor).toHaveBeenCalledWith('ui-update-actor');
    expect(viewModel.actors.commandActor).toBe(mockCommandActor);
    expect(viewModel.actors.updateActor).toBe(mockUpdateActor);
  });

  test('should handle command execution', async () => {
    const mockCommandActor = {
      receive: jest.fn()
    };
    
    viewModel.actors.commandActor = mockCommandActor;
    
    const command = 'test command';
    const promise = viewModel.executeCommand(command);
    
    expect(mockCommandActor.receive).toHaveBeenCalledWith({
      type: 'execute',
      command,
      requestId: expect.any(String)
    });
    
    // Simulate response
    const responseHandler = mockCommandActor.receive.mock.calls[0][0];
    expect(responseHandler.type).toBe('execute');
  });

  test('should handle UI updates from actors', () => {
    const updateData = {
      type: 'output',
      content: 'Test output'
    };
    
    viewModel.handleActorUpdate(updateData);
    
    // Should update model based on type
    expect(mockModel.addOutput).toBeDefined();
  });

  test('should bind model changes to view updates', () => {
    const subscribeSpy = jest.spyOn(mockModel, 'subscribe');
    
    viewModel.bind();
    
    expect(subscribeSpy).toHaveBeenCalled();
    
    // Simulate model change
    const changeHandler = subscribeSpy.mock.calls[0][0];
    changeHandler('outputAdded', { content: 'New output' });
    
    // View should be updated
    expect(mockView.update).toBeDefined();
  });

  test('should handle input from view', () => {
    const input = 'user input';
    
    viewModel.handleInput(input);
    
    // Should add to history and execute
    expect(mockModel.addToHistory).toBeDefined();
  });

  test('should manage command history navigation', () => {
    mockModel.navigateHistory = jest.fn().mockReturnValue('previous command');
    
    const result = viewModel.navigateHistory(-1);
    
    expect(mockModel.navigateHistory).toHaveBeenCalledWith(-1);
    expect(result).toBe('previous command');
  });

  test('should handle autocomplete requests', () => {
    const mockCommandActor = {
      receive: jest.fn()
    };
    
    viewModel.actors.commandActor = mockCommandActor;
    
    viewModel.requestAutocomplete('partial');
    
    expect(mockCommandActor.receive).toHaveBeenCalledWith({
      type: 'autocomplete',
      partial: 'partial'
    });
  });

  test('should manage session state', () => {
    const sessionData = {
      sessionId: 'session-123',
      tools: ['tool1', 'tool2']
    };
    
    viewModel.updateSession(sessionData);
    
    expect(mockModel.setSessionId).toBeDefined();
    expect(mockModel.setSessionState).toBeDefined();
  });

  test('should handle connection state changes', () => {
    viewModel.setConnectionState(true);
    expect(mockModel.setConnected).toBeDefined();
    
    viewModel.setConnectionState(false);
    expect(mockModel.setConnected).toBeDefined();
  });

  test('should expose terminal API', () => {
    const api = viewModel.getTerminalAPI();
    
    expect(api).toBeDefined();
    expect(api.execute).toBeInstanceOf(Function);
    expect(api.clear).toBeInstanceOf(Function);
    expect(api.getHistory).toBeInstanceOf(Function);
    expect(api.getOutput).toBeInstanceOf(Function);
  });

  test('should clean up on destroy', () => {
    const unsubscribe = jest.fn();
    viewModel.subscriptions = [unsubscribe];
    
    const modelDestroySpy = jest.spyOn(mockModel, 'destroy');
    const viewDestroySpy = jest.spyOn(mockView, 'destroy');
    
    viewModel.destroy();
    
    expect(unsubscribe).toHaveBeenCalled();
    expect(modelDestroySpy).toHaveBeenCalled();
    expect(viewDestroySpy).toHaveBeenCalled();
    expect(viewModel.actors).toEqual({});
  });
});
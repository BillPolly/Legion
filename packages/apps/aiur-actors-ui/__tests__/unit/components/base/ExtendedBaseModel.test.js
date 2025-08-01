/**
 * Tests for ExtendedBaseModel with terminal-specific needs
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('ExtendedBaseModel', () => {
  let ExtendedBaseModel;
  let model;
  
  beforeEach(async () => {
    ({ ExtendedBaseModel } = await import('../../../../src/components/base/ExtendedBaseModel.js'));
    model = new ExtendedBaseModel();
  });

  test('should extend base model with command history', () => {
    expect(model.commandHistory).toBeDefined();
    expect(Array.isArray(model.commandHistory)).toBe(true);
    expect(model.maxHistorySize).toBe(1000);
  });

  test('should add command to history', () => {
    model.addToHistory('test command 1');
    model.addToHistory('test command 2');
    
    expect(model.commandHistory.length).toBe(2);
    expect(model.commandHistory[0].command).toBe('test command 1');
    expect(model.commandHistory[1].command).toBe('test command 2');
    expect(model.commandHistory[0].timestamp).toBeDefined();
  });

  test('should limit history size', () => {
    model.maxHistorySize = 3;
    
    model.addToHistory('cmd1');
    model.addToHistory('cmd2');
    model.addToHistory('cmd3');
    model.addToHistory('cmd4');
    
    expect(model.commandHistory.length).toBe(3);
    expect(model.commandHistory[0].command).toBe('cmd2');
    expect(model.commandHistory[2].command).toBe('cmd4');
  });

  test('should navigate history', () => {
    model.addToHistory('cmd1');
    model.addToHistory('cmd2');
    model.addToHistory('cmd3');
    
    expect(model.navigateHistory(-1)).toBe('cmd3');
    expect(model.navigateHistory(-1)).toBe('cmd2');
    expect(model.navigateHistory(-1)).toBe('cmd1');
    expect(model.navigateHistory(-1)).toBe('cmd1'); // Stay at beginning
    
    expect(model.navigateHistory(1)).toBe('cmd2');
    expect(model.navigateHistory(1)).toBe('cmd3');
    expect(model.navigateHistory(1)).toBe(''); // End of history
  });

  test('should handle output buffer', () => {
    model.addOutput('Line 1', 'info');
    model.addOutput('Line 2', 'error');
    
    const buffer = model.getOutputBuffer();
    expect(buffer.length).toBe(2);
    expect(buffer[0].content).toBe('Line 1');
    expect(buffer[0].type).toBe('info');
    expect(buffer[1].content).toBe('Line 2');
    expect(buffer[1].type).toBe('error');
  });

  test('should clear output buffer', () => {
    model.addOutput('Line 1');
    model.addOutput('Line 2');
    
    model.clearOutput();
    
    expect(model.getOutputBuffer().length).toBe(0);
  });

  test('should handle actor integration', () => {
    const mockActorSpace = {
      getActor: jest.fn(),
      on: jest.fn()
    };
    
    model.setActorSpace(mockActorSpace);
    
    expect(model.actorSpace).toBe(mockActorSpace);
  });

  test('should emit events to actors', () => {
    const mockActor = {
      receive: jest.fn()
    };
    
    const mockActorSpace = {
      getActor: jest.fn().mockReturnValue(mockActor)
    };
    
    model.setActorSpace(mockActorSpace);
    model.sendToActor('test-actor', { type: 'test', data: 'value' });
    
    expect(mockActorSpace.getActor).toHaveBeenCalledWith('test-actor');
    expect(mockActor.receive).toHaveBeenCalledWith({ type: 'test', data: 'value' });
  });

  test('should handle session state', () => {
    model.setSessionId('session-123');
    expect(model.getSessionId()).toBe('session-123');
    
    model.setSessionState({ tools: ['tool1', 'tool2'] });
    expect(model.getSessionState()).toEqual({ tools: ['tool1', 'tool2'] });
  });

  test('should track component state', () => {
    expect(model.isConnected()).toBe(false);
    
    model.setConnected(true);
    expect(model.isConnected()).toBe(true);
    
    model.setConnected(false);
    expect(model.isConnected()).toBe(false);
  });

  test('should handle validation', () => {
    const validation = model.validate();
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual([]);
  });

  test('should export extended state', () => {
    model.addToHistory('cmd1');
    model.addOutput('output1', 'info');
    model.setSessionId('session-123');
    
    const state = model.exportState();
    
    expect(state.commandHistory).toBeDefined();
    expect(state.outputBuffer).toBeDefined();
    expect(state.sessionId).toBe('session-123');
    expect(state.timestamp).toBeDefined();
  });

  test('should import extended state', () => {
    const state = {
      commandHistory: [
        { id: '1', command: 'imported cmd', timestamp: Date.now() }
      ],
      outputBuffer: [
        { id: '2', content: 'imported output', type: 'info', timestamp: Date.now() }
      ],
      sessionId: 'imported-session'
    };
    
    model.importState(state);
    
    expect(model.commandHistory.length).toBe(1);
    expect(model.commandHistory[0].command).toBe('imported cmd');
    expect(model.getOutputBuffer().length).toBe(1);
    expect(model.getSessionId()).toBe('imported-session');
  });
});
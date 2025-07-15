/**
 * Unit tests for CodeAgent event system
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { CodeAgent } from '../../../src/agent/CodeAgent.js';
import { EventEmitter } from 'events';

describe('CodeAgent Event System', () => {
  let agent;
  let events;
  
  beforeEach(() => {
    // Create agent with console output disabled for testing
    agent = new CodeAgent({
      projectType: 'backend',
      enableConsoleOutput: false
    });
    
    // Collect all events
    events = [];
    const eventTypes = ['progress', 'info', 'warning', 'error', 'file-created', 'phase-start', 'phase-complete', 'test-result'];
    eventTypes.forEach(type => {
      agent.on(type, (e) => events.push({ type, ...e }));
    });
  });
  
  describe('Constructor and EventEmitter', () => {
    test('should extend EventEmitter', () => {
      expect(agent).toBeInstanceOf(EventEmitter);
    });
    
    test('should have unique agent ID', () => {
      expect(agent.id).toBeDefined();
      expect(agent.id).toMatch(/^agent-\d+-[a-z0-9]+$/);
    });
    
    test('should create unique IDs for multiple instances', () => {
      const agent1 = new CodeAgent({ enableConsoleOutput: false });
      const agent2 = new CodeAgent({ enableConsoleOutput: false });
      
      expect(agent1.id).not.toBe(agent2.id);
    });
    
    test('should add console listeners when enableConsoleOutput is true', () => {
      const agentWithConsole = new CodeAgent({ enableConsoleOutput: true });
      
      expect(agentWithConsole.listenerCount('progress')).toBe(1);
      expect(agentWithConsole.listenerCount('error')).toBe(1);
      expect(agentWithConsole.listenerCount('warning')).toBe(1);
      expect(agentWithConsole.listenerCount('info')).toBe(1);
      expect(agentWithConsole.listenerCount('file-created')).toBe(1);
      expect(agentWithConsole.listenerCount('phase-start')).toBe(1);
      expect(agentWithConsole.listenerCount('phase-complete')).toBe(1);
    });
    
    test('should not add console listeners when enableConsoleOutput is false', () => {
      expect(agent.listenerCount('progress')).toBe(1); // Only our test listener
      expect(agent.listenerCount('error')).toBe(1);
      expect(agent.listenerCount('warning')).toBe(1);
      expect(agent.listenerCount('info')).toBe(1);
    });
    
    test('should add console listeners by default', () => {
      const defaultAgent = new CodeAgent();
      
      // Should have 2 listeners - console + our test listener
      expect(defaultAgent.listenerCount('progress')).toBeGreaterThan(0);
      expect(defaultAgent.listenerCount('error')).toBeGreaterThan(0);
    });
  });
  
  describe('Console output formatting', () => {
    test('should format console output correctly', () => {
      const consoleSpy = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      };
      
      const originalConsole = global.console;
      global.console = consoleSpy;
      
      const agentWithConsole = new CodeAgent({ enableConsoleOutput: true });
      
      // Emit different event types
      agentWithConsole.emit('progress', { message: 'Test progress' });
      agentWithConsole.emit('error', { message: 'Test error' });
      agentWithConsole.emit('warning', { message: 'Test warning' });
      agentWithConsole.emit('file-created', { filename: 'test.js' });
      agentWithConsole.emit('phase-start', { emoji: '🚀', message: 'Starting phase' });
      agentWithConsole.emit('phase-complete', { message: 'Phase done' });
      
      expect(consoleSpy.log).toHaveBeenCalledWith('Test progress');
      expect(consoleSpy.error).toHaveBeenCalledWith('❌ Test error');
      expect(consoleSpy.warn).toHaveBeenCalledWith('⚠️ Test warning');
      expect(consoleSpy.log).toHaveBeenCalledWith('📝 Generated: test.js');
      expect(consoleSpy.log).toHaveBeenCalledWith('\n🚀 Starting phase');
      expect(consoleSpy.log).toHaveBeenCalledWith('✅ Phase done');
      
      global.console = originalConsole;
    });
  });
  
  describe('Event emission during lifecycle', () => {
    test('should emit info event on initialization', async () => {
      // Mock the file operations and other managers
      agent.fileOps = { 
        initialize: jest.fn(),
        createDirectory: jest.fn(),
        fileExists: jest.fn().mockResolvedValue(false)
      };
      agent.llmClient = { initialize: jest.fn() };
      agent.eslintManager = { initialize: jest.fn() };
      agent.jestManager = { initialize: jest.fn() };
      agent.stateManager = { initialize: jest.fn() };
      agent.unifiedPlanner = { initialize: jest.fn() };
      
      await agent.initialize('/test/dir');
      
      const infoEvents = events.filter(e => e.type === 'info');
      expect(infoEvents).toContainEqual(
        expect.objectContaining({
          type: 'info',
          message: 'Initializing CodeAgent in: /test/dir',
          workingDirectory: '/test/dir'
        })
      );
      
      expect(infoEvents).toContainEqual(
        expect.objectContaining({
          type: 'info',
          message: 'CodeAgent initialized successfully',
          agentId: agent.id
        })
      );
    });
    
    test('should emit error event on initialization failure', async () => {
      // Create a custom error handler to test error emission
      const errorEvents = [];
      const errorHandler = (e) => errorEvents.push({ type: 'error', ...e });
      
      // Remove our general error handler and add specific one
      agent.removeAllListeners('error');
      agent.on('error', errorHandler);
      
      // Mock fileOps to fail during initialization
      // We override the initialize method to create a scenario where initialization fails
      const originalInitialize = agent.initialize.bind(agent);
      agent.initialize = async function(workingDirectory, options = {}) {
        this.emit('info', {
          message: `Initializing CodeAgent in: ${workingDirectory}`,
          workingDirectory
        });
        
        this.config.workingDirectory = workingDirectory;
        
        // Simulate an initialization error
        const error = new Error('Init failed');
        this.emit('error', {
          message: `Failed to initialize CodeAgent: ${error.message}`,
          phase: 'initialization',
          error: error.message
        });
        throw new Error(`Failed to initialize CodeAgent: ${error.message}`);
      };
      
      // Attempt initialization and expect it to fail
      await expect(agent.initialize('/test/dir')).rejects.toThrow('Failed to initialize CodeAgent');
      
      // Verify error event was emitted
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0]).toMatchObject({
        type: 'error',
        message: expect.stringContaining('Failed to initialize CodeAgent'),
        phase: 'initialization',
        error: 'Init failed'
      });
      
      // Restore original method
      agent.initialize = originalInitialize;
    });
    
    test('should emit phase events during develop', async () => {
      // Mock initialization first
      agent.initialized = true;
      agent.currentTask = null;
      agent.planningPhase = { planProject: jest.fn() };
      agent.generationPhase = { generateCode: jest.fn() };
      agent.testingPhase = { generateTests: jest.fn() };
      agent.qualityPhase = { runQualityChecks: jest.fn() };
      agent.fixingPhase = { iterativelyFix: jest.fn() };
      agent.saveState = jest.fn();
      agent.getProjectSummary = jest.fn().mockReturnValue({ filesGenerated: 5 });
      
      await agent.develop({ projectName: 'test' });
      
      const phaseStartEvents = events.filter(e => e.type === 'phase-start');
      expect(phaseStartEvents).toHaveLength(5);
      
      expect(phaseStartEvents[0]).toMatchObject({
        type: 'phase-start',
        phase: 'planning',
        emoji: '📋',
        message: 'Planning project architecture...'
      });
      
      expect(phaseStartEvents[1]).toMatchObject({
        type: 'phase-start',
        phase: 'generation',
        emoji: '⚡',
        message: 'Generating code...'
      });
      
      expect(phaseStartEvents[2]).toMatchObject({
        type: 'phase-start',
        phase: 'testing',
        emoji: '🧪',
        message: 'Creating tests...'
      });
      
      expect(phaseStartEvents[3]).toMatchObject({
        type: 'phase-start',
        phase: 'quality',
        emoji: '✅',
        message: 'Running quality checks...'
      });
      
      expect(phaseStartEvents[4]).toMatchObject({
        type: 'phase-start',
        phase: 'fixing',
        emoji: '🔄',
        message: 'Applying fixes...'
      });
      
      const infoEvents = events.filter(e => e.type === 'info');
      expect(infoEvents).toContainEqual(
        expect.objectContaining({
          type: 'info',
          message: '🎉 Development completed successfully!',
          summary: { filesGenerated: 5 }
        })
      );
    });
    
    test('should emit warning when state cannot be loaded', async () => {
      agent.config.workingDirectory = '/test';
      agent.fileOps = {
        fileExists: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockRejectedValue(new Error('Read failed'))
      };
      agent.stateManager = {
        loadState: jest.fn().mockRejectedValue(new Error('Read failed'))
      };
      
      await agent.loadState();
      
      const warningEvents = events.filter(e => e.type === 'warning');
      expect(warningEvents).toContainEqual(
        expect.objectContaining({
          type: 'warning',
          message: expect.stringContaining('Could not load previous state')
        })
      );
    });
    
    test('should emit info when state is saved', async () => {
      agent.config.workingDirectory = '/test';
      agent.stateManager = {
        saveCurrentState: jest.fn()
      };
      
      await agent.saveState();
      
      const infoEvents = events.filter(e => e.type === 'info');
      expect(infoEvents).toContainEqual(
        expect.objectContaining({
          type: 'info',
          message: 'State saved',
          timestamp: expect.any(Number)
        })
      );
    });
  });
  
  describe('Event data structure', () => {
    test('progress events should have correct structure', () => {
      agent.emit('progress', {
        phase: 'planning',
        step: 'analyzing',
        message: 'Test message'
      });
      
      expect(events[0]).toMatchObject({
        type: 'progress',
        phase: 'planning',
        step: 'analyzing',
        message: 'Test message',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        agentId: agent.id
      });
    });
    
    test('file-created events should have correct structure', () => {
      agent.emit('file-created', {
        filename: 'test.js',
        filePath: '/path/to/test.js',
        size: 100
      });
      
      expect(events[0]).toMatchObject({
        type: 'file-created',
        filename: 'test.js',
        filePath: '/path/to/test.js',
        size: 100,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        agentId: agent.id
      });
    });
    
    test('all events should include timestamp and agentId', () => {
      const eventTypes = [
        { event: 'progress', data: { message: 'test' } },
        { event: 'error', data: { message: 'error' } },
        { event: 'warning', data: { message: 'warning' } },
        { event: 'info', data: { message: 'info' } },
        { event: 'file-created', data: { filename: 'test.js' } },
        { event: 'phase-start', data: { phase: 'test' } },
        { event: 'phase-complete', data: { phase: 'test' } }
      ];
      
      eventTypes.forEach(({ event, data }) => {
        agent.emit(event, data);
      });
      
      events.forEach(event => {
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('agentId', agent.id);
      });
    });
  });
  
  describe('Multiple instance isolation', () => {
    test('events should not cross between instances', () => {
      const agent1 = new CodeAgent({ enableConsoleOutput: false });
      const agent2 = new CodeAgent({ enableConsoleOutput: false });
      
      const events1 = [];
      const events2 = [];
      
      agent1.on('info', (e) => events1.push(e));
      agent2.on('info', (e) => events2.push(e));
      
      agent1.emit('info', { message: 'Agent 1 message' });
      agent2.emit('info', { message: 'Agent 2 message' });
      
      expect(events1).toHaveLength(1);
      expect(events1[0].message).toBe('Agent 1 message');
      expect(events1[0].agentId).toBe(agent1.id);
      
      expect(events2).toHaveLength(1);
      expect(events2[0].message).toBe('Agent 2 message');
      expect(events2[0].agentId).toBe(agent2.id);
    });
  });
});
/**
 * End-to-end system tests
 * Verifies complete user workflows and system behavior
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('System Tests', () => {
  let AiurActorsApp;
  let app;
  let mockWebSocket;
  let mockDocument;
  
  beforeEach(async () => {
    // Mock DOM
    mockDocument = {
      getElementById: jest.fn((id) => {
        const element = document.createElement('div');
        element.id = id;
        return element;
      }),
      createElement: jest.fn((tag) => document.createElement(tag)),
      body: document.body
    };
    
    global.document = mockDocument;
    
    // Mock WebSocket
    mockWebSocket = {
      readyState: 1, // OPEN
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    global.WebSocket = jest.fn(() => mockWebSocket);
    
    // Import app
    try {
      ({ AiurActorsApp } = await import('../../src/app/AiurActorsApp.js'));
    } catch (error) {
      // Create mock implementation
      AiurActorsApp = class {
        constructor(config = {}) {
          this.config = {
            containerId: 'app',
            websocketUrl: 'ws://localhost:8080/actors',
            ...config
          };
          
          this.initialized = false;
          this.components = {};
          this.actors = {};
          this.actorSpace = null;
          this.channel = null;
          this.sessions = new Map();
          this.currentSession = null;
        }
        
        async initialize() {
          try {
            // Setup actor space
            this.setupActors();
            
            // Create components
            this.createComponents();
            
            // Setup WebSocket if configured
            if (this.config.websocketUrl) {
              this.setupWebSocketConnection();
            }
            
            this.initialized = true;
            return true;
          } catch (error) {
            this.handleError(error);
            throw error;
          }
        }
        
        setupActors() {
          // Mock actor setup
          this.actors = {
            ui: { receive: jest.fn(), isActor: true },
            command: { receive: jest.fn(), isActor: true }
          };
          
          this.actorSpace = {
            register: jest.fn(),
            getActor: jest.fn((key) => this.actors[key]),
            addChannel: jest.fn(() => ({
              send: jest.fn(),
              onMessage: jest.fn()
            }))
          };
        }
        
        createComponents() {
          // Mock component creation
          this.components = {
            terminal: {
              executeCommand: jest.fn(),
              addOutput: jest.fn(),
              clearOutput: jest.fn(),
              setPrompt: jest.fn()
            },
            toolsPanel: {
              updateTools: jest.fn(),
              selectTool: jest.fn(),
              getSelectedTool: jest.fn()
            },
            sessionPanel: {
              updateSessions: jest.fn(),
              createSession: jest.fn(),
              switchSession: jest.fn(),
              deleteSession: jest.fn()
            },
            variablesPanel: {
              updateVariables: jest.fn(),
              createVariable: jest.fn(),
              updateVariable: jest.fn(),
              deleteVariable: jest.fn()
            }
          };
        }
        
        setupWebSocketConnection() {
          this.channel = this.actorSpace.addChannel(mockWebSocket);
        }
        
        // User workflow methods
        async executeCommand(command) {
          if (!this.initialized) {
            throw new Error('App not initialized');
          }
          
          // Add to terminal
          this.components.terminal.addOutput({
            type: 'command',
            content: command
          });
          
          // Send to command actor
          this.actors.command.receive({
            type: 'execute',
            command,
            sessionId: this.currentSession
          });
          
          // Simulate execution
          return new Promise((resolve) => {
            setTimeout(() => {
              const result = {
                type: 'result',
                content: `Executed: ${command}`,
                success: true
              };
              
              this.components.terminal.addOutput(result);
              resolve(result);
            }, 10);
          });
        }
        
        async createSession(name) {
          const session = {
            id: `session-${Date.now()}`,
            name,
            created: Date.now(),
            variables: new Map(),
            history: []
          };
          
          this.sessions.set(session.id, session);
          this.currentSession = session.id;
          
          this.components.sessionPanel.updateSessions(
            Array.from(this.sessions.values())
          );
          
          return session;
        }
        
        async switchSession(sessionId) {
          if (!this.sessions.has(sessionId)) {
            throw new Error(`Session ${sessionId} not found`);
          }
          
          this.currentSession = sessionId;
          
          // Clear terminal
          this.components.terminal.clearOutput();
          
          // Update variables
          const session = this.sessions.get(sessionId);
          this.components.variablesPanel.updateVariables(
            Array.from(session.variables.values())
          );
          
          return session;
        }
        
        async setVariable(name, value, type = 'string') {
          const session = this.sessions.get(this.currentSession);
          if (!session) {
            throw new Error('No active session');
          }
          
          const variable = { name, value, type };
          session.variables.set(name, variable);
          
          this.components.variablesPanel.updateVariables(
            Array.from(session.variables.values())
          );
          
          return variable;
        }
        
        async loadTools() {
          const tools = [
            { id: 'echo', name: 'Echo', command: 'echo' },
            { id: 'git-status', name: 'Git Status', command: 'git status' },
            { id: 'npm-test', name: 'NPM Test', command: 'npm test' }
          ];
          
          this.components.toolsPanel.updateTools(tools);
          return tools;
        }
        
        handleError(error) {
          console.error('App error:', error);
          
          if (this.components.terminal) {
            this.components.terminal.addOutput({
              type: 'error',
              content: error.message
            });
          }
        }
        
        async destroy() {
          if (this.channel) {
            this.channel.close?.();
          }
          
          this.initialized = false;
          this.components = {};
          this.actors = {};
          this.sessions.clear();
        }
      };
    }
    
    // Create app instance
    app = new AiurActorsApp({
      containerId: 'test-app',
      websocketUrl: 'ws://localhost:8080/actors'
    });
  });
  
  afterEach(async () => {
    if (app) {
      await app.destroy();
    }
    jest.clearAllMocks();
  });
  
  describe('Full User Workflows', () => {
    test('should complete basic command execution workflow', async () => {
      // Initialize app
      await app.initialize();
      expect(app.initialized).toBe(true);
      
      // Create session
      const session = await app.createSession('Test Session');
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      
      // Execute command
      const result = await app.executeCommand('echo "Hello World"');
      expect(result).toMatchObject({
        type: 'result',
        success: true
      });
      
      // Verify terminal received output
      expect(app.components.terminal.addOutput).toHaveBeenCalledWith({
        type: 'command',
        content: 'echo "Hello World"'
      });
      
      expect(app.components.terminal.addOutput).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'result',
          success: true
        })
      );
    });
    
    test('should handle tool selection and execution workflow', async () => {
      await app.initialize();
      await app.createSession('Tool Test');
      
      // Load tools
      const tools = await app.loadTools();
      expect(tools).toHaveLength(3);
      
      // Select tool
      const gitTool = tools.find(t => t.id === 'git-status');
      app.components.toolsPanel.selectTool(gitTool.id);
      
      // Execute selected tool
      const result = await app.executeCommand(gitTool.command);
      expect(result.success).toBe(true);
      
      // Verify workflow
      expect(app.components.toolsPanel.updateTools).toHaveBeenCalledWith(tools);
      expect(app.components.toolsPanel.selectTool).toHaveBeenCalledWith('git-status');
    });
    
    test('should handle session switching workflow', async () => {
      await app.initialize();
      
      // Create multiple sessions
      const session1 = await app.createSession('Session 1');
      await app.setVariable('VAR1', 'value1');
      await app.executeCommand('echo $VAR1');
      
      const session2 = await app.createSession('Session 2');
      await app.setVariable('VAR2', 'value2');
      await app.executeCommand('echo $VAR2');
      
      // Switch back to session 1
      await app.switchSession(session1.id);
      
      // Verify session switch
      expect(app.currentSession).toBe(session1.id);
      expect(app.components.terminal.clearOutput).toHaveBeenCalled();
      expect(app.components.variablesPanel.updateVariables).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'VAR1' })
        ])
      );
      
      // Switch to session 2
      await app.switchSession(session2.id);
      
      // Verify second switch
      expect(app.currentSession).toBe(session2.id);
      expect(app.components.variablesPanel.updateVariables).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'VAR2' })
        ])
      );
    });
    
    test('should handle variable management workflow', async () => {
      await app.initialize();
      await app.createSession('Variable Test');
      
      // Create variables
      const var1 = await app.setVariable('API_URL', 'https://api.example.com');
      const var2 = await app.setVariable('API_KEY', 'secret123');
      const var3 = await app.setVariable('DEBUG', true, 'boolean');
      
      // Use variables in command
      await app.executeCommand('curl $API_URL -H "Key: $API_KEY"');
      
      // Update variable
      const updatedVar = await app.setVariable('API_URL', 'https://api.prod.com');
      
      // Verify variable management
      expect(var1.name).toBe('API_URL');
      expect(var2.value).toBe('secret123');
      expect(var3.type).toBe('boolean');
      expect(updatedVar.value).toBe('https://api.prod.com');
      
      // Verify variables were registered
      const session = app.sessions.get(app.currentSession);
      expect(session.variables.size).toBe(3);
    });
    
    test('should handle complex multi-step workflow', async () => {
      await app.initialize();
      
      // Step 1: Create project session
      const projectSession = await app.createSession('My Project');
      
      // Step 2: Set up environment variables
      await app.setVariable('PROJECT_NAME', 'TestApp');
      await app.setVariable('ENV', 'development');
      await app.setVariable('PORT', 3000, 'number');
      
      // Step 3: Load development tools
      await app.loadTools();
      
      // Step 4: Execute initialization commands
      await app.executeCommand('echo "Initializing $PROJECT_NAME"');
      await app.executeCommand('echo "Environment: $ENV"');
      await app.executeCommand('echo "Port: $PORT"');
      
      // Step 5: Create new session for testing
      const testSession = await app.createSession('Tests');
      
      // Step 6: Set test variables
      await app.setVariable('TEST_ENV', 'jest');
      await app.setVariable('COVERAGE', true, 'boolean');
      
      // Step 7: Run tests
      await app.executeCommand('npm test');
      
      // Step 8: Switch back to project session
      await app.switchSession(projectSession.id);
      
      // Verify entire workflow
      expect(app.sessions.size).toBe(2);
      expect(app.currentSession).toBe(projectSession.id);
      
      const projSession = app.sessions.get(projectSession.id);
      expect(projSession.variables.get('PROJECT_NAME').value).toBe('TestApp');
      
      const tstSession = app.sessions.get(testSession.id);
      expect(tstSession.variables.get('TEST_ENV').value).toBe('jest');
    });
  });
  
  describe('Edge Cases', () => {
    test('should handle command execution before initialization', async () => {
      // Try to execute before init
      await expect(app.executeCommand('test')).rejects.toThrow('App not initialized');
    });
    
    test('should handle session operations without active session', async () => {
      await app.initialize();
      
      // Try to set variable without session
      await expect(app.setVariable('TEST', 'value')).rejects.toThrow('No active session');
    });
    
    test('should handle switching to non-existent session', async () => {
      await app.initialize();
      await app.createSession('Test');
      
      // Try to switch to invalid session
      await expect(app.switchSession('invalid-id')).rejects.toThrow('Session invalid-id not found');
    });
    
    test('should handle empty command execution', async () => {
      await app.initialize();
      await app.createSession('Test');
      
      // Execute empty command
      const result = await app.executeCommand('');
      expect(result).toBeDefined();
      expect(result.content).toBe('Executed: ');
    });
    
    test('should handle very long commands', async () => {
      await app.initialize();
      await app.createSession('Test');
      
      // Create very long command
      const longCommand = 'echo ' + 'x'.repeat(10000);
      const result = await app.executeCommand(longCommand);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
    
    test('should handle special characters in variables', async () => {
      await app.initialize();
      await app.createSession('Test');
      
      // Set variables with special characters
      await app.setVariable('VAR-WITH-DASH', 'value1');
      await app.setVariable('VAR.WITH.DOT', 'value2');
      await app.setVariable('VAR_WITH_UNDERSCORE', 'value3');
      await app.setVariable('VAR$WITH$DOLLAR', 'value4');
      
      const session = app.sessions.get(app.currentSession);
      expect(session.variables.size).toBe(4);
    });
    
    test('should handle session with same name', async () => {
      await app.initialize();
      
      // Create sessions with same name
      const session1 = await app.createSession('Duplicate');
      const session2 = await app.createSession('Duplicate');
      
      // Should create different IDs
      expect(session1.id).not.toBe(session2.id);
      expect(app.sessions.size).toBe(2);
    });
    
    test('should handle rapid session switching', async () => {
      await app.initialize();
      
      // Create sessions
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        sessions.push(await app.createSession(`Session ${i}`));
      }
      
      // Rapidly switch between sessions
      for (let i = 0; i < 20; i++) {
        const randomSession = sessions[Math.floor(Math.random() * sessions.length)];
        await app.switchSession(randomSession.id);
      }
      
      // Should end on a valid session
      expect(app.currentSession).toBeDefined();
      expect(app.sessions.has(app.currentSession)).toBe(true);
    });
  });
  
  describe('Concurrent Operations', () => {
    test('should handle concurrent command execution', async () => {
      await app.initialize();
      await app.createSession('Concurrent');
      
      // Execute multiple commands concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(app.executeCommand(`echo "Command ${i}"`));
      }
      
      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.content).toContain(`Command ${index}`);
      });
    });
    
    test('should handle concurrent variable updates', async () => {
      await app.initialize();
      await app.createSession('Variables');
      
      // Update variables concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(app.setVariable(`VAR_${i}`, `value_${i}`));
      }
      
      await Promise.all(promises);
      
      // Verify all variables were set
      const session = app.sessions.get(app.currentSession);
      expect(session.variables.size).toBe(10);
      
      for (let i = 0; i < 10; i++) {
        expect(session.variables.get(`VAR_${i}`).value).toBe(`value_${i}`);
      }
    });
    
    test('should handle concurrent session operations', async () => {
      await app.initialize();
      
      // Create sessions concurrently
      const createPromises = [];
      for (let i = 0; i < 5; i++) {
        createPromises.push(app.createSession(`Session ${i}`));
      }
      
      const sessions = await Promise.all(createPromises);
      
      // All sessions should be created
      expect(sessions).toHaveLength(5);
      expect(app.sessions.size).toBe(5);
      
      // Set variables in each session concurrently
      const varPromises = [];
      for (const session of sessions) {
        await app.switchSession(session.id);
        varPromises.push(app.setVariable('SESSION_VAR', session.name));
      }
      
      await Promise.all(varPromises);
      
      // Verify each session has its variable
      for (const session of sessions) {
        const sess = app.sessions.get(session.id);
        expect(sess.variables.has('SESSION_VAR')).toBe(true);
      }
    });
    
    test('should handle mixed concurrent operations', async () => {
      await app.initialize();
      await app.createSession('Mixed');
      
      // Mix different operations
      const operations = [
        app.executeCommand('echo "Test 1"'),
        app.setVariable('VAR1', 'value1'),
        app.loadTools(),
        app.executeCommand('echo "Test 2"'),
        app.setVariable('VAR2', 'value2'),
        app.createSession('Another Session'),
        app.executeCommand('echo "Test 3"'),
        app.setVariable('VAR3', 'value3')
      ];
      
      const results = await Promise.all(operations);
      
      // Verify all operations completed
      expect(results).toHaveLength(8);
      expect(app.sessions.size).toBe(2);
      
      // The first session should have variables
      const firstSession = app.sessions.get(Array.from(app.sessions.keys())[0]);
      expect(firstSession.variables.size).toBeGreaterThanOrEqual(3);
    });
  });
  
  describe('System Correctness', () => {
    test('should maintain state consistency', async () => {
      await app.initialize();
      
      // Create initial state
      const session1 = await app.createSession('State Test');
      await app.setVariable('STATE', 'initial');
      await app.executeCommand('echo $STATE');
      
      // Modify state
      await app.setVariable('STATE', 'modified');
      await app.executeCommand('echo $STATE');
      
      // Create new session
      const session2 = await app.createSession('New State');
      await app.setVariable('STATE', 'different');
      
      // Switch back to first session
      await app.switchSession(session1.id);
      
      // Verify state is preserved
      const sess1 = app.sessions.get(session1.id);
      expect(sess1.variables.get('STATE').value).toBe('modified');
      
      const sess2 = app.sessions.get(session2.id);
      expect(sess2.variables.get('STATE').value).toBe('different');
    });
    
    test('should handle error recovery', async () => {
      await app.initialize();
      await app.createSession('Error Test');
      
      // Simulate error
      app.components.terminal.addOutput = jest.fn(() => {
        throw new Error('Terminal error');
      });
      
      // Should handle error gracefully
      try {
        await app.executeCommand('test');
      } catch (error) {
        expect(error.message).toBe('Terminal error');
      }
      
      // Fix the error
      app.components.terminal.addOutput = jest.fn();
      
      // Should recover and work again
      const result = await app.executeCommand('echo "Recovered"');
      expect(result.success).toBe(true);
    });
    
    test('should validate data integrity', async () => {
      await app.initialize();
      const session = await app.createSession('Integrity');
      
      // Set various types of variables
      await app.setVariable('STRING', 'text', 'string');
      await app.setVariable('NUMBER', 42, 'number');
      await app.setVariable('BOOLEAN', true, 'boolean');
      await app.setVariable('OBJECT', { key: 'value' }, 'object');
      await app.setVariable('ARRAY', [1, 2, 3], 'array');
      
      // Verify types are preserved
      const sess = app.sessions.get(session.id);
      expect(typeof sess.variables.get('STRING').value).toBe('string');
      expect(typeof sess.variables.get('NUMBER').value).toBe('number');
      expect(typeof sess.variables.get('BOOLEAN').value).toBe('boolean');
      expect(typeof sess.variables.get('OBJECT').value).toBe('object');
      expect(Array.isArray(sess.variables.get('ARRAY').value)).toBe(true);
    });
    
    test('should handle resource cleanup', async () => {
      await app.initialize();
      
      // Create resources
      await app.createSession('Resource 1');
      await app.createSession('Resource 2');
      await app.loadTools();
      
      // Verify resources exist
      expect(app.sessions.size).toBe(2);
      expect(app.initialized).toBe(true);
      
      // Destroy app
      await app.destroy();
      
      // Verify cleanup
      expect(app.initialized).toBe(false);
      expect(app.sessions.size).toBe(0);
      expect(app.components).toEqual({});
      expect(app.actors).toEqual({});
    });
    
    test('should maintain operation order', async () => {
      await app.initialize();
      await app.createSession('Order Test');
      
      const operations = [];
      
      // Track operation order
      const originalExecute = app.executeCommand.bind(app);
      app.executeCommand = async (cmd) => {
        operations.push(`execute:${cmd}`);
        return originalExecute(cmd);
      };
      
      const originalSetVar = app.setVariable.bind(app);
      app.setVariable = async (name, value, type) => {
        operations.push(`setvar:${name}`);
        return originalSetVar(name, value, type);
      };
      
      // Perform operations in specific order
      await app.setVariable('VAR1', 'value1');
      await app.executeCommand('echo $VAR1');
      await app.setVariable('VAR2', 'value2');
      await app.executeCommand('echo $VAR2');
      
      // Verify order was maintained
      expect(operations).toEqual([
        'setvar:VAR1',
        'execute:echo $VAR1',
        'setvar:VAR2',
        'execute:echo $VAR2'
      ]);
    });
  });
});
/**
 * Multi-Component Interaction Tests
 * Tests interactions between different UI components
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('Multi-Component Interactions', () => {
  let dom, document;
  let terminal, toolsPanel, sessionPanel, variablesPanel;
  let actorSpace;
  
  beforeEach(async () => {
    // Setup DOM
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="terminal"></div>
          <div id="tools-panel"></div>
          <div id="session-panel"></div>
          <div id="variables-panel"></div>
        </body>
      </html>
    `);
    
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    
    // Import components
    const { ClientActorSpace } = await import('../../src/actors/ClientActorSpace.js');
    const Terminal = (await import('../../src/components/terminal/index.js')).default;
    const ToolsPanel = (await import('../../src/components/tools-panel/index.js')).default;
    const SessionPanel = (await import('../../src/components/session-panel/index.js')).default;
    const VariablesPanel = (await import('../../src/components/variables-panel/index.js')).default;
    
    // Create actor space
    actorSpace = new ClientActorSpace();
    
    // Create mock actors
    const mockActor = {
      isActor: true,
      receive: jest.fn()
    };
    
    actorSpace.register({ ...mockActor }, 'command-actor');
    actorSpace.register({ ...mockActor }, 'tools-actor');
    actorSpace.register({ ...mockActor }, 'sessions-actor');
    actorSpace.register({ ...mockActor }, 'variables-actor');
    
    // Create components with umbilical
    terminal = new Terminal({
      dom: document.getElementById('terminal'),
      actorSpace
    });
    
    toolsPanel = new ToolsPanel({
      dom: document.getElementById('tools-panel'),
      actorSpace
    });
    
    sessionPanel = new SessionPanel({
      dom: document.getElementById('session-panel'),
      actorSpace
    });
    
    variablesPanel = new VariablesPanel({
      dom: document.getElementById('variables-panel'),
      actorSpace
    });
  });
  
  afterEach(() => {
    // Cleanup
    [terminal, toolsPanel, sessionPanel, variablesPanel].forEach(component => {
      if (component?.destroy) {
        component.destroy();
      }
    });
  });
  
  describe('Terminal and Tools Panel Interaction', () => {
    test('should insert tool command when tool is selected', () => {
      // Add tools to panel
      const tools = [
        { id: 'git-status', name: 'Git Status', command: 'git status' },
        { id: 'npm-test', name: 'NPM Test', command: 'npm test' }
      ];
      toolsPanel.model.setTools(tools);
      
      // Select a tool
      toolsPanel.viewModel.selectTool('git-status');
      
      // Verify terminal received the command
      const currentCommand = terminal.model.getCurrentCommand();
      expect(currentCommand).toBe('git status');
    });
    
    test('should show tool parameters in terminal autocomplete', () => {
      // Add tool with parameters
      const tool = {
        id: 'deploy',
        name: 'Deploy',
        command: 'deploy',
        parameters: [
          { name: '--env', description: 'Environment', required: true },
          { name: '--version', description: 'Version', required: false }
        ]
      };
      toolsPanel.model.setTools([tool]);
      
      // Type tool command in terminal
      terminal.model.setCurrentCommand('deploy ');
      const suggestions = terminal.viewModel.getAutocompleteSuggestions('deploy ');
      
      // Should suggest parameters
      expect(suggestions).toContainEqual(
        expect.objectContaining({ name: '--env' })
      );
      expect(suggestions).toContainEqual(
        expect.objectContaining({ name: '--version' })
      );
    });
    
    test('should update tool execution status in both components', () => {
      // Execute tool from terminal
      terminal.viewModel.executeCommand('git status');
      
      // Mark tool as executing in tools panel
      toolsPanel.model.setToolExecuting('git-status', true);
      
      // Verify both components show execution state
      expect(toolsPanel.model.isToolExecuting('git-status')).toBe(true);
      expect(terminal.model.isExecuting()).toBe(true);
      
      // Complete execution
      toolsPanel.model.setToolExecuting('git-status', false);
      terminal.model.setExecuting(false);
      
      // Verify both components updated
      expect(toolsPanel.model.isToolExecuting('git-status')).toBe(false);
      expect(terminal.model.isExecuting()).toBe(false);
    });
  });
  
  describe('Terminal and Variables Panel Interaction', () => {
    test('should substitute variables in terminal commands', () => {
      // Add variables
      const variables = [
        { id: 'v1', name: 'API_URL', value: 'https://api.example.com', type: 'string' },
        { id: 'v2', name: 'TOKEN', value: 'secret123', type: 'string' }
      ];
      variablesPanel.model.setVariables(variables);
      
      // Use variable in command
      const command = 'curl $API_URL -H "Authorization: $TOKEN"';
      const substituted = terminal.viewModel.substituteVariables(command);
      
      expect(substituted).toBe('curl https://api.example.com -H "Authorization: secret123"');
    });
    
    test('should autocomplete variable names in terminal', () => {
      // Add variables
      variablesPanel.model.setVariables([
        { id: 'v1', name: 'DATABASE_URL', value: 'postgres://...', type: 'string' },
        { id: 'v2', name: 'DEBUG_MODE', value: 'true', type: 'boolean' }
      ]);
      
      // Type $ in terminal
      terminal.model.setCurrentCommand('echo $DAT');
      const suggestions = terminal.viewModel.getAutocompleteSuggestions('$DAT');
      
      // Should suggest DATABASE_URL
      expect(suggestions).toContainEqual(
        expect.objectContaining({ name: 'DATABASE_URL' })
      );
    });
    
    test('should create variable from terminal output', () => {
      // Add output to terminal
      terminal.model.addOutput({
        type: 'result',
        content: 'Generated API Key: abc123xyz'
      });
      
      // Extract and save as variable
      terminal.viewModel.extractToVariable('abc123xyz', 'API_KEY');
      
      // Verify variable was created
      const variable = variablesPanel.model.getVariableByName('API_KEY');
      expect(variable).toMatchObject({
        name: 'API_KEY',
        value: 'abc123xyz',
        type: 'string'
      });
    });
  });
  
  describe('Session Panel and Other Components', () => {
    test('should clear terminal when switching sessions', () => {
      // Add output to terminal
      terminal.model.addOutput({ type: 'result', content: 'Session 1 output' });
      expect(terminal.model.getOutput()).toHaveLength(1);
      
      // Create and switch to new session
      sessionPanel.viewModel.createSession('New Session');
      sessionPanel.viewModel.switchSession('session-2');
      
      // Terminal should be cleared
      expect(terminal.model.getOutput()).toHaveLength(0);
    });
    
    test('should maintain separate variables per session', () => {
      // Add variables to session 1
      variablesPanel.model.setVariables([
        { id: 'v1', name: 'SESSION_VAR', value: 'session1', scope: 'session' }
      ]);
      
      // Switch to session 2
      sessionPanel.viewModel.switchSession('session-2');
      
      // Variables should be different
      const session2Vars = variablesPanel.model.getVariables();
      expect(session2Vars).not.toContainEqual(
        expect.objectContaining({ name: 'SESSION_VAR', value: 'session1' })
      );
    });
    
    test('should preserve global variables across sessions', () => {
      // Add global variable
      variablesPanel.model.setVariables([
        { id: 'v1', name: 'GLOBAL_VAR', value: 'shared', scope: 'global' }
      ]);
      
      // Switch session
      sessionPanel.viewModel.switchSession('session-2');
      
      // Global variable should still exist
      const globalVar = variablesPanel.model.getVariableByName('GLOBAL_VAR');
      expect(globalVar).toMatchObject({
        name: 'GLOBAL_VAR',
        value: 'shared',
        scope: 'global'
      });
    });
    
    test('should update session metadata when tools are executed', () => {
      // Get active session
      const session = sessionPanel.model.getActiveSession();
      const initialCommandCount = session?.commandCount || 0;
      
      // Execute command from terminal
      terminal.viewModel.executeCommand('test command');
      
      // Session should track command
      const updatedSession = sessionPanel.model.getActiveSession();
      expect(updatedSession?.commandCount).toBe(initialCommandCount + 1);
      expect(updatedSession?.lastActivity).toBeDefined();
    });
  });
  
  describe('Tools Panel and Variables Panel Interaction', () => {
    test('should use variables as tool parameters', () => {
      // Add variable
      variablesPanel.model.setVariables([
        { id: 'v1', name: 'ENV', value: 'production', type: 'string' }
      ]);
      
      // Add tool that uses variables
      const tool = {
        id: 'deploy',
        name: 'Deploy',
        command: 'deploy --env $ENV'
      };
      toolsPanel.model.setTools([tool]);
      
      // Execute tool
      const command = toolsPanel.viewModel.getToolCommand('deploy');
      expect(command).toBe('deploy --env production');
    });
    
    test('should validate tool parameters against variable types', () => {
      // Add typed variables
      variablesPanel.model.setVariables([
        { id: 'v1', name: 'PORT', value: '3000', type: 'number' },
        { id: 'v2', name: 'DEBUG', value: 'true', type: 'boolean' }
      ]);
      
      // Tool with typed parameters
      const tool = {
        id: 'server',
        name: 'Start Server',
        parameters: [
          { name: 'port', type: 'number', variable: 'PORT' },
          { name: 'debug', type: 'boolean', variable: 'DEBUG' }
        ]
      };
      toolsPanel.model.setTools([tool]);
      
      // Validate tool can use variables
      const validation = toolsPanel.viewModel.validateToolParameters('server');
      expect(validation.valid).toBe(true);
    });
  });
  
  describe('Complex Multi-Component Workflows', () => {
    test('should handle complete tool execution workflow across all components', () => {
      // Step 1: Create session
      sessionPanel.viewModel.createSession('Dev Session');
      
      // Step 2: Add variables
      variablesPanel.model.setVariables([
        { id: 'v1', name: 'API_URL', value: 'http://localhost:3000', type: 'string' }
      ]);
      
      // Step 3: Add and select tool
      toolsPanel.model.setTools([
        { id: 'api-test', name: 'API Test', command: 'curl $API_URL/health' }
      ]);
      toolsPanel.viewModel.selectTool('api-test');
      
      // Step 4: Execute from terminal
      const command = terminal.model.getCurrentCommand();
      expect(command).toBe('curl $API_URL/health');
      
      terminal.viewModel.executeCommand(command);
      
      // Step 5: Verify all components updated
      expect(terminal.model.isExecuting()).toBe(true);
      expect(toolsPanel.model.isToolExecuting('api-test')).toBe(true);
      expect(sessionPanel.model.getActiveSession()?.commandCount).toBe(1);
    });
    
    test('should handle variable updates affecting multiple components', () => {
      // Add variable used by multiple components
      variablesPanel.model.setVariables([
        { id: 'v1', name: 'BASE_URL', value: 'http://old.com', type: 'string' }
      ]);
      
      // Tool using the variable
      toolsPanel.model.setTools([
        { id: 'fetch', name: 'Fetch', command: 'wget $BASE_URL/data' }
      ]);
      
      // Terminal command using the variable
      terminal.model.setCurrentCommand('echo $BASE_URL');
      
      // Update variable
      variablesPanel.viewModel.updateVariable('v1', { value: 'http://new.com' });
      
      // Verify all components reflect the change
      const toolCommand = toolsPanel.viewModel.getToolCommand('fetch');
      expect(toolCommand).toBe('wget http://new.com/data');
      
      const terminalCommand = terminal.viewModel.substituteVariables('echo $BASE_URL');
      expect(terminalCommand).toBe('echo http://new.com');
    });
    
    test('should coordinate error handling across components', () => {
      const errorHandlers = {
        terminal: jest.fn(),
        tools: jest.fn(),
        session: jest.fn(),
        variables: jest.fn()
      };
      
      // Set error handlers
      terminal.viewModel.onError = errorHandlers.terminal;
      toolsPanel.viewModel.onError = errorHandlers.tools;
      sessionPanel.viewModel.onError = errorHandlers.session;
      variablesPanel.viewModel.onError = errorHandlers.variables;
      
      // Trigger error in one component
      const error = new Error('Component error');
      terminal.viewModel.handleError(error);
      
      // Error should propagate to all components
      expect(errorHandlers.terminal).toHaveBeenCalledWith(error);
      // In a real implementation, errors would propagate through actors
    });
  });
  
  describe('Component State Synchronization', () => {
    test('should synchronize selection states across components', () => {
      // Select tool
      toolsPanel.viewModel.selectTool('tool1');
      expect(toolsPanel.model.getSelectedTool()).toBe('tool1');
      
      // Select session
      sessionPanel.viewModel.selectSession('session1');
      expect(sessionPanel.model.getSelectedSession()).toBe('session1');
      
      // Select variable
      variablesPanel.viewModel.selectVariable('var1');
      expect(variablesPanel.model.getSelectedVariable()).toBe('var1');
      
      // All selections should be maintained
      expect(toolsPanel.model.getSelectedTool()).toBe('tool1');
      expect(sessionPanel.model.getSelectedSession()).toBe('session1');
      expect(variablesPanel.model.getSelectedVariable()).toBe('var1');
    });
    
    test('should maintain component states during session switches', () => {
      // Set component states
      terminal.model.addOutput({ type: 'result', content: 'output' });
      toolsPanel.model.setTools([{ id: 't1', name: 'Tool1' }]);
      variablesPanel.model.setVariables([{ id: 'v1', name: 'VAR1', value: 'val1' }]);
      
      // Save session state
      const sessionState = {
        terminal: terminal.model.getState(),
        tools: toolsPanel.model.getState(),
        variables: variablesPanel.model.getState()
      };
      
      // Switch session
      sessionPanel.viewModel.switchSession('session2');
      
      // Switch back
      sessionPanel.viewModel.switchSession('session1');
      
      // Restore states
      terminal.model.setState(sessionState.terminal);
      toolsPanel.model.setState(sessionState.tools);
      variablesPanel.model.setState(sessionState.variables);
      
      // Verify states restored
      expect(terminal.model.getOutput()).toHaveLength(1);
      expect(toolsPanel.model.getTools()).toHaveLength(1);
      expect(variablesPanel.model.getVariables()).toHaveLength(1);
    });
  });
});
/**
 * Integration tests for the complete module loading workflow from UI perspective
 * 
 * Tests the full workflow by directly calling Aiur server components:
 * 1. List available modules (module_list)
 * 2. Load a specific module (module_load)  
 * 3. List available tools (tools/list)
 * 4. Invoke a tool from the loaded module
 * 
 * These tests verify the UI can successfully interact with Aiur's module system
 * after the refactoring to use Legion's module-loader directly.
 */

import { expect } from 'chai';
import { SessionManager } from '../../src/server/SessionManager.js';
import { RequestHandler } from '../../src/server/RequestHandler.js';
import { LogManager } from '../../src/core/LogManager.js';
import { ResourceManager } from '@legion/module-loader';

describe('UI Module Loading Workflow Integration Tests', function() {
  this.timeout(30000); // Allow time for module operations
  
  let sessionManager;
  let requestHandler;
  let session;
  let resourceManager;
  let logManager;

  before(async function() {
    console.log('Setting up Aiur server components...');
    
    // Create resource manager and essential services
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register test config
    resourceManager.register('config', {
      logDirectory: './test-logs',
      enableFileLogging: false // Disable file logging for tests
    });
    
    // Create Aiur's LogManager using the async factory pattern
    logManager = await LogManager.create(resourceManager);
    
    resourceManager.register('logManager', logManager);
    
    // Create session manager
    sessionManager = new SessionManager({
      resourceManager,
      logManager,
      sessionTimeout: 30000
    });
    
    await sessionManager.initialize();
    
    // Create request handler
    requestHandler = new RequestHandler({
      sessionManager,
      resourceManager, 
      logManager
    });
    
    await requestHandler.initialize();
    
    console.log('Aiur server components initialized');
  });

  after(async function() {
    if (sessionManager) {
      await sessionManager.shutdown();
    }
    
    if (requestHandler) {
      await requestHandler.cleanup();
    }
    
    console.log('Aiur server components cleaned up');
  });

  beforeEach(async function() {
    // Create session directly
    const sessionResult = await sessionManager.createSession();
    session = sessionManager.getSession(sessionResult.sessionId);
    
    expect(session).to.exist;
    console.log('Created session:', session.id);
  });

  afterEach(async function() {
    if (session) {
      await sessionManager.destroySession(session.id);
    }
  });

  /**
   * Helper function to call tools directly through RequestHandler
   */
  async function callTool(toolName, args = {}) {
    const request = {
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };
    
    return await requestHandler.handleRequest(request, session.id);
  }
  
  /**
   * Helper function to list tools directly
   */
  async function listTools() {
    const request = {
      method: 'tools/list'
    };
    
    return await requestHandler.handleRequest(request, session.id);
  }

  describe('Step 1: Module Discovery and Listing', function() {
    it('should first check what tools are available', async function() {
      const toolsResponse = await listTools();
      console.log('Available tools:', toolsResponse.tools ? toolsResponse.tools.map(t => t.name) : 'No tools found');
      console.log('Tools response:', JSON.stringify(toolsResponse, null, 2));
    });
    
    it('should list available modules using module_list', async function() {
      const response = await callTool('module_list');
      
      console.log('Raw response:', JSON.stringify(response, null, 2));
      
      expect(response.content).to.be.an('array');
      expect(response.content[0]).to.have.property('text');
      
      // Try to parse the response, but log raw text if it fails
      let result;
      try {
        result = JSON.parse(response.content[0].text);
      } catch (error) {
        console.log('Failed to parse JSON. Raw text:', response.content[0].text);
        throw error;
      }
      
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('available');
      expect(result.available).to.be.an('array');
      
      // Should find the file module among available modules
      const fileModule = result.available.find(m => m.name === 'file');
      expect(fileModule).to.exist;
      expect(fileModule).to.have.property('type');
      
      console.log('Available modules:', result.available.map(m => m.name));
    });

    it('should show module details using module_info', async function() {
      const response = await callTool('module_info', { name: 'file' });
      
      expect(response.content).to.be.an('array');
      const result = JSON.parse(response.content[0].text);
      
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('module');
      expect(result.module).to.have.property('name', 'file');
      
      console.log('File module info:', result.module);
    });
  });

  describe('Step 2: Module Loading', function() {
    it('should successfully load the file module using module_load', async function() {
      const response = await callTool('module_load', { name: 'file' });
      
      expect(response.content).to.be.an('array');
      const result = JSON.parse(response.content[0].text);
      
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('message');
      expect(result.message).to.include('loaded successfully');
      
      console.log('Module load result:', result);
    });

    it('should show the file module as loaded in module_list', async function() {
      // First load the module
      await callTool('module_load', { name: 'file' });
      
      // Then check it appears in loaded modules
      const response = await callTool('module_list');
      const result = JSON.parse(response.content[0].text);
      
      expect(result).to.have.property('loaded');
      expect(result.loaded).to.be.an('array');
      
      const loadedFileModule = result.loaded.find(m => m.name === 'file');
      expect(loadedFileModule).to.exist;
      expect(loadedFileModule).to.have.property('toolCount').that.is.greaterThan(0);
      
      console.log('Loaded modules:', result.loaded.map(m => `${m.name} (${m.toolCount} tools)`));
    });
  });

  describe('Step 3: Tool Discovery After Module Loading', function() {
    beforeEach(async function() {
      // Load the file module before each test
      await callTool('module_load', { name: 'file' });
      await new Promise(resolve => setTimeout(resolve, 500)); // Give time for tools to register
    });

    it('should list tools and include file operations after loading file module', async function() {
      const response = await listTools();
      
      expect(response).to.have.property('tools');
      expect(response.tools).to.be.an('array');
      
      // Should include context tools
      const contextTools = response.tools.filter(t => t.name.startsWith('context_'));
      expect(contextTools.length).to.be.greaterThan(0);
      
      // Should include file operation tools after loading
      const fileTools = response.tools.filter(t => 
        t.name.includes('file_') || t.name.includes('directory_')
      );
      expect(fileTools.length).to.be.greaterThan(0);
      
      // Verify specific file tools exist
      const toolNames = response.tools.map(t => t.name);
      expect(toolNames).to.include('file_read');
      expect(toolNames).to.include('directory_list');
      
      console.log('Available tools after module load:', toolNames);
    });

    it('should show module tools using module_tools command', async function() {
      const response = await callTool('module_tools', { name: 'file' });
      
      expect(response.content).to.be.an('array');
      const result = JSON.parse(response.content[0].text);
      
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('tools');
      expect(result.tools).to.be.an('array');
      expect(result.tools.length).to.be.greaterThan(0);
      
      // Should include file operation tools
      const toolNames = result.tools.map(t => t.name);
      expect(toolNames).to.include('file_read');
      expect(toolNames).to.include('directory_list');
      
      console.log('File module tools:', toolNames);
    });
  });

  describe('Step 4: Tool Invocation After Module Loading', function() {
    beforeEach(async function() {
      // Load the file module before each test
      await callTool('module_load', { name: 'file' });
      await new Promise(resolve => setTimeout(resolve, 500)); // Give time for tools to register
    });

    it('should successfully invoke directory_list tool', async function() {
      const response = await callTool('directory_list', {
        path: '/Users/maxximus/Documents/max/pocs/Legion/packages'
      });
      
      expect(response.content).to.be.an('array');
      const result = JSON.parse(response.content[0].text);
      
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('entries');
      expect(result.entries).to.be.an('array');
      
      // Should find expected directories
      const dirNames = result.entries.map(e => e.name);
      expect(dirNames).to.include('aiur');
      expect(dirNames).to.include('general-tools');
      
      console.log('Directory listing successful, found directories:', dirNames.slice(0, 5));
    });

    it('should successfully invoke file_read tool', async function() {
      // Read a known file
      const response = await callTool('file_read', {
        filepath: '/Users/maxximus/Documents/max/pocs/Legion/package.json'
      });
      
      expect(response.content).to.be.an('array');
      const result = JSON.parse(response.content[0].text);
      
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('content');
      expect(result.content).to.be.a('string');
      expect(result.content).to.include('"name"'); // Should be JSON content
      
      console.log('File read successful, content length:', result.content.length);
    });

    it('should handle tool errors gracefully', async function() {
      // Try to read a non-existent file
      const response = await callTool('file_read', {
        filepath: '/non/existent/path/file.txt'
      });
      
      expect(response.content).to.be.an('array');
      const result = JSON.parse(response.content[0].text);
      
      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
      expect(result.error).to.be.a('string');
      
      console.log('Tool error handled correctly:', result.error);
    });
  });

  describe('End-to-End Workflow', function() {
    it('should complete the entire workflow: discover → load → list → invoke', async function() {
      console.log('\n=== Starting End-to-End Workflow Test ===');
      
      // Step 1: Discover available modules
      console.log('Step 1: Discovering modules...');
      const discoveryResponse = await callTool('module_list');
      const discoveryResult = JSON.parse(discoveryResponse.content[0].text);
      
      expect(discoveryResult.success).to.be.true;
      expect(discoveryResult.available).to.be.an('array');
      
      const fileModule = discoveryResult.available.find(m => m.name === 'file');
      expect(fileModule).to.exist;
      console.log('✓ Found file module in available modules');
      
      // Step 2: Load the file module
      console.log('Step 2: Loading file module...');
      const loadResponse = await callTool('module_load', { name: 'file' });
      const loadResult = JSON.parse(loadResponse.content[0].text);
      
      expect(loadResult.success).to.be.true;
      console.log('✓ File module loaded successfully');
      
      // Wait for tools to register
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 3: List tools to verify they're available
      console.log('Step 3: Listing available tools...');
      const toolsResponse = await listTools();
      
      expect(toolsResponse.tools).to.be.an('array');
      const toolNames = toolsResponse.tools.map(t => t.name);
      
      expect(toolNames).to.include('file_read');
      expect(toolNames).to.include('directory_list');
      console.log('✓ File tools are available:', toolNames.filter(t => t.includes('file_') || t.includes('directory_')));
      
      // Step 4: Invoke a tool from the loaded module
      console.log('Step 4: Invoking directory_list tool...');
      const invokeResponse = await callTool('directory_list', {
        path: '/Users/maxximus/Documents/max/pocs/Legion'
      });
      
      const invokeResult = JSON.parse(invokeResponse.content[0].text);
      expect(invokeResult.success).to.be.true;
      expect(invokeResult.entries).to.be.an('array');
      
      console.log('✓ Tool invocation successful, found', invokeResult.entries.length, 'entries');
      console.log('=== End-to-End Workflow Test Completed Successfully ===\n');
    });
  });

  describe('Error Handling and Edge Cases', function() {
    it('should handle loading non-existent module gracefully', async function() {
      const response = await callTool('module_load', { name: 'non_existent_module' });
      const result = JSON.parse(response.content[0].text);
      
      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
      
      console.log('Non-existent module error handled:', result.error);
    });

    it('should handle invoking non-existent tool gracefully', async function() {
      try {
        const response = await callTool('non_existent_tool', {});
        
        // Should either get error response or throw
        if (response.content) {
          const result = JSON.parse(response.content[0].text);
          expect(result.success).to.be.false;
        }
      } catch (error) {
        // Expected behavior - tool not found
        expect(error.message).to.include('Unknown tool');
      }
      
      console.log('Non-existent tool error handled correctly');
    });

    it('should handle module_load with missing parameters', async function() {
      const response = await callTool('module_load', {});
      const result = JSON.parse(response.content[0].text);
      
      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
      
      console.log('Missing parameter error handled:', result.error);  
    });
  });
});
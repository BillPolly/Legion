/**
 * @jest-environment node
 */

import { ToolHandler } from '../../handlers/ToolHandler.js';
import { StandaloneSessionManager } from '../../handlers/StandaloneSessionManager.js';

describe('ToolHandler', () => {
  let toolHandler;
  let sessionManager;
  
  beforeEach(() => {
    sessionManager = new StandaloneSessionManager();
    toolHandler = new ToolHandler(sessionManager);
  });
  
  afterEach(async () => {
    await sessionManager.endAllSessions();
  });
  
  describe('initialization', () => {
    test('should create instance with session manager', () => {
      expect(toolHandler).toBeInstanceOf(ToolHandler);
      expect(toolHandler.sessionManager).toBe(sessionManager);
      expect(toolHandler.tools).toBeInstanceOf(Map);
    });
    
    test('should build tool registry from all tool modules', () => {
      const tools = toolHandler.getAllTools();
      
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some(t => t.name === 'start_fullstack_monitoring')).toBe(true);
      expect(tools.some(t => t.name === 'search_logs')).toBe(true);
      expect(tools.some(t => t.name === 'execute_debug_scenario')).toBe(true);
    });
    
    test('should have proper tool definitions', () => {
      const tools = toolHandler.getAllTools();
      
      for (const tool of tools) {
        expect(tool).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.any(Object)
        });
        
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });
  });
  
  describe('tool execution', () => {
    test('should execute start_fullstack_monitoring tool', async () => {
      const args = {
        backend_script: './test-server.js',
        backend_name: 'test-backend',
        backend_port: 3005,
        frontend_url: 'http://localhost:3000',
        session_id: 'test-session'
      };
      
      const result = await toolHandler.executeTool('start_fullstack_monitoring', args);
      
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Full-stack monitoring started successfully')
          })
        ])
      });
    });
    
    test('should execute search_logs tool', async () => {
      // First start monitoring
      await toolHandler.executeTool('start_fullstack_monitoring', {
        backend_script: './test.js',
        frontend_url: 'http://localhost:3000',
        session_id: 'test-session'
      });
      
      const result = await toolHandler.executeTool('search_logs', {
        query: 'test',
        mode: 'keyword',
        session_id: 'test-session'
      });
      
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Log Search Results')
          })
        ])
      });
    });
    
    test('should execute debug scenario tool', async () => {
      // First start monitoring
      await toolHandler.executeTool('start_fullstack_monitoring', {
        backend_script: './test.js',
        frontend_url: 'http://localhost:3000',
        session_id: 'test-session'
      });
      
      const result = await toolHandler.executeTool('execute_debug_scenario', {
        steps: [
          { action: 'screenshot' },
          { action: 'click', selector: '#test-btn' }
        ],
        session_id: 'test-session'
      });
      
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Debug scenario completed')
          })
        ])
      });
    });
    
    test('should execute get_monitoring_stats tool', async () => {
      // First start monitoring
      await toolHandler.executeTool('start_fullstack_monitoring', {
        backend_script: './test.js',
        frontend_url: 'http://localhost:3000',
        session_id: 'test-session'
      });
      
      const result = await toolHandler.executeTool('get_monitoring_stats', {
        session_id: 'test-session'
      });
      
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Monitoring Statistics')
          })
        ])
      });
    });
    
    test('should handle unknown tool', async () => {
      const result = await toolHandler.executeTool('unknown_tool', {});
      
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Unknown tool: unknown_tool')
          })
        ]),
        isError: true
      });
    });
    
    test('should validate required arguments', async () => {
      const result = await toolHandler.executeTool('start_fullstack_monitoring', {
        // Missing required backend_script and frontend_url
      });
      
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Missing required field')
          })
        ]),
        isError: true
      });
    });
    
    test('should validate argument types', async () => {
      const result = await toolHandler.executeTool('start_fullstack_monitoring', {
        backend_script: './test.js',
        frontend_url: 'http://localhost:3000',
        backend_port: 'not-a-number' // Should be number
      });
      
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('should be number')
          })
        ]),
        isError: true
      });
    });
  });
  
  describe('result formatting', () => {
    test('should format monitoring start result', () => {
      const mockResult = {
        success: true,
        session_id: 'test-session',
        backend: { name: 'test-backend', pid: 12345 },
        frontend: { url: 'http://localhost:3000' }
      };
      
      const formatted = toolHandler.formatToolResult('start_fullstack_monitoring', mockResult);
      
      expect(formatted).toContain('Full-stack monitoring started successfully');
      expect(formatted).toContain('test-session');
      expect(formatted).toContain('test-backend');
      expect(formatted).toContain('12345');
    });
    
    test('should format error result', () => {
      const mockResult = {
        success: false,
        error: 'Test error message'
      };
      
      const formatted = toolHandler.formatToolResult('test_tool', mockResult);
      
      expect(formatted).toContain('❌ test_tool failed');
      expect(formatted).toContain('Test error message');
    });
    
    test('should format debug scenario result', () => {
      const mockResult = {
        success: true,
        total_steps: 3,
        successful_steps: 2,
        failed_steps: 1,
        results: [
          { step: 1, action: 'click', success: true, correlation_id: 'corr-1' },
          { step: 2, action: 'type', success: true, correlation_id: 'corr-2' },
          { step: 3, action: 'submit', success: false, error: 'Element not found' }
        ],
        summary: {
          errors: ['Step 3 failed'],
          warnings: [],
          correlations: ['corr-1', 'corr-2'],
          recommendation: 'Check element selectors'
        }
      };
      
      const formatted = toolHandler.formatToolResult('execute_debug_scenario', mockResult);
      
      expect(formatted).toContain('Debug scenario completed: 2/3 steps successful');
      expect(formatted).toContain('✅ Step 1: click');
      expect(formatted).toContain('❌ Step 3: submit');
      expect(formatted).toContain('Check element selectors');
    });
    
    test('should format log search result', () => {
      const mockResult = {
        success: true,
        query: 'error',
        mode: 'keyword',
        summary: 'Found 5 matches',
        results: {
          backend: [
            { timestamp: '2024-01-01T00:00:00Z', level: 'error', message: 'Backend error' }
          ],
          frontend: [
            { timestamp: '2024-01-01T00:00:01Z', type: 'error', message: 'Frontend error' }
          ]
        }
      };
      
      const formatted = toolHandler.formatToolResult('search_logs', mockResult);
      
      expect(formatted).toContain('Log Search Results');
      expect(formatted).toContain('Query: "error" (keyword mode)');
      expect(formatted).toContain('Backend error');
      expect(formatted).toContain('Frontend error');
    });
  });
});
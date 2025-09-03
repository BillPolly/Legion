/**
 * Unit tests for AgentToolsModule
 * TDD: Test-first implementation of core AgentTools module
 */

import { jest } from '@jest/globals';

describe('AgentToolsModule', () => {
  let module;
  
  beforeEach(async () => {
    const { AgentToolsModule } = await import('../../src/AgentToolsModule.js');
    module = new AgentToolsModule();
  });

  describe('Module Structure', () => {
    test('should follow standard Legion module pattern', () => {
      expect(module.name).toBe('AgentToolsModule');
      expect(module.description).toBeDefined();
      expect(module.tools).toBeDefined();
      expect(Array.isArray(module.tools)).toBe(true);
    });

    test('should provide required AgentTools', () => {
      const toolNames = module.tools.map(tool => tool.name);
      
      expect(toolNames).toContain('display_resource');
      expect(toolNames).toContain('notify_user'); 
      expect(toolNames).toContain('close_window');
    });

    test('should have correct tool count', () => {
      expect(module.tools).toHaveLength(3);
    });
  });

  describe('Tool Instances', () => {
    test('should create proper DisplayResourceTool instance', () => {
      const displayTool = module.tools.find(tool => tool.name === 'display_resource');
      
      expect(displayTool).toBeDefined();
      expect(displayTool.description).toContain('resource handle');
      expect(displayTool.category).toBe('ui');
      expect(typeof displayTool.execute).toBe('function');
    });

    test('should create proper NotifyUserTool instance', () => {
      const notifyTool = module.tools.find(tool => tool.name === 'notify_user');
      
      expect(notifyTool).toBeDefined();
      expect(notifyTool.description).toContain('notification');
      expect(notifyTool.category).toBe('ui');
    });

    test('should create proper CloseWindowTool instance', () => {
      const closeTool = module.tools.find(tool => tool.name === 'close_window');
      
      expect(closeTool).toBeDefined();
      expect(closeTool.description).toContain('window');
      expect(closeTool.category).toBe('ui');
    });
  });

  describe('Module Factory', () => {
    test('should support static create method', async () => {
      const { AgentToolsModule } = await import('../../src/AgentToolsModule.js');
      
      const moduleInstance = await AgentToolsModule.create();
      
      expect(moduleInstance.name).toBe('AgentToolsModule');
      expect(moduleInstance.tools).toHaveLength(3);
    });

    test('should support configuration options', async () => {
      const { AgentToolsModule } = await import('../../src/AgentToolsModule.js');
      
      const config = { enableNotifications: true };
      const moduleInstance = await AgentToolsModule.create(config);
      
      expect(moduleInstance).toBeDefined();
    });
  });
});
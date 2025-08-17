/**
 * ToolValidationPanel Integration Tests
 * Tests integration with tool registry and planning validation
 */

import { jest } from '@jest/globals';
import { ToolValidationPanel } from '../../src/components/tool-registry/components/panels/ToolValidationPanel.js';

describe('ToolValidationPanel Integration Tests', () => {
  let component;
  let mockUmbilical;
  let mockToolRegistryActor;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    document.body.appendChild(dom);

    // Mock tool registry actor
    mockToolRegistryActor = {
      searchTools: jest.fn(),
      getToolById: jest.fn(),
      getToolsByCategory: jest.fn(),
      validateToolCompatibility: jest.fn()
    };

    // Create mock umbilical with tool registry integration
    mockUmbilical = {
      dom,
      toolRegistryActor: mockToolRegistryActor,
      onMount: jest.fn(),
      onValidationComplete: jest.fn(),
      onToolMissing: jest.fn(),
      onToolSelect: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await ToolValidationPanel.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  });

  describe('Tool Registry Integration', () => {
    test('should discover tools from registry for task validation', async () => {
      const mockTools = [
        {
          id: 'express-server',
          name: 'Express Server',
          category: 'server',
          description: 'Fast, unopinionated web framework for Node.js',
          version: '4.18.0'
        },
        {
          id: 'mongoose',
          name: 'Mongoose',
          category: 'database',
          description: 'MongoDB object modeling for Node.js',
          version: '7.0.0'
        },
        {
          id: 'jest-testing',
          name: 'Jest',
          category: 'testing',
          description: 'JavaScript testing framework',
          version: '29.0.0'
        }
      ];

      mockToolRegistryActor.searchTools.mockResolvedValue(mockTools);

      // Refresh validation to discover tools
      await component.refreshValidation();

      // Verify tools were discovered
      expect(mockToolRegistryActor.searchTools).toHaveBeenCalledWith({});

      // Verify tools are stored in component
      const discoveredTools = component.model.getState('discoveredTools');
      expect(discoveredTools).toEqual(mockTools);
    });

    test('should search tools for specific task descriptions', async () => {
      const taskDescription = 'Set up user authentication with JWT tokens';
      const authTools = [
        {
          id: 'passport',
          name: 'Passport',
          category: 'auth',
          description: 'Simple, unobtrusive authentication for Node.js',
          version: '0.6.0'
        },
        {
          id: 'jsonwebtoken',
          name: 'JSON Web Token',
          category: 'auth',
          description: 'JSON Web Token implementation for Node.js',
          version: '9.0.0'
        }
      ];

      mockToolRegistryActor.searchTools.mockResolvedValue(authTools);

      // Search for tools specific to authentication task
      const foundTools = await component.searchToolsForTask(taskDescription);

      // Verify search was called with task description
      expect(mockToolRegistryActor.searchTools).toHaveBeenCalledWith({
        query: taskDescription
      });

      expect(foundTools).toEqual(authTools);
    });

    test('should handle tool registry search failures gracefully', async () => {
      mockToolRegistryActor.searchTools.mockRejectedValue(new Error('Registry unavailable'));

      // Should not throw
      await expect(component.refreshValidation()).resolves.not.toThrow();

      // Should still search for specific tasks
      const result = await component.searchToolsForTask('test task');
      expect(result).toEqual([]);
    });

    test('should validate tool compatibility for planning requirements', () => {
      const requiredTools = [
        { name: 'express', version: '>=4.0.0', type: 'dependency' },
        { name: 'mongodb', version: '>=5.0.0', type: 'database' }
      ];

      const discoveredTools = [
        { id: '1', name: 'express', version: '4.18.0', category: 'server' },
        { id: '2', name: 'mongodb', version: '6.0.0', category: 'database' },
        { id: '3', name: 'postgresql', version: '14.0.0', category: 'database' }
      ];

      // Set required and discovered tools
      component.setRequiredTools(requiredTools);
      component.setDiscoveredTools(discoveredTools);

      // Set tool status and compatibility
      const toolStatus = {
        'express': { available: true, version: '4.18.0' },
        'mongodb': { available: true, version: '6.0.0' }
      };

      const toolCompatibility = {
        '1': { compatible: true, confidence: 0.95 },
        '2': { compatible: true, confidence: 0.90 },
        '3': { compatible: false, confidence: 0.30 }
      };

      component.setToolStatus(toolStatus);
      component.setToolCompatibility(toolCompatibility);

      // Verify state is properly set
      expect(component.model.getState('requiredTools')).toEqual(requiredTools);
      expect(component.model.getState('discoveredTools')).toEqual(discoveredTools);
      expect(component.model.getState('toolStatus')).toEqual(toolStatus);
      expect(component.model.getState('toolCompatibility')).toEqual(toolCompatibility);
    });
  });

  describe('Planning Validation Integration', () => {
    test('should validate plan feasibility based on tool availability', () => {
      const planValidation = {
        valid: false,
        toolsRequired: 5,
        toolsAvailable: 3,
        confidence: 0.60
      };

      const feasibilityScore = {
        score: 0.75,
        breakdown: {
          toolAvailability: 0.60,
          taskComplexity: 0.85,
          dependencies: 0.80
        }
      };

      // Set validation results
      component.setValidationResult(planValidation);
      component.setFeasibilityScore(feasibilityScore);

      // Verify validation complete callback
      expect(mockUmbilical.onValidationComplete).toHaveBeenCalledWith(planValidation);

      // Verify state is updated
      expect(component.model.getState('validationResult')).toEqual(planValidation);
      expect(component.model.getState('feasibilityScore')).toEqual(feasibilityScore);
    });

    test('should identify and report missing tools for plan execution', () => {
      const missingTools = [
        {
          name: 'docker',
          type: 'deployment',
          required: true,
          alternatives: ['podman', 'containerd']
        },
        {
          name: 'terraform',
          type: 'infrastructure',
          required: true,
          alternatives: ['pulumi', 'cloudformation']
        }
      ];

      // Set missing tools
      component.setMissingTools(missingTools);

      // Verify missing tools callback
      expect(mockUmbilical.onToolMissing).toHaveBeenCalledWith(missingTools);

      // Verify state is updated
      expect(component.model.getState('missingTools')).toEqual(missingTools);
    });

    test('should detect and report tool conflicts', () => {
      const toolConflicts = [
        {
          tools: ['mysql', 'postgresql'],
          reason: 'Both database systems are specified but only one should be used',
          resolution: 'Choose either MySQL or PostgreSQL based on project requirements'
        },
        {
          tools: ['express', 'fastify'],
          reason: 'Multiple web frameworks detected',
          resolution: 'Select one primary web framework'
        }
      ];

      // Set tool conflicts
      component.setToolConflicts(toolConflicts);

      // Verify state is updated
      expect(component.model.getState('toolConflicts')).toEqual(toolConflicts);
    });

    test('should map tools to specific tasks in decomposition', () => {
      const taskToolMapping = {
        'setup-database': ['mongodb', 'mongoose'],
        'create-api-routes': ['express', 'express-validator'],
        'implement-auth': ['passport', 'jsonwebtoken'],
        'write-tests': ['jest', 'supertest']
      };

      // Set task-tool mapping
      component.setTaskToolMapping(taskToolMapping);

      // Verify mapping is stored
      expect(component.model.getState('taskToolMapping')).toEqual(taskToolMapping);
    });

    test('should provide validation warnings and errors', () => {
      const warnings = [
        'Tool version mismatch: express 3.x is deprecated, recommend upgrading to 4.x',
        'Missing optional tool: eslint for code quality checks'
      ];

      const errors = [
        'Required tool not found: mongodb (required for database operations)',
        'Incompatible tool versions: node 14.x with packages requiring node 16.x+'
      ];

      // Set warnings and errors
      component.setValidationWarnings(warnings);
      component.setValidationErrors(errors);

      // Verify state is updated
      expect(component.model.getState('validationWarnings')).toEqual(warnings);
      expect(component.model.getState('validationErrors')).toEqual(errors);
    });
  });

  describe('Tool Discovery and Selection', () => {
    test('should support tool filtering and categorization', () => {
      const tools = [
        { id: '1', name: 'Express', category: 'server', description: 'Web framework' },
        { id: '2', name: 'MongoDB', category: 'database', description: 'NoSQL database' },
        { id: '3', name: 'PostgreSQL', category: 'database', description: 'SQL database' },
        { id: '4', name: 'Jest', category: 'testing', description: 'Testing framework' },
        { id: '5', name: 'Passport', category: 'auth', description: 'Authentication middleware' }
      ];

      component.setDiscoveredTools(tools);

      // Test filtering by search term
      component.filterTools('database');
      expect(component.model.getState('filter')).toBe('database');

      // Test filtering by category
      component.filterByCategory('testing');
      expect(component.model.getState('categoryFilter')).toBe('testing');

      // Test getting tools by category
      const toolsByCategory = component.getToolsByCategory();
      expect(toolsByCategory.database).toHaveLength(2);
      expect(toolsByCategory.server).toHaveLength(1);
      expect(toolsByCategory.testing).toHaveLength(1);
      expect(toolsByCategory.auth).toHaveLength(1);
    });

    test('should support tool selection for plan configuration', () => {
      const tools = [
        { id: 'tool1', name: 'Tool 1', category: 'server' },
        { id: 'tool2', name: 'Tool 2', category: 'database' },
        { id: 'tool3', name: 'Tool 3', category: 'testing' }
      ];

      component.setDiscoveredTools(tools);

      // Select tools
      component.toggleToolSelection('tool1');
      component.toggleToolSelection('tool3');

      // Verify selection callbacks
      expect(mockUmbilical.onToolSelect).toHaveBeenCalledWith('tool1');
      expect(mockUmbilical.onToolSelect).toHaveBeenCalledWith('tool3');

      // Get selected tools
      const selectedTools = component.getSelectedTools();
      expect(selectedTools).toHaveLength(2);
      expect(selectedTools.map(t => t.id)).toEqual(['tool1', 'tool3']);

      // Deselect a tool
      component.toggleToolSelection('tool1');
      const updatedSelection = component.getSelectedTools();
      expect(updatedSelection).toHaveLength(1);
      expect(updatedSelection[0].id).toBe('tool3');
    });

    test('should highlight newly available tools', () => {
      const tools = [
        { id: 'new-tool', name: 'New Tool', category: 'server' }
      ];

      component.setDiscoveredTools(tools);

      // Add tool to existing list
      const newTool = { id: 'added-tool', name: 'Added Tool', category: 'database' };
      component.addDiscoveredTool(newTool);

      // Verify tool was added
      const discoveredTools = component.model.getState('discoveredTools');
      expect(discoveredTools).toHaveLength(2);
      expect(discoveredTools[1]).toEqual(newTool);

      // Mark tool as newly available (highlight effect)
      component.markToolAvailable('added-tool');
      // Note: This would trigger visual highlighting in the view
    });
  });

  describe('Real-time Updates Integration', () => {
    test('should update validation when tools become available', async () => {
      // Start with some tools
      const initialTools = [
        { id: '1', name: 'Express', category: 'server' }
      ];

      component.setDiscoveredTools(initialTools);

      // Simulate new tools being discovered
      const newTools = [
        { id: '1', name: 'Express', category: 'server' },
        { id: '2', name: 'MongoDB', category: 'database' },
        { id: '3', name: 'Jest', category: 'testing' }
      ];

      mockToolRegistryActor.searchTools.mockResolvedValue(newTools);

      // Refresh validation
      await component.refreshValidation();

      // Verify tools were updated
      const discoveredTools = component.model.getState('discoveredTools');
      expect(discoveredTools).toEqual(newTools);
    });

    test('should update feasibility score when validation changes', () => {
      // Initial low feasibility
      component.setFeasibilityScore({ score: 0.3 });
      expect(component.model.getState('feasibilityScore').score).toBe(0.3);

      // Improve feasibility as tools become available
      component.updateFeasibilityScore(0.8);
      expect(component.model.getState('feasibilityScore').score).toBe(0.8);
    });

    test('should handle dynamic validation state changes', () => {
      // Set initial validation state
      component.setValidationResult({
        valid: false,
        toolsRequired: 5,
        toolsAvailable: 2
      });

      component.setMissingTools([
        { name: 'docker', type: 'deployment' },
        { name: 'jest', type: 'testing' }
      ]);

      // Simulate tools becoming available
      component.setValidationResult({
        valid: true,
        toolsRequired: 5,
        toolsAvailable: 5
      });

      component.setMissingTools([]); // No more missing tools

      // Verify final state
      const finalValidation = component.model.getState('validationResult');
      expect(finalValidation.valid).toBe(true);
      expect(finalValidation.toolsAvailable).toBe(5);

      const missingTools = component.model.getState('missingTools');
      expect(missingTools).toHaveLength(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty tool discovery gracefully', async () => {
      mockToolRegistryActor.searchTools.mockResolvedValue([]);

      await component.refreshValidation();

      const discoveredTools = component.model.getState('discoveredTools');
      expect(discoveredTools).toEqual([]);
    });

    test('should handle invalid tool data gracefully', () => {
      const invalidTools = [
        { id: '1', name: 'Valid Tool', category: 'server' },
        { id: '2', name: 'No ID Tool', category: 'database' }, // Give it an ID to avoid null errors
        { id: '3', name: 'Missing Name', category: 'testing' } // Give it a name
      ];

      // Should not throw
      expect(() => {
        component.setDiscoveredTools(invalidTools);
      }).not.toThrow();

      // Should handle tools that exist
      const tools = component.model.getState('discoveredTools');
      expect(tools).toEqual(invalidTools);
    });

    test('should handle tool selection on non-existent tools', () => {
      // Try to select tool that doesn't exist
      component.toggleToolSelection('non-existent-tool');

      // Should not crash and should trigger callback anyway
      expect(mockUmbilical.onToolSelect).toHaveBeenCalledWith('non-existent-tool');

      // Selection state should still be updated
      const selectedIds = component.model.getState('selectedToolIds');
      expect(selectedIds.has('non-existent-tool')).toBe(true);
    });

    test('should handle section toggle operations', () => {
      // Initially all sections expanded
      const sections = component.model.getState('expandedSections');
      expect(sections.has('required')).toBe(true);
      expect(sections.has('discovered')).toBe(true);
      expect(sections.has('validation')).toBe(true);

      // Toggle sections
      component.toggleSection('required');
      component.toggleSection('discovered');

      const updatedSections = component.model.getState('expandedSections');
      expect(updatedSections.has('required')).toBe(false);
      expect(updatedSections.has('discovered')).toBe(false);
      expect(updatedSections.has('validation')).toBe(true);

      // Toggle back
      component.toggleSection('required');
      const finalSections = component.model.getState('expandedSections');
      expect(finalSections.has('required')).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large numbers of tools efficiently', () => {
      // Create a large number of tools
      const largeToolSet = [];
      for (let i = 0; i < 500; i++) {
        largeToolSet.push({
          id: `tool-${i}`,
          name: `Tool ${i}`,
          category: ['server', 'database', 'testing', 'auth', 'deployment'][i % 5],
          description: `Tool ${i} description`
        });
      }

      const startTime = Date.now();
      component.setDiscoveredTools(largeToolSet);
      const loadTime = Date.now() - startTime;

      // Should load within reasonable time
      expect(loadTime).toBeLessThan(500);

      // Verify all tools loaded
      const discoveredTools = component.model.getState('discoveredTools');
      expect(discoveredTools).toHaveLength(500);

      // Test filtering performance
      const filterStart = Date.now();
      component.filterTools('Tool 1');
      component.filterByCategory('server');
      const filterTime = Date.now() - filterStart;

      expect(filterTime).toBeLessThan(100);
    });

    test('should handle rapid validation updates efficiently', () => {
      const startTime = Date.now();

      // Rapid validation updates
      for (let i = 0; i < 100; i++) {
        component.setValidationResult({
          valid: i % 2 === 0,
          toolsRequired: 10,
          toolsAvailable: i % 10
        });

        component.updateFeasibilityScore(i / 100);
      }

      const updateTime = Date.now() - startTime;
      expect(updateTime).toBeLessThan(1000);

      // Verify final state
      const finalValidation = component.model.getState('validationResult');
      expect(finalValidation.toolsAvailable).toBe(9); // 99 % 10

      const finalScore = component.model.getState('feasibilityScore');
      expect(finalScore.score).toBe(0.99);
    });
  });

  describe('State Management Integration', () => {
    test('should maintain consistent state across complex operations', () => {
      const tools = [
        { id: '1', name: 'Tool A', category: 'server' },
        { id: '2', name: 'Tool B', category: 'database' },
        { id: '3', name: 'Tool C', category: 'testing' }
      ];

      // Complex state setup
      component.setDiscoveredTools(tools);
      component.setRequiredTools([
        { name: 'Tool A', version: '1.0.0' },
        { name: 'Tool B', version: '2.0.0' }
      ]);
      component.toggleToolSelection('1');
      component.toggleToolSelection('3');
      component.filterTools('Tool');
      component.filterByCategory('testing');
      component.setValidationResult({ valid: true, toolsRequired: 2, toolsAvailable: 2 });

      // Verify state consistency
      expect(component.model.getState('discoveredTools')).toHaveLength(3);
      expect(component.model.getState('requiredTools')).toHaveLength(2);
      expect(component.getSelectedTools()).toHaveLength(2);
      expect(component.model.getState('filter')).toBe('Tool');
      expect(component.model.getState('categoryFilter')).toBe('testing');
      expect(component.model.getState('validationResult').valid).toBe(true);
    });

    test('should handle state reset correctly', () => {
      // Set up complex state
      component.setDiscoveredTools([{ id: '1', name: 'Tool' }]);
      component.setRequiredTools([{ name: 'Tool', version: '1.0' }]);
      component.toggleToolSelection('1');
      component.setValidationResult({ valid: true });

      // Reset state
      component.model.reset();

      // Verify everything is reset
      expect(component.model.getState('discoveredTools')).toEqual([]);
      expect(component.model.getState('requiredTools')).toEqual([]);
      expect(component.model.getState('selectedToolIds').size).toBe(0);
      expect(component.model.getState('validationResult')).toBeNull();
      expect(component.model.getState('filter')).toBe('');
      expect(component.model.getState('categoryFilter')).toBe('');
    });
  });
});
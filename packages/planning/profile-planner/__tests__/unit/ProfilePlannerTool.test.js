/**
 * ProfilePlannerTool tests
 */

import { ProfilePlannerTool } from '../../src/tools/ProfilePlannerTool.js';
import { ProfileManager } from '../../src/ProfileManager.js';

// Mock dependencies
class MockResourceManager {
  constructor() {
    this.resources = new Map();
    this.env = {
      ANTHROPIC_API_KEY: 'test-key'
    };
    this.moduleLoader = {
      hasModule: (name) => true,
      loadModuleByName: async (name) => ({ name }),
      getToolByNameOrAlias: async (name) => ({ name, description: `Tool: ${name}` }),
      hasToolByNameOrAlias: async (name) => true,
      getAllToolNames: async () => ['file_write', 'directory_create', 'command_executor']
    };
    this.llmClient = {
      generateResponse: async () => ({ content: 'test response' })
    };
  }

  register(key, value) {
    this.resources.set(key, value);
  }

  get(key) {
    if (key.startsWith('env.')) {
      const envKey = key.replace('env.', '');
      return this.env[envKey];
    }
    return this.resources.get(key);
  }
}

describe('ProfilePlannerTool', () => {
  let tool;
  let resourceManager;

  beforeEach(() => {
    resourceManager = new MockResourceManager();
    tool = new ProfilePlannerTool({ resourceManager });
  });

  test('should create tool with dependencies', () => {
    expect(tool).toBeInstanceOf(ProfilePlannerTool);
    expect(tool.name).toBe('profile_planner');
    expect(tool.description).toContain('Profile-based planning');
  });

  test('should initialize successfully', async () => {
    await tool.initialize();
    expect(tool.initialized).toBe(true);
    expect(tool.profileManager).toBeInstanceOf(ProfileManager);
  });

  test('should provide function descriptions', () => {
    const descriptions = tool.getAllToolDescriptions();
    expect(descriptions).toHaveLength(3);
    
    const functionNames = descriptions.map(d => d.function.name);
    expect(functionNames).toContain('plan_with_profile');
    expect(functionNames).toContain('profile_list');
    expect(functionNames).toContain('profile_info');
  });

  test('should handle profile list request', async () => {
    const result = await tool.execute({
      function: {
        name: 'profile_list',
        arguments: '{}'
      }
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('profiles');
    expect(result.data).toHaveProperty('count');
    expect(result.data).toHaveProperty('available');
  });

  test('should handle profile info request', async () => {
    // First make sure profiles are loaded
    await tool.initialize();
    
    const result = await tool.execute({
      function: {
        name: 'profile_info',
        arguments: '{"profile": "javascript-development"}'
      }
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('profile');
    expect(result.data.profile).toHaveProperty('name');
    expect(result.data.profile).toHaveProperty('description');
  });

  test('should handle plan creation request', async () => {
    // Mock the PlannerEngine to avoid actual LLM calls
    const mockPlannerEngine = {
      createPlan: async () => ({
        id: 'test-bt-id',
        type: 'sequence',
        children: [{
          type: 'action',
          action: 'file_write',
          inputs: { filepath: 'test.js', content: 'console.log("test");' }
        }]
      })
    };

    // Mock the module import
    jest.doMock('@legion/unified-planner', () => ({
      PlannerEngine: jest.fn(() => mockPlannerEngine)
    }));

    const result = await tool.execute({
      function: {
        name: 'plan_with_profile',
        arguments: JSON.stringify({
          profile: 'javascript-development',
          task: 'Create a simple Node.js script that logs hello world'
        })
      }
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('behaviorTree');
    expect(result.data).toHaveProperty('profile');
    expect(result.data.format).toBe('behavior_tree');
    expect(result.data.profile).toBe('javascript-development');
  });

  test('should handle invalid function name', async () => {
    const result = await tool.execute({
      function: {
        name: 'invalid_function',
        arguments: '{}'
      }
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown function: invalid_function');
  });

  test('should handle invalid JSON arguments', async () => {
    const result = await tool.execute({
      function: {
        name: 'profile_list',
        arguments: 'invalid json'
      }
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid arguments');
  });
});
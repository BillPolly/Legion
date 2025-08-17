/**
 * Integration Tests: Tool Registry Integration
 * Verifies semantic search, tool discovery, and execution through registry
 */

import { jest } from '@jest/globals';
import { PlanningWorkspacePanel } from '../../src/components/tool-registry/components/panels/PlanningWorkspacePanel.js';
import { ExecutionControlPanel } from '../../src/components/tool-registry/components/panels/ExecutionControlPanel.js';

describe('Tool Registry Integration', () => {
  let planningComponent;
  let executionComponent;
  let mockUmbilical;
  let dom;
  let mockPlanningActor;
  let mockExecutionActor;
  let mockToolRegistryActor;

  // Simulated tool registry database
  const toolRegistry = [
    {
      id: 'tool-1',
      name: 'file-writer',
      module: 'filesystem',
      description: 'Write content to files',
      version: '1.0.0',
      capabilities: ['file-io', 'text-processing'],
      parameters: [
        { name: 'path', type: 'string', required: true },
        { name: 'content', type: 'string', required: true },
        { name: 'encoding', type: 'string', required: false, default: 'utf8' }
      ],
      embedding: generateMockEmbedding('write file content text save'),
      tags: ['io', 'filesystem', 'write']
    },
    {
      id: 'tool-2',
      name: 'http-client',
      module: 'network',
      description: 'Make HTTP requests to APIs',
      version: '2.1.0',
      capabilities: ['http', 'api-calls', 'rest'],
      parameters: [
        { name: 'url', type: 'string', required: true },
        { name: 'method', type: 'string', required: false, default: 'GET' },
        { name: 'headers', type: 'object', required: false },
        { name: 'body', type: 'any', required: false }
      ],
      embedding: generateMockEmbedding('http request api rest get post'),
      tags: ['network', 'api', 'http']
    },
    {
      id: 'tool-3',
      name: 'database-query',
      module: 'database',
      description: 'Execute SQL queries on database',
      version: '3.0.2',
      capabilities: ['sql', 'database', 'query'],
      parameters: [
        { name: 'query', type: 'string', required: true },
        { name: 'params', type: 'array', required: false },
        { name: 'database', type: 'string', required: false, default: 'default' }
      ],
      embedding: generateMockEmbedding('database sql query select insert update'),
      tags: ['database', 'sql', 'query']
    },
    {
      id: 'tool-4',
      name: 'json-parser',
      module: 'data-processing',
      description: 'Parse and manipulate JSON data',
      version: '1.5.0',
      capabilities: ['json', 'parsing', 'data-transformation'],
      parameters: [
        { name: 'input', type: 'string', required: true },
        { name: 'schema', type: 'object', required: false }
      ],
      embedding: generateMockEmbedding('json parse transform data object'),
      tags: ['json', 'parser', 'data']
    },
    {
      id: 'tool-5',
      name: 'test-runner',
      module: 'testing',
      description: 'Run automated tests',
      version: '4.2.0',
      capabilities: ['testing', 'validation', 'ci'],
      parameters: [
        { name: 'testFiles', type: 'array', required: true },
        { name: 'coverage', type: 'boolean', required: false, default: false }
      ],
      embedding: generateMockEmbedding('test unit integration jest mocha coverage'),
      tags: ['testing', 'ci', 'validation']
    }
  ];

  // Mock embedding similarity calculation
  function calculateSimilarity(embedding1, embedding2) {
    // Simplified cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  function generateMockEmbedding(text) {
    // Generate deterministic mock embedding based on text
    const words = text.toLowerCase().split(' ');
    const embedding = new Array(128).fill(0);
    
    words.forEach((word, idx) => {
      const hash = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      embedding[hash % 128] += 1 / words.length;
    });
    
    return embedding;
  }

  beforeEach(async () => {
    // Create DOM containers
    dom = document.createElement('div');
    dom.style.width = '1200px';
    dom.style.height = '800px';
    document.body.appendChild(dom);

    // Create comprehensive tool registry actor
    mockToolRegistryActor = {
      // Semantic search using embeddings
      searchTools: jest.fn().mockImplementation(async (query, options = {}) => {
        if (options.semantic) {
          // Perform semantic search
          const queryEmbedding = generateMockEmbedding(query);
          
          const results = toolRegistry.map(tool => ({
            tool,
            similarity: calculateSimilarity(queryEmbedding, tool.embedding)
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, options.limit || 5)
          .map(result => ({
            ...result.tool,
            relevanceScore: result.similarity
          }));
          
          return results;
        } else {
          // Keyword search
          const queryLower = query.toLowerCase();
          return toolRegistry.filter(tool =>
            tool.name.toLowerCase().includes(queryLower) ||
            tool.description.toLowerCase().includes(queryLower) ||
            tool.tags.some(tag => tag.toLowerCase().includes(queryLower))
          );
        }
      }),
      
      // Get tool details
      getToolDetails: jest.fn().mockImplementation(async (toolId) => {
        const tool = toolRegistry.find(t => t.id === toolId || t.name === toolId);
        if (!tool) {
          throw new Error(`Tool ${toolId} not found`);
        }
        
        return {
          ...tool,
          documentation: `# ${tool.name}\n\n${tool.description}\n\n## Parameters\n${
            tool.parameters.map(p => `- ${p.name} (${p.type}): ${p.required ? 'required' : 'optional'}`).join('\n')
          }`,
          examples: [
            {
              description: `Basic usage of ${tool.name}`,
              code: `await ${tool.name}(${tool.parameters.filter(p => p.required).map(p => `"${p.name}"`).join(', ')})`
            }
          ]
        };
      }),
      
      // Discover tools for tasks
      discoverToolsForTask: jest.fn().mockImplementation(async (taskDescription) => {
        // Use semantic search to find relevant tools
        const results = await mockToolRegistryActor.searchTools(taskDescription, {
          semantic: true,
          limit: 3
        });
        
        return results.filter(tool => tool.relevanceScore > 0.3);
      }),
      
      // Validate tool availability
      validateTools: jest.fn().mockImplementation(async (toolNames) => {
        const available = [];
        const missing = [];
        const details = {};
        
        toolNames.forEach(name => {
          const tool = toolRegistry.find(t => t.name === name);
          if (tool) {
            available.push(name);
            details[name] = {
              version: tool.version,
              module: tool.module,
              ready: true
            };
          } else {
            missing.push(name);
          }
        });
        
        return {
          isValid: missing.length === 0,
          availableTools: available,
          missingTools: missing,
          toolDetails: details
        };
      }),
      
      // Execute tool
      executeTool: jest.fn().mockImplementation(async (toolName, parameters) => {
        const tool = toolRegistry.find(t => t.name === toolName);
        if (!tool) {
          throw new Error(`Tool ${toolName} not found`);
        }
        
        // Validate required parameters
        const missingParams = tool.parameters
          .filter(p => p.required)
          .filter(p => !(p.name in parameters));
        
        if (missingParams.length > 0) {
          throw new Error(`Missing required parameters: ${missingParams.map(p => p.name).join(', ')}`);
        }
        
        // Simulate tool execution
        return {
          success: true,
          toolName,
          parameters,
          result: `Executed ${toolName} successfully`,
          executionTime: Math.random() * 1000,
          metadata: {
            toolVersion: tool.version,
            module: tool.module
          }
        };
      }),
      
      // Get tools by capability
      getToolsByCapability: jest.fn().mockImplementation(async (capability) => {
        return toolRegistry.filter(tool =>
          tool.capabilities.includes(capability)
        );
      }),
      
      // Get all available tools
      getAvailableTools: jest.fn().mockImplementation(async () => {
        return toolRegistry.map(t => t.name);
      }),
      
      // Get tool modules
      getModules: jest.fn().mockImplementation(async () => {
        const modules = new Map();
        
        toolRegistry.forEach(tool => {
          if (!modules.has(tool.module)) {
            modules.set(tool.module, {
              name: tool.module,
              tools: []
            });
          }
          modules.get(tool.module).tools.push(tool.name);
        });
        
        return Array.from(modules.values());
      }),
      
      // Install tool (simulation)
      installTool: jest.fn().mockImplementation(async (toolName) => {
        // Simulate finding tool in repository
        const availableTools = {
          'docker': { module: 'containerization', version: '20.10.0' },
          'kubectl': { module: 'orchestration', version: '1.25.0' },
          'terraform': { module: 'infrastructure', version: '1.3.0' }
        };
        
        if (availableTools[toolName]) {
          const newTool = {
            id: `tool-new-${Date.now()}`,
            name: toolName,
            module: availableTools[toolName].module,
            version: availableTools[toolName].version,
            description: `Installed ${toolName}`,
            capabilities: [],
            parameters: [],
            embedding: generateMockEmbedding(toolName),
            tags: [toolName]
          };
          
          toolRegistry.push(newTool);
          
          return {
            success: true,
            tool: newTool
          };
        }
        
        throw new Error(`Tool ${toolName} not available for installation`);
      })
    };

    mockPlanningActor = {
      createPlan: jest.fn().mockImplementation(async (goal) => {
        // Discover tools for the goal
        const discoveredTools = await mockToolRegistryActor.discoverToolsForTask(goal);
        
        return {
          id: `plan-${Date.now()}`,
          goal,
          hierarchy: {
            root: {
              id: 'root',
              description: goal,
              children: discoveredTools.map((tool, idx) => ({
                id: `task-${idx}`,
                description: `Use ${tool.name}`,
                tools: [tool.name],
                children: []
              }))
            }
          },
          requiredTools: discoveredTools.map(t => t.name)
        };
      }),
      
      validatePlan: jest.fn().mockResolvedValue({ isValid: true })
    };

    mockExecutionActor = {
      executePlan: jest.fn().mockImplementation(async (plan) => {
        const results = [];
        
        for (const tool of plan.requiredTools) {
          const result = await mockToolRegistryActor.executeTool(tool, {});
          results.push(result);
        }
        
        return {
          success: true,
          results
        };
      })
    };

    // Create umbilical for planning component
    const planningUmbilical = {
      dom: dom.cloneNode(true),
      planningActor: mockPlanningActor,
      executionActor: mockExecutionActor,
      toolRegistryActor: mockToolRegistryActor,
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };

    // Create umbilical for execution component
    const executionUmbilical = {
      dom: dom.cloneNode(true),
      planningActor: mockPlanningActor,
      executionActor: mockExecutionActor,
      toolRegistryActor: mockToolRegistryActor,
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize components
    planningComponent = await PlanningWorkspacePanel.create(planningUmbilical);
    executionComponent = await ExecutionControlPanel.create(executionUmbilical);
  });

  afterEach(() => {
    if (planningComponent && planningComponent.destroy) {
      planningComponent.destroy();
    }
    if (executionComponent && executionComponent.destroy) {
      executionComponent.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
    jest.clearAllMocks();
  });

  describe('Semantic Search Integration', () => {
    test('should perform semantic search for tools', async () => {
      // Search for "save data to disk"
      const results = await mockToolRegistryActor.searchTools('save data to disk', {
        semantic: true,
        limit: 3
      });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('file-writer');
      expect(results[0].relevanceScore).toBeGreaterThan(0.3);
    });

    test('should find tools by natural language query', async () => {
      const queries = [
        { query: 'make web requests', expected: 'http-client' },
        { query: 'query database', expected: 'database-query' },
        { query: 'run tests', expected: 'test-runner' },
        { query: 'parse JSON', expected: 'json-parser' }
      ];
      
      for (const { query, expected } of queries) {
        const results = await mockToolRegistryActor.searchTools(query, {
          semantic: true,
          limit: 1
        });
        
        expect(results.length).toBe(1);
        expect(results[0].name).toBe(expected);
      }
    });

    test('should rank tools by relevance', async () => {
      const results = await mockToolRegistryActor.searchTools('test and validate code', {
        semantic: true,
        limit: 5
      });
      
      // Check that results are sorted by relevance
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].relevanceScore).toBeGreaterThanOrEqual(results[i].relevanceScore);
      }
      
      // Test runner should be most relevant
      expect(results[0].name).toBe('test-runner');
    });
  });

  describe('Tool Discovery for Tasks', () => {
    test('should discover appropriate tools for task descriptions', async () => {
      const taskDescriptions = [
        { task: 'fetch data from REST API', expectedTools: ['http-client'] },
        { task: 'save results to file', expectedTools: ['file-writer'] },
        { task: 'query user database', expectedTools: ['database-query'] },
        { task: 'validate JSON response', expectedTools: ['json-parser'] }
      ];
      
      for (const { task, expectedTools } of taskDescriptions) {
        const discovered = await mockToolRegistryActor.discoverToolsForTask(task);
        
        const discoveredNames = discovered.map(t => t.name);
        expectedTools.forEach(expected => {
          expect(discoveredNames).toContain(expected);
        });
      }
    });

    test('should integrate tool discovery with plan creation', async () => {
      const goal = 'Fetch API data and save to file';
      
      // Create plan - should discover relevant tools
      planningComponent.api.setGoal(goal);
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(goal);
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Verify tools were discovered
      expect(plan.requiredTools).toBeDefined();
      expect(plan.requiredTools.length).toBeGreaterThan(0);
      
      // Should include both http-client and file-writer
      expect(plan.requiredTools).toContain('http-client');
      expect(plan.requiredTools).toContain('file-writer');
    });

    test('should handle complex multi-step tasks', async () => {
      const complexTask = 'Query database, transform data to JSON, and run validation tests';
      
      const discovered = await mockToolRegistryActor.discoverToolsForTask(complexTask);
      
      // Should discover multiple relevant tools
      expect(discovered.length).toBeGreaterThanOrEqual(3);
      
      const toolNames = discovered.map(t => t.name);
      expect(toolNames).toContain('database-query');
      expect(toolNames).toContain('json-parser');
      expect(toolNames).toContain('test-runner');
    });
  });

  describe('Tool Execution Through Registry', () => {
    test('should execute tools with proper parameters', async () => {
      // Execute file-writer
      const result = await mockToolRegistryActor.executeTool('file-writer', {
        path: '/tmp/test.txt',
        content: 'Hello World'
      });
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('file-writer');
      expect(result.parameters.path).toBe('/tmp/test.txt');
      expect(result.metadata.module).toBe('filesystem');
    });

    test('should validate required parameters', async () => {
      // Try to execute without required parameters
      await expect(
        mockToolRegistryActor.executeTool('file-writer', {
          // Missing 'path' and 'content'
        })
      ).rejects.toThrow('Missing required parameters');
    });

    test('should execute plan using discovered tools', async () => {
      const plan = {
        id: 'test-plan',
        requiredTools: ['http-client', 'json-parser'],
        hierarchy: {
          root: {
            children: [
              { tools: ['http-client'] },
              { tools: ['json-parser'] }
            ]
          }
        }
      };
      
      // Execute plan
      executionComponent.api.setPlan(plan);
      const executionResult = await mockExecutionActor.executePlan(plan);
      
      expect(executionResult.success).toBe(true);
      expect(executionResult.results).toHaveLength(2);
      expect(executionResult.results[0].toolName).toBe('http-client');
      expect(executionResult.results[1].toolName).toBe('json-parser');
    });

    test('should handle tool execution failures gracefully', async () => {
      // Try to execute non-existent tool
      await expect(
        mockToolRegistryActor.executeTool('non-existent-tool', {})
      ).rejects.toThrow('Tool non-existent-tool not found');
    });
  });

  describe('Tool Module Management', () => {
    test('should get tools by capability', async () => {
      const testingTools = await mockToolRegistryActor.getToolsByCapability('testing');
      
      expect(testingTools.length).toBeGreaterThan(0);
      expect(testingTools[0].name).toBe('test-runner');
      
      const databaseTools = await mockToolRegistryActor.getToolsByCapability('database');
      expect(databaseTools.some(t => t.name === 'database-query')).toBe(true);
    });

    test('should organize tools by modules', async () => {
      const modules = await mockToolRegistryActor.getModules();
      
      expect(modules.length).toBeGreaterThan(0);
      
      // Check specific modules
      const filesystemModule = modules.find(m => m.name === 'filesystem');
      expect(filesystemModule).toBeDefined();
      expect(filesystemModule.tools).toContain('file-writer');
      
      const networkModule = modules.find(m => m.name === 'network');
      expect(networkModule).toBeDefined();
      expect(networkModule.tools).toContain('http-client');
    });

    test('should install new tools dynamically', async () => {
      // Check docker is not initially available
      const initialTools = await mockToolRegistryActor.getAvailableTools();
      expect(initialTools).not.toContain('docker');
      
      // Install docker
      const installResult = await mockToolRegistryActor.installTool('docker');
      
      expect(installResult.success).toBe(true);
      expect(installResult.tool.name).toBe('docker');
      
      // Verify docker is now available
      const updatedTools = await mockToolRegistryActor.getAvailableTools();
      expect(updatedTools).toContain('docker');
    });
  });

  describe('Real Tool Module Integration', () => {
    test('should get detailed tool documentation', async () => {
      const details = await mockToolRegistryActor.getToolDetails('http-client');
      
      expect(details.documentation).toBeDefined();
      expect(details.documentation).toContain('# http-client');
      expect(details.documentation).toContain('## Parameters');
      expect(details.examples).toBeDefined();
      expect(details.examples.length).toBeGreaterThan(0);
    });

    test('should validate tool availability for plan', async () => {
      const plan = {
        requiredTools: ['file-writer', 'http-client', 'json-parser']
      };
      
      const validation = await mockToolRegistryActor.validateTools(plan.requiredTools);
      
      expect(validation.isValid).toBe(true);
      expect(validation.availableTools).toEqual(plan.requiredTools);
      expect(validation.missingTools).toHaveLength(0);
      
      // Check tool details
      expect(validation.toolDetails['file-writer'].version).toBe('1.0.0');
      expect(validation.toolDetails['http-client'].module).toBe('network');
    });

    test('should handle missing tools in validation', async () => {
      const validation = await mockToolRegistryActor.validateTools([
        'file-writer',
        'non-existent-tool',
        'another-missing-tool'
      ]);
      
      expect(validation.isValid).toBe(false);
      expect(validation.availableTools).toContain('file-writer');
      expect(validation.missingTools).toContain('non-existent-tool');
      expect(validation.missingTools).toContain('another-missing-tool');
    });
  });
});
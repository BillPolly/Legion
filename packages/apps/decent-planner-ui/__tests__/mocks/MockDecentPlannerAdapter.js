/**
 * MockDecentPlannerAdapter - Mock implementation for testing
 * Returns predictable responses without needing real DecentPlanner
 */

import { PlannerService } from '../../src/application/ports/PlannerService.js';

export class MockDecentPlannerAdapter extends PlannerService {
  constructor() {
    super();
    this.initialized = false;
    this.mockResponses = this.getDefaultResponses();
    this.calls = [];
    this.cancelled = false;
  }
  
  async initialize() {
    this.initialized = true;
    this.calls.push({ method: 'initialize', args: [] });
    return Promise.resolve();
  }
  
  async planInformal(goal, context = {}, progressCallback = null) {
    this.calls.push({ method: 'planInformal', args: [goal, context] });
    
    // Check for cancellation during execution
    const checkCancellation = () => {
      if (this.cancelled) {
        throw new Error('Planning cancelled');
      }
    };
    
    // Simulate progress updates with cancellation checks
    if (progressCallback) {
      progressCallback('Starting informal planning...');
      checkCancellation();
      
      // Add delay to allow cancellation to occur
      await new Promise(resolve => setTimeout(resolve, 10));
      checkCancellation();
      
      progressCallback('Analyzing goal...');
      checkCancellation();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      checkCancellation();
      
      progressCallback('Decomposing into tasks...');
      checkCancellation();
      
      // Final delay and check
      await new Promise(resolve => setTimeout(resolve, 10));
      checkCancellation();
    } else {
      // Even without progress callback, add cancellation points
      await new Promise(resolve => setTimeout(resolve, 10));
      checkCancellation();
      await new Promise(resolve => setTimeout(resolve, 10));
      checkCancellation();
      await new Promise(resolve => setTimeout(resolve, 10));
      checkCancellation();
    }
    
    // Return mock informal planning result
    return this.mockResponses.planInformal || {
      success: true,
      goal,
      informal: {
        hierarchy: {
          id: 'root',
          name: goal,
          type: 'GOAL',
          complexity: 'MODERATE',
          children: [
            {
              id: 'task1',
              name: 'Initialize environment',
              type: 'TASK',
              complexity: 'SIMPLE',
              children: []
            },
            {
              id: 'task2',
              name: 'Execute main logic',
              type: 'TASK',
              complexity: 'MODERATE',
              children: [
                {
                  id: 'subtask1',
                  name: 'Process data',
                  type: 'TASK',
                  complexity: 'SIMPLE',
                  children: []
                }
              ]
            }
          ]
        },
        statistics: {
          totalTasks: 4,
          depth: 3,
          complexity: 'MODERATE'
        }
      },
      duration: 1500
    };
  }
  
  async planFormal(informalResult, progressCallback = null) {
    this.calls.push({ method: 'planFormal', args: [informalResult] });
    
    if (this.cancelled) {
      throw new Error('Planning cancelled');
    }
    
    // Simulate progress updates
    if (progressCallback) {
      progressCallback('Starting formal planning...');
      progressCallback('Generating behavior trees...');
      progressCallback('Validating trees...');
    }
    
    // Return mock formal planning result
    return this.mockResponses.planFormal || {
      success: true,
      behaviorTrees: [
        {
          id: 'bt1',
          name: 'Main Behavior Tree',
          type: 'sequence',
          children: [
            {
              type: 'action',
              tool: 'writeFile',
              inputs: {
                path: 'test.txt',
                content: 'Hello World'
              }
            }
          ]
        }
      ],
      validation: {
        valid: true,
        errors: []
      },
      duration: 2000
    };
  }
  
  async discoverTools(hierarchy, progressCallback = null) {
    this.calls.push({ method: 'discoverTools', args: [hierarchy] });
    
    if (progressCallback) {
      progressCallback('Discovering tools...');
      progressCallback('Analyzing task requirements...');
      progressCallback('Matching tools to tasks...');
    }
    
    return this.mockResponses.discoverTools || {
      tools: [
        {
          name: 'writeFile',
          description: 'Write content to a file',
          moduleName: 'fs-tools',
          confidence: 0.95
        },
        {
          name: 'readFile',
          description: 'Read content from a file',
          moduleName: 'fs-tools',
          confidence: 0.85
        },
        {
          name: 'executeCommand',
          description: 'Execute a shell command',
          moduleName: 'shell-tools',
          confidence: 0.75
        }
      ],
      mappings: {
        'task1': ['executeCommand'],
        'task2': ['writeFile', 'readFile']
      }
    };
  }
  
  async searchTools(query, searchType, limit = 50) {
    this.calls.push({ method: 'searchTools', args: [query, searchType, limit] });
    
    const allTools = this.getMockTools();
    const queryLower = query.toLowerCase();
    
    if (searchType === 'SEMANTIC') {
      // Mock semantic search - return tools with relevance scores
      return allTools
        .map(tool => ({
          ...tool,
          relevance: Math.random() // Mock relevance score
        }))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);
    } else {
      // Text-based filtering
      return allTools
        .filter(tool => {
          const nameMatch = tool.name.toLowerCase().includes(queryLower);
          const descMatch = (tool.description || '').toLowerCase().includes(queryLower);
          return nameMatch || descMatch;
        })
        .slice(0, limit);
    }
  }
  
  async listAllTools() {
    this.calls.push({ method: 'listAllTools', args: [] });
    return this.getMockTools();
  }
  
  async getRegistryStats() {
    this.calls.push({ method: 'getRegistryStats', args: [] });
    
    return this.mockResponses.registryStats || {
      totalTools: 150,
      totalModules: 25
    };
  }
  
  cancel() {
    this.calls.push({ method: 'cancel', args: [] });
    this.cancelled = true;
  }
  
  generateReport(plan) {
    this.calls.push({ method: 'generateReport', args: [plan] });
    
    return {
      summary: 'Planning completed successfully',
      details: {
        goal: plan.goal,
        tasks: plan.tasks || [],
        tools: plan.tools || []
      },
      markdown: '# Planning Report\n\nPlan generated successfully.'
    };
  }
  
  // Helper methods for testing
  
  setMockResponse(method, response) {
    this.mockResponses[method] = response;
  }
  
  getCalls(method) {
    return this.calls.filter(c => c.method === method);
  }
  
  reset() {
    this.calls = [];
    this.cancelled = false;
    this.initialized = false;
    this.mockResponses = this.getDefaultResponses();
  }
  
  getMockTools() {
    return [
      { name: 'writeFile', description: 'Write content to a file', moduleName: 'fs-tools' },
      { name: 'readFile', description: 'Read content from a file', moduleName: 'fs-tools' },
      { name: 'deleteFile', description: 'Delete a file', moduleName: 'fs-tools' },
      { name: 'createDirectory', description: 'Create a directory', moduleName: 'fs-tools' },
      { name: 'listFiles', description: 'List files in a directory', moduleName: 'fs-tools' },
      { name: 'executeCommand', description: 'Execute shell command', moduleName: 'shell-tools' },
      { name: 'httpRequest', description: 'Make HTTP request', moduleName: 'http-tools' },
      { name: 'parseJSON', description: 'Parse JSON string', moduleName: 'json-tools' },
      { name: 'stringifyJSON', description: 'Convert object to JSON', moduleName: 'json-tools' },
      { name: 'calculateHash', description: 'Calculate file hash', moduleName: 'crypto-tools' }
    ];
  }
  
  getDefaultResponses() {
    return {};
  }
}
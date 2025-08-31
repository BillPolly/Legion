/**
 * Simple debug test to see what the DecentPlanner produces
 */

import { DecentPlanner } from '../../src/DecentPlanner.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';

describe('Debug Planner Output', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    const llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLM client required for test');
    }
  });

  test('should show what behavior tree structure is generated', async () => {
    const planner = new DecentPlanner({
      maxDepth: 2,
      formalPlanning: {
        enabled: true,
        validateBehaviorTrees: false
      },
      timeouts: {
        classification: 8000,
        decomposition: 12000,
        overall: 45000
      }
    });
    
    await planner.initialize();
    
    const goal = 'Write "Hello World" to a file';
    const planResult = await planner.plan(goal, { domain: 'file_operations' });
    
    // Save debug output to file since console output isn't showing
    const debugDir = path.join(process.cwd(), '__tests__', 'debug');
    await fs.mkdir(debugDir, { recursive: true });
    
    let debugOutput = '';
    debugOutput += '\n=== PLAN RESULT ===\n';
    debugOutput += `Success: ${planResult.success}\n`;
    
    if (!planResult.success) {
      debugOutput += `Error: ${planResult.error}\n`;
      await fs.writeFile(path.join(debugDir, 'debug-output.txt'), debugOutput);
      return;
    }
    
    debugOutput += `Behavior Trees Count: ${planResult.data.behaviorTrees.length}\n`;
    
    if (planResult.data.behaviorTrees.length > 0) {
      const bt = planResult.data.behaviorTrees[0];
      debugOutput += '\n=== BEHAVIOR TREE STRUCTURE ===\n';
      debugOutput += JSON.stringify(bt, null, 2) + '\n';
      
      debugOutput += '\n=== TOOL ANALYSIS ===\n';
      const toolsFound = new Set();
      findToolsInTree(bt, toolsFound);
      
      toolsFound.forEach((tool, index) => {
        debugOutput += `Tool ${index + 1}:\n`;
        debugOutput += `  Type: ${typeof tool}\n`;
        debugOutput += `  Constructor: ${tool.constructor.name}\n`;
        debugOutput += `  toString(): "${tool.toString()}"\n`;
        debugOutput += `  JSON: ${JSON.stringify(tool)}\n`;
        debugOutput += `  Keys: ${Object.keys(tool).join(', ')}\n`;
      });
    }
    
    await fs.writeFile(path.join(debugDir, 'debug-output.txt'), debugOutput);
    console.log('Debug output written to', path.join(debugDir, 'debug-output.txt'));
    
    expect(planResult.success).toBe(true);
  }, 60000);
});

function findToolsInTree(node, toolsSet) {
  if (!node) return;
  
  if (node.type === 'action') {
    const toolId = node.tool_id || node.config?.tool_id || node.tool || node.config?.tool;
    if (toolId) {
      toolsSet.add(toolId);
    }
  }
  
  if (node.children) {
    for (const child of node.children) {
      findToolsInTree(child, toolsSet);
    }
  }
  
  if (node.child) {
    findToolsInTree(node.child, toolsSet);
  }
}
/**
 * Simple test to log behavior tree structure
 */

import { ResourceManager } from '@legion/resource-manager';
import { DecentPlanner } from '../../src/DecentPlanner.js';
import fs from 'fs';

describe('Log Behavior Tree Structure', () => {
  test('log behavior tree inputs and outputs to file', async () => {
    const resourceManager = await ResourceManager.getInstance();
    const decentPlanner = new DecentPlanner({
      maxDepth: 5,
      confidenceThreshold: 0.5,
      enableFormalPlanning: true,
      validateBehaviorTrees: true,
      logLevel: 'info'
    });
    await decentPlanner.initialize();
    
    const result = await decentPlanner.plan("write hello world program", {});
    
    if (result.success && result.data.behaviorTrees && result.data.behaviorTrees.length > 0) {
      const behaviorTree = result.data.behaviorTrees[0];
      const actionNodes = behaviorTree.children?.filter(child => child.type === 'action') || [];
      
      let logOutput = '=== BEHAVIOR TREE ACTION NODES ===\n\n';
      
      for (let i = 0; i < actionNodes.length; i++) {
        const node = actionNodes[i];
        logOutput += `Action Node ${i + 1}: ${node.id}\n`;
        logOutput += `Description: ${node.description}\n`;
        logOutput += `Tool: ${typeof node.tool} - ${node.tool?.name || 'no name'}\n`;
        
        logOutput += '\nINPUTS:\n';
        if (node.inputs) {
          logOutput += `  Type: ${typeof node.inputs}\n`;
          logOutput += `  Keys: ${Object.keys(node.inputs).join(', ')}\n`;
          for (const [key, value] of Object.entries(node.inputs)) {
            logOutput += `  ${key}: ${typeof value} = ${value}\n`;
          }
        } else {
          logOutput += '  No inputs\n';
        }
        
        logOutput += '\nOUTPUTS:\n';
        if (node.outputs) {
          logOutput += `  Type: ${typeof node.outputs}\n`;
          logOutput += `  Keys: ${Object.keys(node.outputs).join(', ')}\n`;
          for (const [key, value] of Object.entries(node.outputs)) {
            logOutput += `  ${key}: ${typeof value} = ${value}\n`;
          }
        } else {
          logOutput += '  No outputs\n';
        }
        
        logOutput += '\n' + '='.repeat(50) + '\n\n';
      }
      
      // Write to file
      fs.writeFileSync('/tmp/behavior-tree-structure.log', logOutput);
      console.log('Behavior tree structure logged to /tmp/behavior-tree-structure.log');
      
      // Also log basic info to console
      console.log(`Found ${actionNodes.length} action nodes`);
      for (const node of actionNodes) {
        console.log(`Node ${node.id}: tool=${node.tool?.name}, inputs=${Object.keys(node.inputs || {}).length}, outputs=${Object.keys(node.outputs || {}).length}`);
      }
      
    } else {
      console.log('No behavior trees generated');
    }
    
  }, 60000);
});
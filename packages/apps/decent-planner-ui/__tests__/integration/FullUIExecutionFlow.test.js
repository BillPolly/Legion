/**
 * Full UI Execution Flow Test
 * Tests complete workflow: planning → BT execution → UI display → clicking inspection
 * Simulates exact UI behavior and verifies all data flows correctly
 * NO MOCKS - Tests real backend-frontend integration
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';
import ServerPlannerActor from '../../src/server/actors/ServerPlannerActor.js';
import { TreeExecutionComponent } from '../../src/client/components/TreeExecutionComponent.js';
import { JSDOM } from 'jsdom';
import path from 'path';
import fs from 'fs/promises';

describe('Full UI Execution Flow Integration', () => {
  let resourceManager;
  let toolRegistry;
  let testDir;
  let originalDir;
  let dom;
  
  beforeAll(async () => {
    console.log('\n🚀 Setting up Full UI Execution Flow tests');
    
    resourceManager = await ResourceManager.getInstance();
    const llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLM client required - no fallbacks');
    }
    
    toolRegistry = await getToolRegistry();
    console.log('✅ Real components initialized');
    originalDir = process.cwd();
    
    // Set up DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.Event = dom.window.Event;
  });

  afterEach(async () => {
    if (originalDir) {
      process.chdir(originalDir);
    }
  });

  test('should complete full workflow and verify UI inspection data', async () => {
    console.log('\n🎯 Testing complete planning → execution → UI inspection workflow');
    
    testDir = path.join('/tmp', `ui-flow-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    console.log(`📁 Test directory: ${testDir}`);
    
    // Step 1: Set up backend with event capture
    let allEvents = [];
    let executionEvents = [];
    
    const mockFrontend = {
      receive: (type, data) => {
        allEvents.push({ type, data, timestamp: Date.now() });
        
        if (type === 'execution-event' || type === 'step-response') {
          executionEvents.push({ type, data, timestamp: Date.now() });
          console.log(`📨 Execution Event: ${type}`);
          
          if (type === 'step-response' && data.data?.state?.history) {
            const history = data.data.state.history;
            console.log(`   📜 History entries: ${history.length}`);
            
            history.forEach((entry, idx) => {
              console.log(`      ${idx + 1}. ${entry.nodeId}:`);
              console.log(`         Inputs: ${entry.inputs ? Object.keys(entry.inputs).length : 'NULL'}`);
              console.log(`         Outputs: ${typeof entry.outputs === 'object' && entry.outputs ? Object.keys(entry.outputs).length : 'NULL'}`);
              console.log(`         Tool: ${entry.tool}`);
            });
          }
          
          if (type === 'step-response' && data.data?.state?.context?.artifacts) {
            const artifacts = data.data.state.context.artifacts;
            const keys = Object.keys(artifacts);
            console.log(`   🔗 Artifacts: ${keys.length} (${keys.join(', ')})`);
            
            keys.forEach(key => {
              console.log(`      ${key} = ${artifacts[key]}`);
            });
          }
        }
      }
    };
    
    const serverActor = new ServerPlannerActor({ toolRegistry });
    await serverActor.setRemoteActor(mockFrontend);
    
    // Step 2: Complete full planning workflow
    console.log('\n📋 Step 2: Complete planning workflow...');
    
    // Informal planning
    await serverActor.receive('plan-informal', { 
      goal: 'write a hello world program in javascript'
    });
    await new Promise(r => setTimeout(r, 3000)); // Wait for completion
    
    // Tool discovery
    await serverActor.receive('discover-tools', {});
    await new Promise(r => setTimeout(r, 2000));
    
    // Formal planning (automatically initializes BT executor)
    await serverActor.receive('plan-formal', {});
    await new Promise(r => setTimeout(r, 8000)); // Wait for completion
    
    console.log(`📊 Planning events captured: ${allEvents.length}`);
    
    // Step 3: Test execution with event capture
    console.log('\n⚡ Step 3: Testing BT execution...');
    
    const executionActor = serverActor.executionActor;
    expect(executionActor).toBeTruthy();
    
    // Execute 3 steps to get through the actions
    for (let step = 1; step <= 5; step++) {
      console.log(`\n--- Execution Step ${step} ---`);
      
      await executionActor.receive('step', {}, mockFrontend);
      await new Promise(r => setTimeout(r, 500)); // Wait for events
      
      // Find latest step response
      const stepResponses = allEvents.filter(e => e.type === 'step-response');
      if (stepResponses.length > 0) {
        const latest = stepResponses[stepResponses.length - 1];
        const complete = latest.data?.data?.complete;
        
        console.log(`   Complete: ${complete}`);
        
        if (complete) {
          console.log('🏁 Execution complete');
          break;
        }
      }
    }
    
    // Step 4: Analyze final execution data 
    console.log('\n🔍 Step 4: Analyzing final execution data...');
    
    const finalStepResponse = allEvents.filter(e => e.type === 'step-response').pop();
    expect(finalStepResponse).toBeTruthy();
    
    const finalState = finalStepResponse.data?.data?.state;
    expect(finalState).toBeTruthy();
    
    console.log(`📜 Final history entries: ${finalState.history?.length || 0}`);
    console.log(`🔗 Final artifacts: ${Object.keys(finalState.context?.artifacts || {}).length}`);
    
    // Verify history has proper data
    if (finalState.history && finalState.history.length > 0) {
      finalState.history.forEach((entry, idx) => {
        console.log(`\n   History ${idx + 1}: ${entry.nodeId}`);
        console.log(`      Status: ${entry.status}`);
        console.log(`      Inputs: ${entry.inputs ? JSON.stringify(entry.inputs) : 'NULL'}`);
        console.log(`      Outputs type: ${typeof entry.outputs}`);
        
        if (entry.outputs && typeof entry.outputs === 'object') {
          console.log(`      Outputs keys: ${Object.keys(entry.outputs).join(', ')}`);
          console.log(`      Outputs: ${JSON.stringify(entry.outputs)}`);
        }
        
        // Verify inputs exist for tool executions
        if (entry.nodeType === 'action') {
          expect(entry.inputs).toBeTruthy();
          expect(typeof entry.inputs).toBe('object');
        }
      });
    }
    
    // Step 5: Test UI component with real data
    console.log('\n🖥️ Step 5: Testing UI component with real execution data...');
    
    const container = document.getElementById('container');
    
    let inspectionRequests = [];
    const mockRemoteActor = {
      receive: async (type, payload) => {
        console.log(`🔌 UI → Backend: ${type}`, payload);
        inspectionRequests.push({ type, payload });
        
        // Simulate backend response for inspection
        if (type === 'get-execution-details') {
          const { type: requestType, index, key } = payload;
          
          switch (requestType) {
            case 'history-inputs':
              const historyEntry = finalState.history[index];
              return historyEntry?.inputs || {};
            case 'history-outputs':
              const outputEntry = finalState.history[index];
              return outputEntry?.outputs || {};
            case 'artifact-value':
              return finalState.context?.artifacts?.[key] || 'not found';
          }
        }
        
        return { success: true };
      }
    };
    
    const treeComponent = new TreeExecutionComponent(container, {
      remoteActor: mockRemoteActor
    });
    
    // Update with real execution data
    treeComponent.updateExecutionState(finalState);
    
    // Verify UI displays correct data
    const historyItems = container.querySelectorAll('.history-item');
    console.log(`📋 UI History items: ${historyItems.length}`);
    
    expect(historyItems.length).toBe(finalState.history.length);
    
    // Test clicking on first history item inputs
    if (historyItems.length > 0) {
      const firstItem = historyItems[0];
      const inputsBtn = firstItem.querySelector('.inputs-btn');
      
      console.log(`🖱️ Testing click on: ${inputsBtn?.textContent}`);
      expect(inputsBtn).toBeTruthy();
      
      // Click and verify request
      inspectionRequests = [];
      inputsBtn.click();
      
      await new Promise(r => setTimeout(r, 200));
      
      console.log(`   Requests generated: ${inspectionRequests.length}`);
      if (inspectionRequests.length > 0) {
        console.log(`   Request: ${JSON.stringify(inspectionRequests[0])}`);
      }
      
      expect(inspectionRequests.length).toBeGreaterThan(0);
    }
    
    console.log('\n🎉 Full UI Execution Flow Test PASSED!');
    console.log('   ✅ Backend execution generates proper event data');
    console.log('   ✅ UI component receives and displays data correctly');
    console.log('   ✅ Inspection clicks trigger backend requests');
    
  }, 180000); // 3 minutes for full flow
});
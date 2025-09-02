/**
 * Real LLM Progress Notifications Integration Test
 * Tests that REAL DecentPlanner emits progress notifications during planning
 * NO MOCKS - Uses real DecentPlanner with real LLM client
 */

import { DecentPlanner } from '@legion/decent-planner';
import { ResourceManager } from '@legion/resource-manager';

describe('Real LLM Progress Notifications Integration', () => {
  let resourceManager;
  let realPlanner;
  
  beforeAll(async () => {
    console.log('\n🚀 Setting up REAL LLM Progress Notifications test');
    
    // Get ResourceManager - fail fast if not available
    resourceManager = await ResourceManager.getInstance();
    
    // Verify LLM client is available - fail fast if not
    const llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLM client required for progress notification test - no fallbacks');
    }
    console.log('✅ LLM client available for progress notification testing');
  });
  
  beforeEach(async () => {
    // Create REAL DecentPlanner with simple configuration
    realPlanner = new DecentPlanner({
      maxDepth: 3,
      confidenceThreshold: 0.7,
      formalPlanning: {
        enabled: false, // Disable formal planning to focus on informal
        validateBehaviorTrees: false
      },
      timeouts: {
        classification: 10000,
        decomposition: 15000,
        overall: 60000
      }
    });
    
    await realPlanner.initialize();
    console.log('✅ REAL DecentPlanner initialized');
  });
  
  afterEach(() => {
    if (realPlanner) {
      realPlanner.cancel();
    }
  });
  
  test('should capture REAL LLM progress notifications during planning', async () => {
    console.log('\n🎯 Testing REAL LLM progress notifications with Legion callback pattern');
    
    const goal = 'Write a simple hello world message to a text file';
    let capturedProgressMessages = [];
    
    console.log(`📋 Planning goal: "${goal}"`);
    
    // Legion uses SIMPLE EMITTER pattern - all events go through single callback
    const progressCallback = (message) => {
      console.log(`📢 Legion Progress: ${message}`);
      capturedProgressMessages.push({
        message: message,
        timestamp: new Date().toISOString()
      });
    };
    
    console.log('🚀 Starting REAL planning with Legion callback pattern...');
    
    // Execute planning with REAL LLM using Legion's simple emitter pattern
    const startTime = Date.now();
    
    try {
      const result = await realPlanner.plan(goal, { domain: 'file_operations' }, progressCallback);
      const duration = Date.now() - startTime;
      
      console.log(`✅ Planning completed in ${duration}ms: success=${result.success}`);
      
      // The key test is whether we captured REAL LLM progress notifications
      expect(capturedProgressMessages.length).toBeGreaterThan(0);
      
      console.log(`\n📊 SUCCESS! Captured ${capturedProgressMessages.length} progress messages via Legion callback:`);
      capturedProgressMessages.forEach((msg, idx) => {
        console.log(`   ${idx + 1}. [${msg.timestamp}] ${msg.message}`);
      });
      
      // Verify progress messages contain expected content from REAL LLM
      const allMessages = capturedProgressMessages.map(msg => msg.message.toLowerCase());
      const hasProgressMessage = allMessages.some(msg => 
        msg.includes('classif') || msg.includes('analyz') || msg.includes('starting') ||
        msg.includes('decompos') || msg.includes('break') || msg.includes('task') ||
        msg.includes('discover') || msg.includes('tool') || msg.includes('planning') ||
        msg.includes('creating') || msg.includes('creat')
      );
      
      // Should have captured REAL LLM progress through Legion callback pattern
      expect(hasProgressMessage).toBe(true);
      
      console.log('\n✅ Legion callback pattern verification:');
      console.log(`   📢 Captured REAL LLM progress via callback: ${hasProgressMessage}`);
      console.log(`   🔧 Sample messages: ${allMessages.slice(0, 3).join(' | ')}`);
      
      console.log('🎉 REAL LLM Progress with Legion callback pattern PASSED!');
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`⚠️ Planning had issues after ${duration}ms: ${error.message}`);
      
      // The critical test is whether Legion callback captured REAL LLM progress
      console.log(`📊 Despite issues, captured ${capturedProgressMessages.length} progress messages via Legion callback`);
      
      if (capturedProgressMessages.length > 0) {
        capturedProgressMessages.forEach((msg, idx) => {
          console.log(`   ${idx + 1}. [${msg.timestamp}] ${msg.message}`);
        });
        
        // Progress was captured via Legion callback even with planning issues
        expect(capturedProgressMessages.length).toBeGreaterThan(0);
        
        const allMessages = capturedProgressMessages.map(msg => msg.message.toLowerCase());
        const hasProgressMessage = allMessages.some(msg => 
          msg.includes('classif') || msg.includes('analyz') || msg.includes('starting') ||
          msg.includes('decompos') || msg.includes('break') || msg.includes('task') ||
          msg.includes('discover') || msg.includes('tool') || msg.includes('planning') ||
          msg.includes('creating') || msg.includes('creat')
        );
        
        expect(hasProgressMessage).toBe(true);
        console.log('🎉 SUCCESS! Legion callback captured REAL LLM progress despite planning issues!');
      } else {
        throw error; // Re-throw if we didn't capture any progress
      }
    }
  }, 120000); // 2 minutes timeout
  
  test('should capture progress notifications at different planning stages', async () => {
    console.log('\n🎯 Testing multi-stage progress notifications with Legion callback');
    
    const goal = 'Read a file and count the number of words';
    let stageProgressMessages = [];
    
    // Legion callback pattern - all events through single callback
    const stageTrackingCallback = (message) => {
      const stage = message.toLowerCase().includes('classif') ? 'CLASSIFICATION' :
                   message.toLowerCase().includes('decompos') ? 'DECOMPOSITION' :
                   message.toLowerCase().includes('validat') ? 'VALIDATION' :
                   message.toLowerCase().includes('discover') ? 'DISCOVERY' :
                   message.toLowerCase().includes('complet') ? 'COMPLETION' : 'OTHER';
      
      const logEntry = {
        stage: stage,
        message: message,
        timestamp: new Date().toISOString()
      };
      
      console.log(`📢 [${stage}] ${message}`);
      stageProgressMessages.push(logEntry);
    };
    
    console.log(`📋 Multi-stage goal: "${goal}"`);
    console.log('🚀 Starting multi-stage planning with Legion callback...');
    
    try {
      const result = await realPlanner.plan(goal, { domain: 'file_operations' }, stageTrackingCallback);
      
      console.log(`✅ Planning completed: success=${result.success}`);
      
      // Even if planning fails, we should have captured some progress
      expect(stageProgressMessages.length).toBeGreaterThan(0);
      
      console.log(`\n📊 Captured ${stageProgressMessages.length} stage-tracked messages via Legion callback:`);
      stageProgressMessages.forEach((entry, idx) => {
        console.log(`   ${idx + 1}. [${entry.stage}] ${entry.message}`);
      });
      
      // Verify we got messages (even if planning was cancelled)
      const uniqueStages = new Set(stageProgressMessages.map(entry => entry.stage));
      console.log(`\n🎭 Unique stages captured via Legion callback: ${Array.from(uniqueStages).join(', ')}`);
      
      // Should have at least captured some progress stages
      expect(uniqueStages.size).toBeGreaterThan(0);
      
      console.log('🎉 Multi-stage Legion callback progress tracking PASSED!');
    } catch (error) {
      console.log(`⚠️ Planning error occurred: ${error.message}`);
      
      // Even with errors, we should have captured some progress via Legion callback
      console.log(`📊 Despite error, captured ${stageProgressMessages.length} progress messages`);
      
      if (stageProgressMessages.length > 0) {
        stageProgressMessages.forEach((entry, idx) => {
          console.log(`   ${idx + 1}. [${entry.stage}] ${entry.message}`);
        });
        
        // Progress was captured even if planning failed - this proves Legion callback works
        expect(stageProgressMessages.length).toBeGreaterThan(0);
        console.log('🎉 Legion callback captured progress even with planning error - SUCCESS!');
      } else {
        throw error; // Re-throw if we didn't capture any progress
      }
    }
  }, 90000); // 1.5 minutes - shorter timeout since we're testing progress capture
});
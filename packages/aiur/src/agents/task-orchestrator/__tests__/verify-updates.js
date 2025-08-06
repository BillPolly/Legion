#!/usr/bin/env node

/**
 * Quick verification of progress updates
 */

import { TaskOrchestratorTestActor } from './TaskOrchestratorTestActor.js';

const verifyUpdates = async () => {
  console.log('🧪 Verifying Progress Updates...\n');
  
  const testActor = new TaskOrchestratorTestActor();
  const messages = [];
  
  try {
    await testActor.initialize();
    
    // Capture messages
    const originalReceive = testActor.receive.bind(testActor);
    testActor.receive = async (payload) => {
      if (payload.type && (payload.type.includes('orchestrator') || payload.type === 'agent_thought')) {
        messages.push({
          type: payload.type,
          message: payload.message || payload.thought || '',
          progress: payload.progress
        });
        
        // Log in real-time
        const preview = (payload.message || payload.thought || '').split('\n')[0].substring(0, 70);
        console.log(`[${payload.type}] ${preview}...`);
      }
      return originalReceive(payload);
    };
    
    // Start task
    console.log('\n🚀 Starting task...\n');
    const taskPromise = testActor.startPlanningTask('create a simple counter app');
    
    // Wait 30 seconds
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    console.log(`\n✅ Captured ${messages.length} progress updates in 30 seconds`);
    
    // Show summary
    const updateTypes = {};
    messages.forEach(msg => {
      updateTypes[msg.type] = (updateTypes[msg.type] || 0) + 1;
    });
    
    console.log('\nMessage types:');
    Object.entries(updateTypes).forEach(([type, count]) => {
      console.log(`  • ${type}: ${count}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    testActor.destroy();
  }
};

verifyUpdates().catch(console.error);
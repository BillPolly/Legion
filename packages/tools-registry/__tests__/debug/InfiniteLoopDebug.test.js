/**
 * Debug test to isolate the infinite module loading loop
 */

import { ToolRegistry } from '../../src/integration/ToolRegistry.js';

describe('Infinite Loop Debug Test', () => {
  test('should load single module without infinite loop', async () => {
    console.log('🔍 Creating ToolRegistry instance...');
    const toolRegistry = ToolRegistry.getInstance();
    
    console.log('🔍 Initializing ToolRegistry...');
    await toolRegistry.initialize();
    
    console.log('🔍 Getting health check (should be quick)...');
    const startTime = Date.now();
    const health = await toolRegistry.quickHealthCheck();
    const duration = Date.now() - startTime;
    
    console.log(`✅ Health check completed in ${duration}ms:`, health);
    
    // This should complete quickly - if it times out, we have an infinite loop
    expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
    expect(health).toBeDefined();
    
    await toolRegistry.cleanup();
  }, 15000);
});
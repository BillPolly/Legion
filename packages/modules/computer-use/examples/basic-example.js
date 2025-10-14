/**
 * Basic Computer Use Agent Example
 * Demonstrates browser automation with Gemini Computer Use API
 */

import { ResourceManager } from '@legion/resource-manager';
import { ComputerUseAgent } from '@legion/computer-use';

async function main() {
  // Get ResourceManager instance (loads .env automatically)
  const resourceManager = await ResourceManager.getInstance();

  // Verify Google API key is configured
  const googleApiKey = resourceManager.get('env.GOOGLE_API_KEY');
  if (!googleApiKey) {
    console.error('ERROR: GOOGLE_API_KEY not found in .env file');
    process.exit(1);
  }

  // Create agent with options
  const agent = new ComputerUseAgent(resourceManager, {
    headless: false, // Show browser for debugging
    width: 1440,
    height: 900,
    startUrl: 'https://www.google.com',
    maxTurns: 10,
    excludedActions: [], // Can exclude risky actions like drag_and_drop
    allowlistHosts: undefined, // Optionally restrict to specific hosts
    outDir: 'output_agent_runs',
    stepTimeBudgetMs: 60000, // 60s per turn
    totalTimeBudgetMs: 600000, // 10 minutes total
  });

  try {
    // Initialize agent
    await agent.initialize();

    // Execute task
    const task = process.argv[2] || 'Search for "Anthropic Claude" and tell me what you find';
    console.log(`\nTask: ${task}\n`);

    const result = await agent.executeTask(task);

    if (result.ok) {
      console.log('\n✅ Task completed successfully!');
      console.log('Result:', result.resultText);
    } else {
      console.log('\n⚠️ Task incomplete:', result.error);
    }

    console.log('\n📁 Artifacts saved to:', result.outDir);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    // Cleanup
    await agent.cleanup();
  }
}

// Run example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

/**
 * Interactive Session Example
 *
 * Demonstrates how to use ComputerUseActor for step-by-step interactive browser control.
 * Shows both Gemini AI mode and direct Puppeteer mode.
 */

import { ResourceManager } from '@legion/resource-manager';
import { ComputerUseActor } from '@legion/computer-use';
import { writeFileSync } from 'fs';

async function main() {
  console.log('\n🤖 Interactive Computer Use Session\n');

  // Get ResourceManager
  const resourceManager = await ResourceManager.getInstance();

  // Create actor
  const actor = new ComputerUseActor(resourceManager);

  try {
    // Step 1: Initialize browser
    console.log('Step 1: Initializing browser...');
    const initResult = await actor.receive('init', {
      startUrl: 'https://www.google.com',
      headless: false, // Show browser for visibility
      width: 1440,
      height: 900,
    });
    console.log('✅ Initialized:', initResult);
    console.log(`   Session ID: ${initResult.sessionId}`);
    console.log(`   Output dir: ${initResult.outDir}\n`);

    // Step 2: Execute task with Gemini
    console.log('Step 2: Using Gemini to search...');
    const taskResult = await actor.receive('execute-task', {
      task: 'Search for "Anthropic Claude" and click the first result',
      maxTurns: 5,
    });
    console.log('✅ Task result:', taskResult.ok ? 'Success' : 'Failed');
    if (taskResult.resultText) {
      console.log(`   Result: ${taskResult.resultText}\n`);
    }

    // Step 3: Take screenshot
    console.log('Step 3: Taking screenshot...');
    const screenshotResult = await actor.receive('screenshot', {
      label: 'after_search',
    });
    if (screenshotResult.ok) {
      console.log('✅ Screenshot captured');
      // Save screenshot to file for viewing
      const buffer = Buffer.from(screenshotResult.screenshot, 'base64');
      writeFileSync('/tmp/interactive-screenshot.png', buffer);
      console.log('   Saved to: /tmp/interactive-screenshot.png\n');
    }

    // Step 4: Get current state
    console.log('Step 4: Getting page state...');
    const stateResult = await actor.receive('get-state');
    if (stateResult.ok) {
      console.log('✅ Current state:');
      console.log(`   URL: ${stateResult.state.url}`);
      console.log(`   Viewport: ${stateResult.state.viewport.width}x${stateResult.state.viewport.height}`);
      console.log(`   DOM nodes: ${stateResult.state.dom.nodes.length}`);
      console.log(`   AX nodes: ${stateResult.state.ax.length}\n`);
    }

    // Step 5: Direct Puppeteer control
    console.log('Step 5: Using Puppeteer to navigate...');
    const gotoResult = await actor.receive('puppeteer', {
      action: 'goto',
      value: 'https://www.wikipedia.org',
    });
    console.log('✅ Navigated:', gotoResult);

    await actor.receive('puppeteer', {
      action: 'wait',
      value: 2000,
    });

    // Step 6: Fill search box with Puppeteer
    console.log('Step 6: Filling search box with Puppeteer...');
    await actor.receive('puppeteer', {
      action: 'fill',
      selector: 'input[name="search"]',
      value: 'Artificial Intelligence',
    });

    await actor.receive('puppeteer', {
      action: 'press',
      selector: 'input[name="search"]',
      value: 'Enter',
    });

    await actor.receive('puppeteer', {
      action: 'wait',
      value: 2000,
    });

    console.log('✅ Search submitted\n');

    // Step 7: Get page title
    console.log('Step 7: Getting page title...');
    const titleResult = await actor.receive('puppeteer', {
      action: 'textContent',
      selector: 'h1',
    });
    if (titleResult.ok) {
      console.log(`✅ Page title: ${titleResult.result}\n`);
    }

    // Step 8: Final screenshot
    console.log('Step 8: Final screenshot...');
    const finalScreenshot = await actor.receive('screenshot', {
      label: 'final',
    });
    if (finalScreenshot.ok) {
      const buffer = Buffer.from(finalScreenshot.screenshot, 'base64');
      writeFileSync('/tmp/interactive-final.png', buffer);
      console.log('✅ Final screenshot saved to: /tmp/interactive-final.png\n');
    }

    // Step 9: Cleanup
    console.log('Step 9: Cleaning up...');
    await actor.receive('cleanup');
    console.log('✅ Cleanup complete\n');

    console.log('🎉 Interactive session completed successfully!');
    console.log(`\n📁 All artifacts saved to: ${initResult.outDir}`);
    console.log('   - Screenshots: step_*.png');
    console.log('   - Trace: trace.zip (open with: npx playwright show-trace trace.zip)');
    console.log('   - Log: run.log\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);

    // Cleanup on error
    try {
      await actor.receive('cleanup');
    } catch {}

    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

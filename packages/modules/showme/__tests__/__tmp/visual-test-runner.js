/**
 * Visual Test Runner - Actually launches Chrome and displays Handle
 * Run with: node __tests__/__tmp/visual-test-runner.js
 */

import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout } from 'timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runVisualTest() {
  console.log('🚀 Starting Visual Handle Display Test\n');

  let server = null;

  try {
    // Step 1: Setup test strategy URI
    console.log('Step 1: Setting up test strategy URI...');
    const testStrategyPath = path.resolve(
      __dirname,
      '../../../../../agents/roma-agent/src/strategies/simple-node/SimpleNodeTestStrategy.js'
    );
    const testStrategyURI = `legion://localhost/strategy${testStrategyPath}`;
    console.log(`✅ Strategy URI: ${testStrategyURI}\n`);

    // Step 2: Initialize ShowMe server
    console.log('Step 2: Initializing ShowMe server...');
    server = new ShowMeServer({
      port: 3705,
      skipLegionPackages: false,
      browserOptions: {
        app: true,  // Chrome app mode (chromeless)
        width: 1400,
        height: 900
      }
    });

    await server.initialize();
    await server.start();
    console.log(`✅ Server running on http://localhost:3705\n`);

    // Step 3: Initialize ShowAssetTool
    console.log('Step 3: Initializing ShowAssetTool...');
    const assetDetector = new AssetTypeDetector();
    const showAssetTool = new ShowAssetTool({
      assetDetector,
      server
    });
    console.log('✅ ShowAssetTool initialized\n');

    // Step 4: Display the Handle
    console.log('Step 4: Displaying strategy Handle...');
    const result = await showAssetTool.execute({
      asset: testStrategyURI,
      title: 'Visual Test - SimpleNodeTestStrategy'
    });

    if (!result.success) {
      throw new Error(`Failed to display Handle: ${result.error}`);
    }

    console.log(`✅ Handle displayed successfully`);
    console.log(`   Asset ID: ${result.assetId}`);
    console.log(`   Type: ${result.detected_type}`);
    console.log(`   Title: ${result.title}\n`);

    // Step 5: Launch Chrome browser
    console.log('Step 5: Launching Chrome browser in app mode...');
    const pageUrl = `http://localhost:3705/showme`;
    await server.launchBrowser(pageUrl);
    console.log(`✅ Chrome launched at: ${pageUrl}\n`);

    // Step 6: Keep server running for manual inspection
    console.log('=====================================');
    console.log('✅ Visual Test Setup Complete!');
    console.log('=====================================\n');
    console.log('The Chrome browser should now be open displaying the Handle.');
    console.log('You can manually inspect the display and interact with it.\n');
    console.log('Server is running at: http://localhost:3705');
    console.log('Press Ctrl+C to stop the server and close.\n');

    // Wait for 60 seconds to allow manual inspection
    console.log('Keeping server alive for 60 seconds...');
    await setTimeout(60000);

    console.log('\n⏱️  60 seconds elapsed. Shutting down...');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    if (server && server.isRunning) {
      console.log('\n🧹 Stopping server...');
      await server.stop();
      console.log('✅ Server stopped');
    }
  }

  console.log('\n✅ Visual test completed successfully!');
  process.exit(0);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Received SIGINT, shutting down...');
  process.exit(0);
});

// Run the test
runVisualTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
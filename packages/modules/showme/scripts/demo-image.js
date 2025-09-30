/**
 * Demo script to show an image from artifacts folder using ShowMe module
 */

import { ShowMeModule } from '../src/ShowMeModule.js';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function demo() {
  console.log('🎨 ShowMe Image Demo');
  console.log('====================\n');

  try {
    // Initialize ShowMe module
    console.log('Initializing ShowMe module...');
    const showMeModule = new ShowMeModule({
      serverPort: 3700,
      testMode: false
    });

    // Wait for initialization
    await showMeModule.ensureInitialized();
    console.log('✅ ShowMe module initialized\n');

    // Get the show_asset tool
    const tools = showMeModule.getTools();
    const showAssetTool = tools.find(tool => tool.name === 'show_asset');

    if (!showAssetTool) {
      throw new Error('show_asset tool not found!');
    }

    // Path to an image in the artifacts folder
    const imagePath = path.resolve(__dirname, '../../../artifacts/dalle3-2025-08-05T08-39-42.png');
    console.log(`📁 Image path: ${imagePath}\n`);

    // Display the image
    console.log('🖼️  Displaying image...');
    const result = await showAssetTool.execute({
      asset: imagePath,
      hint: 'image',
      title: 'Demo Image from Artifacts'
    });

    console.log('\n✅ Result:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n🎉 Image displayed successfully!');
      console.log(`   Window ID: ${result.window_id}`);
      console.log(`   Detected Type: ${result.detected_type}`);
      console.log(`   URL: ${result.url}`);

      // Launch browser to show the UI
      console.log('\n🌐 Launching browser...');
      await open(result.url, {
        app: {
          name: 'google chrome',
          arguments: ['--new-window']
        }
      });

      console.log('\n📍 Browser should open automatically!');
      console.log('   The image asset is stored on the server.');
      console.log('   The browser will connect via WebSocket and display it.\n');
    } else {
      console.error('\n❌ Failed to display image:', result.error);
    }

    // Keep process alive to see the result
    console.log('⏳ Keeping server alive... (Press Ctrl+C to exit)');
    await new Promise(resolve => setTimeout(resolve, 300000)); // Wait 5 minutes

  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

demo();
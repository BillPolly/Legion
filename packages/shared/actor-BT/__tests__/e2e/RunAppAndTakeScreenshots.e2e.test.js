/**
 * Test to actually run the generated web app and take screenshots
 * This demonstrates the complete pipeline: Generate -> Build -> Serve -> Screenshot
 */

import { BehaviorTreeExecutor } from '../../src/core/BehaviorTreeExecutor.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { WebAppTools } from '../../src/tools/webapp-tools.js';
import { BuildTools } from '../../src/tools/build-tools.js';
import { PuppeteerTools } from '../../src/tools/puppeteer-tools.js';
import fs from 'fs/promises';
import path from 'path';

describe('Run App and Take Screenshots Demo', () => {
  let executor;
  let toolRegistry;
  let webAppTools;
  let buildTools;
  let puppeteerTools;
  const appDir = './live-webapp-demo';

  beforeAll(async () => {
    // Clean up any existing app directory
    try {
      await fs.rm(appDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }

    // Initialize all tools
    webAppTools = new WebAppTools(appDir);
    buildTools = new BuildTools(appDir);
    puppeteerTools = new PuppeteerTools(appDir);
    
    // Initialize and populate tool registry
    toolRegistry = new ToolRegistry();
    await registerAllTools();
    
    // Initialize behavior tree executor
    executor = new BehaviorTreeExecutor(toolRegistry);

    console.log('🚀 Starting Live Web App Demo');
    console.log(`📁 App Directory: ${appDir}`);
  });

  afterAll(async () => {
    // Clean up resources but keep the app and screenshots for inspection
    console.log('🧹 Cleaning up browsers and servers...');
    await puppeteerTools.closeAllBrowsers();
    await buildTools.stopAllProcesses();
    
    console.log(`📂 Live app and screenshots preserved at: ${appDir}`);
    console.log('🎉 Live Web App Demo Complete!');
  });

  async function registerAllTools() {
    // Register web app generation tools
    await toolRegistry.registerTool('htmlGenerator', webAppTools.createHtmlGenerator());
    await toolRegistry.registerTool('cssGenerator', webAppTools.createCssGenerator());
    await toolRegistry.registerTool('reactComponentGenerator', webAppTools.createReactComponentGenerator());
    await toolRegistry.registerTool('packageJsonGenerator', webAppTools.createPackageJsonGenerator());
    await toolRegistry.registerTool('mainEntryGenerator', webAppTools.createMainEntryGenerator());
    
    // Register build and runtime tools
    await toolRegistry.registerTool('npmInstaller', buildTools.createNpmInstaller());
    await toolRegistry.registerTool('buildRunner', buildTools.createBuildRunner());
    await toolRegistry.registerTool('serverManager', buildTools.createServerManager());
    await toolRegistry.registerTool('portManager', buildTools.createPortManager());
    
    // Register browser tools
    await toolRegistry.registerTool('browserManager', puppeteerTools.createBrowserManager());
    await toolRegistry.registerTool('screenshotCapture', puppeteerTools.createScreenshotCapture());
    await toolRegistry.registerTool('interactionTester', puppeteerTools.createInteractionTester());
  }

  test('should generate a complete runnable web application', async () => {
    console.log('\n🏗️  Phase 1: Generating Web Application');
    
    // Execute complete workflow to generate, build, serve, and screenshot the app
    const result = await executor.executeTree({
      type: 'sequence',
      id: 'complete-live-demo',
      description: 'Generate, build, serve, and screenshot a web app',
      children: [
        // Phase 1: Generate the web application files sequentially
        {
          type: 'action',
          id: 'generate-package-json',
          tool: 'packageJsonGenerator',
          params: {
            appName: 'LiveDemoApp',
            version: '1.0.0',
            description: 'Live demo web application with beautiful UI',
            author: 'BT Framework',
            buildTool: 'vite',
            includeScripts: true,
            additionalDeps: ['axios'],
            additionalDevDeps: []
          }
        },
        {
          type: 'action',
          id: 'generate-html',
          tool: 'htmlGenerator',
          params: {
            appName: 'LiveDemoApp',
            title: 'BT Framework Live Demo',
            description: 'A beautiful web application generated and served automatically',
            theme: 'light'
          }
        },
        {
          type: 'action',
          id: 'generate-css',
          tool: 'cssGenerator',
          params: {
            appName: 'LiveDemoApp',
            fileName: 'main.css',
            theme: 'modern',
            colorScheme: 'blue',
            includeReset: true,
            includeUtilities: true
          }
        },
        {
          type: 'action',
          id: 'generate-main-entry',
          tool: 'mainEntryGenerator',
          params: {
            appName: 'LiveDemoApp',
            framework: 'react',
            entryPoint: 'main.jsx'
          }
        },
        {
          type: 'action',
          id: 'generate-hero-component',
          tool: 'reactComponentGenerator',
          params: {
            appName: 'LiveDemoApp',
            componentName: 'Hero',
            componentType: 'functional',
            props: [
              { name: 'title', type: 'string' },
              { name: 'subtitle', type: 'string' }
            ],
            hooks: ['useState'],
            styling: 'css',
            includeTests: false
          }
        }
      ]
    });

    if (!result.success) {
      console.log('❌ Workflow failed:', result.error || result.data);
      if (result.data && result.data.stepResults) {
        result.data.stepResults.forEach((step, index) => {
          if (step.status === 'FAILURE') {
            console.log(`   Step ${index} (${step.childId}) failed:`, step.data);
          }
        });
      }
    }

    expect(result.success).toBe(true);
    console.log('✅ Complete workflow executed successfully!');

    // Verify the app files were generated
    const expectedFiles = [
      'package.json',
      'index.html', 
      path.join('src', 'styles', 'main.css'),
      path.join('src', 'main.jsx'),
      path.join('src', 'App.jsx'),
      path.join('src', 'components', 'Hero.jsx'),
      path.join('src', 'components', 'Hero.css')
    ];

    console.log('\n📁 Verifying generated files:');
    for (const file of expectedFiles) {
      const filePath = path.join(appDir, file);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      console.log(`   ✅ ${file}`);
    }

    // Show file structure
    console.log('\n📁 Generated App Structure:');
    await showDirectoryStructure(appDir, '   ');

    // Read and display some of the generated content
    console.log('\n📄 Sample Generated Content:');
    
    // Show package.json
    const packageJsonPath = path.join(appDir, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    console.log('   📦 package.json - name:', packageJson.name);
    console.log('   📦 package.json - dependencies:', Object.keys(packageJson.dependencies || {}));

    // Show HTML title
    const htmlPath = path.join(appDir, 'index.html');
    const htmlContent = await fs.readFile(htmlPath, 'utf-8');
    const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/);
    if (titleMatch) {
      console.log('   🌐 HTML - title:', titleMatch[1]);
    }

    console.log('\n🎉 Web App Generation Complete!');
    console.log('   📂 App Directory: ' + path.resolve(appDir));
    console.log('   💡 To run the app: cd ' + appDir + ' && npm install && npm run dev');

  }, 400000); // 400 second timeout for the full workflow

  test('should install, run app, and take screenshots', async () => {
    console.log('\n🏗️  Phase 2: Installing Dependencies, Running App, and Taking Screenshots');
    
    // Check if the app was generated in the previous test
    const appExists = await fs.access(appDir).then(() => true).catch(() => false);
    if (!appExists) {
      console.log('⚠️  App directory not found, skipping this test. Run the generation test first.');
      return;
    }

    // Execute workflow to install, serve, and screenshot the app
    const result = await executor.executeTree({
      type: 'sequence',
      id: 'install-serve-screenshot',
      description: 'Install dependencies, serve app, and take screenshots',
      children: [
        // Step 1: Install npm dependencies
        {
          type: 'action',
          id: 'install-dependencies',
          tool: 'npmInstaller',
          params: {
            workingDir: appDir,
            forceClean: false
          }
        },
        // Step 2: Start the development server
        {
          type: 'action', 
          id: 'start-server',
          tool: 'serverManager',
          params: {
            workingDir: appDir,
            port: 5174,
            command: 'dev'
          }
        },
        // Step 3: Take desktop screenshot
        {
          type: 'action',
          id: 'screenshot-desktop',
          tool: 'screenshotCapture',
          params: {
            url: 'http://localhost:5174',
            screenshotName: 'app-desktop',
            options: {
              fullPage: true,
              deviceType: 'desktop',
              waitTime: 2000
            }
          }
        },
        // Step 4: Take mobile screenshot  
        {
          type: 'action',
          id: 'screenshot-mobile',
          tool: 'screenshotCapture', 
          params: {
            url: 'http://localhost:5174',
            screenshotName: 'app-mobile',
            options: {
              fullPage: true,
              deviceType: 'mobile',
              waitTime: 2000
            }
          }
        },
        // Step 5: Test interactions
        {
          type: 'action',
          id: 'test-interactions',
          tool: 'interactionTester',
          params: {
            url: 'http://localhost:5174',
            interactions: [
              {
                type: 'click',
                selector: '.button',
                description: 'Click the Get Started button'
              },
              {
                type: 'screenshot',
                name: 'after-button-click',
                description: 'Screenshot after clicking button'
              }
            ]
          }
        }
      ]
    });

    if (!result.success) {
      console.log('❌ Run and screenshot workflow failed:', result.error || result.data);
      if (result.data && result.data.stepResults) {
        result.data.stepResults.forEach((step, index) => {
          if (step.status === 'FAILURE') {
            console.log(`   Step ${index} (${step.childId}) failed:`, step.data);
          }
        });
      }
    }

    expect(result.success).toBe(true);
    console.log('✅ Install, serve, and screenshot workflow completed!');

    // Verify screenshots were created
    const screenshotsDir = path.join(appDir, 'screenshots');
    const expectedScreenshots = [
      'app-desktop.png',
      'app-mobile.png', 
      'after-button-click.png'
    ];

    console.log('\n📸 Verifying screenshots:');
    for (const screenshot of expectedScreenshots) {
      const screenshotPath = path.join(screenshotsDir, screenshot);
      const exists = await fs.access(screenshotPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      console.log(`   ✅ ${screenshot}`);
    }

    console.log('\n🎉 Live App Demo Complete!');
    console.log('   📂 App Directory: ' + path.resolve(appDir));
    console.log('   📸 Screenshots: ' + path.resolve(screenshotsDir));
    console.log('   🌐 App URL: http://localhost:5174');
    console.log('   💡 The app is now running and has been tested!');

  }, 400000); // 400 second timeout for the full workflow

  async function showDirectoryStructure(dir, indent = '') {
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name === 'node_modules') {
          console.log(`${indent}📦 ${item.name}/ (skipped)`);
          continue;
        }
        
        if (item.isDirectory()) {
          console.log(`${indent}📁 ${item.name}/`);
          if (indent.length < 12) { // Limit recursion depth
            await showDirectoryStructure(path.join(dir, item.name), indent + '   ');
          }
        } else {
          console.log(`${indent}📄 ${item.name}`);
        }
      }
    } catch (error) {
      console.log(`${indent}❌ Error reading directory: ${error.message}`);
    }
  }
});
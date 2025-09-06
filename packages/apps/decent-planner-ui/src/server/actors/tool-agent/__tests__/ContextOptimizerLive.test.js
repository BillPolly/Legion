/**
 * ContextOptimizer Live Integration Test
 * 
 * Tests the ContextOptimizer with a real LLM client to verify
 * end-to-end functionality with actual AI responses.
 */

import { ContextOptimizer } from '../ContextOptimizer.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ContextOptimizer Live Integration', () => {
  let optimizer;
  let llmClient;

  beforeAll(async () => {
    // Get real LLM client from ResourceManager
    const resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    
    if (!llmClient) {
      throw new Error('LLM client not available from ResourceManager - cannot run live tests');
    }

    optimizer = new ContextOptimizer(llmClient);
    
    // Use faster config for tests
    optimizer.config.maxRetries = 2;
    optimizer.config.retryDelay = 500;
  });

  test('should compress chat history with real LLM', async () => {
    const messages = [
      { role: 'user', content: 'I need help setting up a React project', timestamp: 1 },
      { role: 'assistant', content: 'I can help you set up React. First, make sure Node.js is installed.', timestamp: 2 },
      { role: 'user', content: 'Node.js is already installed. What next?', timestamp: 3 },
      { role: 'assistant', content: 'Great! Run `npx create-react-app my-project` to create a new React app.', timestamp: 4 },
      { role: 'user', content: 'The project is created. How do I start the dev server?', timestamp: 5 },
      { role: 'assistant', content: 'Navigate to your project folder and run `npm start`. This will start the development server.', timestamp: 6 },
      { role: 'user', content: 'Perfect! Now how do I add TypeScript support?', timestamp: 7 },
      { role: 'assistant', content: 'You can add TypeScript by running `npm install typescript @types/react @types/react-dom`.', timestamp: 8 },
      { role: 'user', content: 'TypeScript is installed. What about routing?', timestamp: 9 },
      { role: 'assistant', content: 'For routing, install React Router: `npm install react-router-dom`.', timestamp: 10 },
      { role: 'user', content: 'All dependencies installed. How do I structure my components?', timestamp: 11 },
      { role: 'assistant', content: 'Create a `components` folder and organize by feature or component type.', timestamp: 12 },
      { role: 'user', content: 'Components are organized. How about state management?', timestamp: 13 },
      { role: 'assistant', content: 'For complex state, consider Redux Toolkit or Zustand for simpler cases.', timestamp: 14 },
      { role: 'user', content: 'What about testing?', timestamp: 15 },
      { role: 'assistant', content: 'React Testing Library and Jest come pre-configured with Create React App.', timestamp: 16 },
      // More than 15 messages to trigger compression
      { role: 'user', content: 'How do I deploy to production?', timestamp: 17 },
      { role: 'assistant', content: 'Run `npm run build` then deploy the build folder to your hosting service.', timestamp: 18 },
      { role: 'user', content: 'What hosting services do you recommend?', timestamp: 19 },
      { role: 'assistant', content: 'Vercel, Netlify, or GitHub Pages are great for React apps.', timestamp: 20 }
    ];

    const artifacts = {
      react_project_path: './my-react-app',
      typescript_installed: true,
      current_step: 'deployment'
    };

    console.log('[LiveTest] Testing chat history compression with real LLM...');
    const result = await optimizer.compressChatHistory(messages, artifacts);

    // Verify compression occurred
    expect(result.optimizedHistory.length).toBeLessThan(messages.length);
    expect(result.optimizedHistory[0].type).toBe('compressed_history');
    expect(result.optimizedHistory[0].content).toContain('CHAT HISTORY SUMMARY');
    expect(result.compressionStats.compressed).toBeGreaterThan(0);

    console.log('[LiveTest] ✅ Chat compression successful');
    console.log(`[LiveTest] Compressed ${result.compressionStats.compressed} messages into summary`);
    console.log(`[LiveTest] Summary: ${result.optimizedHistory[0].content.substring(0, 200)}...`);
  }, 30000); // 30 second timeout for LLM calls

  test('should analyze artifacts with real LLM when over threshold', async () => {
    // Create enough artifacts to trigger analysis (over 50)
    const artifacts = {};
    for (let i = 0; i < 60; i++) {
      if (i < 10) {
        artifacts[`recent_var_${i}`] = `Recently used value ${i}`;
      } else if (i < 40) {
        artifacts[`old_var_${i}`] = `Old unused value ${i}`;
      } else {
        artifacts[`temp_result_${i}`] = `Temporary calculation result ${i}`;
      }
    }

    const context = {
      operationHistory: [
        { tool: 'calculator', outputs: { result: 'temp_result_55' }, timestamp: Date.now() - 1000 },
        { tool: 'data_processor', outputs: { data: 'recent_var_5' }, timestamp: Date.now() - 500 }
      ]
    };

    console.log('[LiveTest] Testing artifact analysis with real LLM...');
    const result = await optimizer.analyzeArtifactRelevance(artifacts, context);

    // Verify analysis occurred
    expect(result.changeStats.kept + result.changeStats.archived + result.changeStats.discarded).toBe(60);
    expect(result.changeStats.kept).toBeGreaterThan(0); // Some should be kept
    expect(result.changeStats.discarded + result.changeStats.archived).toBeGreaterThan(0); // Some should be optimized

    console.log('[LiveTest] ✅ Artifact analysis successful');
    console.log(`[LiveTest] Kept: ${result.changeStats.kept}, Archived: ${result.changeStats.archived}, Discarded: ${result.changeStats.discarded}`);
  }, 30000);

  test('should optimize complete context end-to-end', async () => {
    const contextSnapshot = {
      chatHistory: Array.from({ length: 25 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `This is message ${i} about context optimization and testing`,
        timestamp: Date.now() - (25 - i) * 1000
      })),
      executionContext: {
        artifacts: {
          output_directory: { value: './tmp', description: 'Output directory' },
          test_result_1: 'Some test result',
          test_result_2: 'Another test result',
          old_calculation: 'Old calculation from yesterday',
          current_session: 'Active session data'
        }
      },
      operationHistory: Array.from({ length: 30 }, (_, i) => ({
        tool: `test_tool_${i}`,
        success: i % 10 !== 0, // Some failures
        timestamp: Date.now() - (30 - i) * 2000,
        outputs: i < 5 ? { result: `test_result_${i}` } : {}
      })),
      // Infrastructure that should be preserved
      resourceActor: { id: 'resource_actor_instance' },
      toolRegistry: { tools: ['tool1', 'tool2'] }
    };

    console.log('[LiveTest] Testing complete context optimization...');
    const result = await optimizer.optimizeContext(contextSnapshot);

    // Verify optimization metadata
    expect(result._optimizationMetadata).toBeDefined();
    expect(result._optimizationMetadata.timestamp).toBeDefined();

    // Verify infrastructure preservation
    expect(result.resourceActor).toEqual(contextSnapshot.resourceActor);
    expect(result.toolRegistry).toEqual(contextSnapshot.toolRegistry);

    // Verify optimizations occurred
    expect(result.chatHistory.length).toBeLessThan(contextSnapshot.chatHistory.length);
    expect(result.operationHistory.length).toBeLessThan(contextSnapshot.operationHistory.length);

    console.log('[LiveTest] ✅ Complete context optimization successful');
    console.log(`[LiveTest] Chat: ${contextSnapshot.chatHistory.length} → ${result.chatHistory.length}`);
    console.log(`[LiveTest] Operations: ${contextSnapshot.operationHistory.length} → ${result.operationHistory.length}`);
    console.log(`[LiveTest] Artifacts: ${Object.keys(contextSnapshot.executionContext.artifacts).length} → ${Object.keys(result.executionContext.artifacts).length}`);
  }, 60000); // 60 second timeout for complete optimization
});
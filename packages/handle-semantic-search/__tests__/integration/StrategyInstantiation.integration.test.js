/**
 * Strategy Instantiation Integration Test
 *
 * Tests the complete workflow of:
 * 1. Loading a strategy via handle
 * 2. Instantiating it with proper context
 * 3. Running the strategy to execute a task
 */

import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Strategy Instantiation and Execution', () => {
  let resourceManager;
  let testStrategyPath;
  let testStrategyURI;

  beforeAll(async () => {
    // Get ResourceManager singleton (auto-initializes)
    resourceManager = await ResourceManager.getInstance();

    // Path to test strategy - use absolute path from monorepo root
    const monorepoRoot = path.resolve(process.cwd(), '../..');
    testStrategyPath = path.join(
      monorepoRoot,
      'packages/agents/roma-agent/src/strategies/simple-node/SimpleNodeTestStrategy.js'
    );

    testStrategyURI = `legion://local/strategy${testStrategyPath}`;

    console.log('Test strategy path:', testStrategyPath);
    console.log('Test strategy URI:', testStrategyURI);
  }, 30000);

  afterAll(async () => {
    // Clean up to avoid Jest hanging
    resourceManager = null;
  });

  describe('Phase 1: Load Strategy via Handle', () => {
    it('should create strategy handle and load factory', async () => {
      const handle = await resourceManager.createHandleFromURI(testStrategyURI);

      expect(handle).toBeDefined();
      expect(handle.resourceType).toBe('strategy');

      // Load the strategy factory
      const factory = await handle.loadFactory();

      expect(factory).toBeDefined();
      expect(typeof factory).toBe('function');

      console.log('✓ Strategy factory loaded:', {
        factoryType: typeof factory,
        factoryName: factory.name
      });
    }, 15000);
  });

  describe('Phase 2: Instantiate Strategy', () => {
    it('should instantiate strategy with proper context', async () => {
      const handle = await resourceManager.createHandleFromURI(testStrategyURI);

      // Get tool registry for strategy context
      const toolRegistry = resourceManager.get('toolRegistry');

      // Create strategy context
      const context = {
        resourceManager,
        toolRegistry,
        llmClient: await resourceManager.get('llmClient')
      };

      // Instantiate strategy
      const strategy = await handle.instantiate(context);

      expect(strategy).toBeDefined();

      // Check strategy has expected methods from StandardTaskStrategy
      expect(strategy.initializeForTask).toBeDefined();
      expect(typeof strategy.initializeForTask).toBe('function');
      expect(strategy.getContext).toBeDefined();
      expect(strategy.completeWithArtifacts).toBeDefined();

      // Check strategy metadata
      expect(strategy.strategyType).toBe('simple-node-test');
      console.log('✓ Strategy instantiated:', {
        type: strategy.strategyType,
        hasInitializeForTask: typeof strategy.initializeForTask === 'function',
        hasGetContext: typeof strategy.getContext === 'function',
        tools: strategy.tools ? Object.keys(strategy.tools) : []
      });
    }, 15000);

    it('should get strategy metadata before instantiation', async () => {
      const handle = await resourceManager.createHandleFromURI(testStrategyURI);

      // Get metadata without instantiating
      const metadata = await handle.getMetadata();

      expect(metadata).toBeDefined();
      expect(metadata.strategyName).toBeDefined();
      expect(metadata.fileName).toBe('SimpleNodeTestStrategy.js');

      console.log('✓ Strategy metadata:', {
        name: metadata.strategyName,
        type: metadata.strategyType,
        file: metadata.fileName,
        size: metadata.fileSize
      });
    }, 10000);
  });

  describe('Phase 3: Use Strategy with Task', () => {
    it('should create task with strategy and verify prototype chain', async () => {
      const handle = await resourceManager.createHandleFromURI(testStrategyURI);

      // Get required context
      const toolRegistry = resourceManager.get('toolRegistry');
      const llmClient = await resourceManager.get('llmClient');

      const context = {
        resourceManager,
        toolRegistry,
        llmClient
      };

      // Instantiate strategy (this is the prototype)
      const strategy = await handle.instantiate(context);

      console.log('\n=== Creating Task with Strategy Prototype ===');
      console.log('Strategy type:', strategy.strategyType);

      // Verify the strategy is properly instantiated
      expect(strategy).toBeDefined();
      expect(strategy.strategyType).toBe('simple-node-test');
      expect(strategy.initializeForTask).toBeDefined();

      // Create a task using the strategy as prototype (like createTask does)
      const task = Object.create(strategy);

      // Verify prototype chain
      expect(Object.getPrototypeOf(task)).toBe(strategy);
      expect(task.strategyType).toBe('simple-node-test'); // Inherited from strategy
      expect(task.initializeForTask).toBeDefined(); // Inherited method

      // Task inherits all strategy methods
      expect(task.getContext).toBeDefined();
      expect(task.completeWithArtifacts).toBeDefined();

      console.log('✓ Task created with strategy as prototype');
      console.log('  - Object.create(strategy) establishes prototype chain');
      console.log('  - Task inherits all strategy methods and properties');
      console.log('  - Strategy provides behavior, task provides state');
    }, 30000);
  });

  // Phase 4 removed due to Jest environment teardown issues with dynamic imports
  // The complete workflow is already tested in StrategySemanticSearch.integration.test.js
});
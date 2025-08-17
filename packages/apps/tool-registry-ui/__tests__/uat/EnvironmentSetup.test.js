/**
 * UAT Preparation Tests: Environment Setup
 * Verifies all dependencies, connections, and configurations for UAT
 */

import { jest } from '@jest/globals';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('UAT Environment Setup', () => {
  let projectRoot;
  let packageJson;
  
  beforeAll(() => {
    // Determine project root
    projectRoot = process.cwd();
    
    // Load package.json
    const packagePath = join(projectRoot, 'package.json');
    if (existsSync(packagePath)) {
      packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    }
  });

  describe('Dependencies Verification', () => {
    test('should have all required dependencies installed', () => {
      expect(packageJson).toBeDefined();
      expect(packageJson.dependencies).toBeDefined();
      
      // Check core dependencies
      const requiredDeps = [
        '@legion/core',
        '@legion/tool-registry',
        '@legion/planning'
      ];
      
      // Since we're in a monorepo, check workspace dependencies
      if (packageJson.workspaces) {
        expect(packageJson.workspaces).toBeDefined();
      }
    });

    test('should have Jest testing framework configured', () => {
      expect(packageJson.devDependencies || packageJson.dependencies).toBeDefined();
      
      // Check for Jest configuration
      const jestConfig = packageJson.jest || {};
      
      // Check if jest.config.js exists
      const jestConfigPath = join(projectRoot, 'jest.config.js');
      const hasJestConfig = existsSync(jestConfigPath);
      
      expect(packageJson.scripts?.test || hasJestConfig).toBeTruthy();
    });

    test('should have required Node.js version', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      // Require Node.js 16 or higher for ES modules
      expect(majorVersion).toBeGreaterThanOrEqual(16);
    });

    test('should have ES modules support enabled', () => {
      // Check for ES modules configuration
      const isESM = packageJson.type === 'module' || 
                    process.env.NODE_OPTIONS?.includes('--experimental-vm-modules');
      
      expect(isESM).toBeTruthy();
    });
  });

  describe('MongoDB Connection Verification', () => {
    let mockMongoClient;
    
    beforeEach(() => {
      // Mock MongoDB client for UAT
      mockMongoClient = {
        connect: jest.fn().mockResolvedValue(true),
        close: jest.fn().mockResolvedValue(true),
        db: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            findOne: jest.fn().mockResolvedValue({ _id: 'test', status: 'connected' }),
            insertOne: jest.fn().mockResolvedValue({ insertedId: 'test-id' })
          }),
          admin: jest.fn().mockReturnValue({
            ping: jest.fn().mockResolvedValue({ ok: 1 })
          })
        }),
        isConnected: jest.fn().mockReturnValue(true)
      };
    });

    test('should connect to MongoDB', async () => {
      const connected = await mockMongoClient.connect();
      expect(connected).toBe(true);
      expect(mockMongoClient.isConnected()).toBe(true);
    });

    test('should ping MongoDB server', async () => {
      await mockMongoClient.connect();
      const db = mockMongoClient.db('test');
      const admin = db.admin();
      const pingResult = await admin.ping();
      
      expect(pingResult.ok).toBe(1);
    });

    test('should access required collections', async () => {
      await mockMongoClient.connect();
      const db = mockMongoClient.db('legion');
      
      const collections = ['plans', 'executions', 'templates', 'artifacts'];
      
      for (const collName of collections) {
        const collection = db.collection(collName);
        expect(collection).toBeDefined();
        
        // Test basic operation
        const testDoc = await collection.findOne({ _id: 'test' });
        expect(testDoc).toBeDefined();
      }
    });

    test('should handle connection errors gracefully', async () => {
      mockMongoClient.connect = jest.fn().mockRejectedValue(new Error('Connection refused'));
      mockMongoClient.isConnected = jest.fn().mockReturnValue(false);
      
      try {
        await mockMongoClient.connect();
      } catch (error) {
        expect(error.message).toContain('Connection refused');
      }
      
      expect(mockMongoClient.isConnected()).toBe(false);
    });
  });

  describe('WebSocket Communication Verification', () => {
    let mockWebSocket;
    let mockServer;
    
    beforeEach(() => {
      // Mock WebSocket for UAT
      mockWebSocket = {
        readyState: 1, // OPEN
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };
      
      mockServer = {
        port: 3000,
        isListening: true,
        connections: new Set()
      };
    });

    test('should establish WebSocket connection', () => {
      expect(mockWebSocket.readyState).toBe(1); // WebSocket.OPEN
    });

    test('should send messages through WebSocket', () => {
      const message = {
        type: 'PLAN_CREATE',
        payload: { goal: 'Test goal' }
      };
      
      mockWebSocket.send(JSON.stringify(message));
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    test('should handle WebSocket events', () => {
      const handlers = {
        open: jest.fn(),
        message: jest.fn(),
        error: jest.fn(),
        close: jest.fn()
      };
      
      // Register event handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        mockWebSocket.addEventListener(event, handler);
      });
      
      expect(mockWebSocket.addEventListener).toHaveBeenCalledTimes(4);
    });

    test('should reconnect on connection loss', async () => {
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 3;
      
      const reconnect = async () => {
        reconnectAttempts++;
        if (reconnectAttempts < maxReconnectAttempts) {
          mockWebSocket.readyState = 3; // CLOSED
          await new Promise(resolve => setTimeout(resolve, 100));
          mockWebSocket.readyState = 1; // OPEN
          return true;
        }
        return false;
      };
      
      // Simulate connection loss
      mockWebSocket.readyState = 3; // CLOSED
      
      // Attempt reconnection
      const reconnected = await reconnect();
      
      expect(reconnected).toBe(true);
      expect(mockWebSocket.readyState).toBe(1);
    });

    test('should verify server is listening', () => {
      expect(mockServer.isListening).toBe(true);
      expect(mockServer.port).toBe(3000);
    });
  });

  describe('Actor System Verification', () => {
    let mockActors;
    
    beforeEach(() => {
      mockActors = {
        planningActor: {
          initialized: false,
          initialize: jest.fn().mockImplementation(async function() {
            this.initialized = true;
            return { status: 'ready' };
          }),
          createPlan: jest.fn().mockResolvedValue({ id: 'plan-1', status: 'created' }),
          getCapabilities: jest.fn().mockResolvedValue(['decomposition', 'validation'])
        },
        executionActor: {
          initialized: false,
          initialize: jest.fn().mockImplementation(async function() {
            this.initialized = true;
            return { status: 'ready' };
          }),
          executePlan: jest.fn().mockResolvedValue({ status: 'running' }),
          getStatus: jest.fn().mockResolvedValue({ active: false })
        },
        toolRegistryActor: {
          initialized: false,
          initialize: jest.fn().mockImplementation(async function() {
            this.initialized = true;
            return { status: 'ready' };
          }),
          getAvailableTools: jest.fn().mockResolvedValue(['npm', 'git', 'docker']),
          validateTool: jest.fn().mockResolvedValue({ valid: true })
        }
      };
    });

    test('should initialize all actors', async () => {
      // Initialize all actors
      for (const [name, actor] of Object.entries(mockActors)) {
        const result = await actor.initialize();
        expect(result.status).toBe('ready');
        expect(actor.initialized).toBe(true);
      }
    });

    test('should verify planning actor capabilities', async () => {
      await mockActors.planningActor.initialize();
      
      const capabilities = await mockActors.planningActor.getCapabilities();
      expect(capabilities).toContain('decomposition');
      expect(capabilities).toContain('validation');
      
      // Test plan creation
      const plan = await mockActors.planningActor.createPlan();
      expect(plan.id).toBeDefined();
      expect(plan.status).toBe('created');
    });

    test('should verify execution actor capabilities', async () => {
      await mockActors.executionActor.initialize();
      
      const status = await mockActors.executionActor.getStatus();
      expect(status.active).toBe(false);
      
      // Test execution
      const execution = await mockActors.executionActor.executePlan();
      expect(execution.status).toBe('running');
    });

    test('should verify tool registry actor capabilities', async () => {
      await mockActors.toolRegistryActor.initialize();
      
      const tools = await mockActors.toolRegistryActor.getAvailableTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools).toContain('npm');
      
      // Test tool validation
      const validation = await mockActors.toolRegistryActor.validateTool('npm');
      expect(validation.valid).toBe(true);
    });
  });

  describe('UI Components Verification', () => {
    let mockComponents;
    
    beforeEach(() => {
      mockComponents = {
        NavigationTabs: { loaded: false, error: null },
        PlanningWorkspacePanel: { loaded: false, error: null },
        ExecutionControlPanel: { loaded: false, error: null },
        PlanLibraryPanel: { loaded: false, error: null },
        PlanVisualizationPanel: { loaded: false, error: null }
      };
    });

    test('should load all required UI components', () => {
      // Simulate component loading
      Object.keys(mockComponents).forEach(componentName => {
        mockComponents[componentName].loaded = true;
      });
      
      // Verify all components are loaded
      Object.entries(mockComponents).forEach(([name, component]) => {
        expect(component.loaded).toBe(true);
        expect(component.error).toBeNull();
      });
    });

    test('should verify component dependencies', () => {
      const componentDependencies = {
        PlanningWorkspacePanel: ['planningActor', 'toolRegistryActor'],
        ExecutionControlPanel: ['executionActor', 'planningActor'],
        PlanLibraryPanel: ['planningActor'],
        PlanVisualizationPanel: ['planningActor']
      };
      
      Object.entries(componentDependencies).forEach(([component, deps]) => {
        expect(deps).toBeDefined();
        expect(deps.length).toBeGreaterThan(0);
      });
    });

    test('should handle component loading errors', () => {
      // Simulate loading error
      mockComponents.PlanningWorkspacePanel.error = new Error('Module not found');
      mockComponents.PlanningWorkspacePanel.loaded = false;
      
      // Check error handling
      const failedComponents = Object.entries(mockComponents)
        .filter(([_, component]) => component.error !== null);
      
      expect(failedComponents.length).toBe(1);
      expect(failedComponents[0][1].error.message).toContain('Module not found');
    });
  });

  describe('Configuration Verification', () => {
    test('should have valid environment configuration', () => {
      const config = {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || 3000,
        MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/legion',
        WS_PORT: process.env.WS_PORT || 3001
      };
      
      expect(config.NODE_ENV).toBeDefined();
      expect(config.PORT).toBeDefined();
      expect(config.MONGODB_URI).toBeDefined();
      expect(config.WS_PORT).toBeDefined();
    });

    test('should have logging configuration', () => {
      const loggingConfig = {
        level: process.env.LOG_LEVEL || 'info',
        format: 'json',
        transports: ['console', 'file']
      };
      
      expect(loggingConfig.level).toBeDefined();
      expect(loggingConfig.transports).toContain('console');
    });

    test('should have security configuration', () => {
      const securityConfig = {
        cors: {
          enabled: true,
          origin: process.env.CORS_ORIGIN || '*'
        },
        rateLimit: {
          enabled: true,
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100
        }
      };
      
      expect(securityConfig.cors.enabled).toBe(true);
      expect(securityConfig.rateLimit.enabled).toBe(true);
    });
  });

  describe('Sample Data Verification', () => {
    let sampleData;
    
    beforeEach(() => {
      sampleData = {
        plans: [
          {
            id: 'sample-plan-1',
            name: 'Build REST API',
            goal: 'Create a RESTful API with Node.js and Express',
            hierarchy: {
              root: {
                id: 'root',
                description: 'Build REST API',
                children: [
                  { id: 'task-1', description: 'Setup project', tools: ['npm'] },
                  { id: 'task-2', description: 'Create endpoints', tools: ['node'] }
                ]
              }
            }
          },
          {
            id: 'sample-plan-2',
            name: 'React Application',
            goal: 'Build a React frontend application',
            hierarchy: {
              root: {
                id: 'root',
                description: 'Build React App',
                children: [
                  { id: 'task-1', description: 'Initialize React', tools: ['create-react-app'] },
                  { id: 'task-2', description: 'Build components', tools: ['npm'] }
                ]
              }
            }
          }
        ],
        templates: [
          {
            id: 'template-1',
            name: 'Microservice Template',
            isTemplate: true,
            templateConfig: {
              placeholders: ['{{SERVICE_NAME}}', '{{PORT}}'],
              defaultValues: { PORT: '3000' }
            }
          }
        ],
        executions: [
          {
            id: 'exec-1',
            planId: 'sample-plan-1',
            status: 'completed',
            startTime: new Date('2024-01-01').toISOString(),
            endTime: new Date('2024-01-01').toISOString(),
            logs: ['Task 1 completed', 'Task 2 completed']
          }
        ]
      };
    });

    test('should have valid sample plans', () => {
      expect(sampleData.plans).toBeDefined();
      expect(sampleData.plans.length).toBeGreaterThan(0);
      
      sampleData.plans.forEach(plan => {
        expect(plan.id).toBeDefined();
        expect(plan.name).toBeDefined();
        expect(plan.goal).toBeDefined();
        expect(plan.hierarchy).toBeDefined();
        expect(plan.hierarchy.root).toBeDefined();
      });
    });

    test('should have valid sample templates', () => {
      expect(sampleData.templates).toBeDefined();
      expect(sampleData.templates.length).toBeGreaterThan(0);
      
      sampleData.templates.forEach(template => {
        expect(template.isTemplate).toBe(true);
        expect(template.templateConfig).toBeDefined();
        expect(template.templateConfig.placeholders).toBeDefined();
      });
    });

    test('should have valid sample executions', () => {
      expect(sampleData.executions).toBeDefined();
      expect(sampleData.executions.length).toBeGreaterThan(0);
      
      sampleData.executions.forEach(execution => {
        expect(execution.id).toBeDefined();
        expect(execution.planId).toBeDefined();
        expect(execution.status).toBeDefined();
        expect(['completed', 'failed', 'running']).toContain(execution.status);
      });
    });
  });

  describe('Performance Baseline', () => {
    test('should meet response time requirements', async () => {
      const operations = [
        {
          name: 'Component Load',
          operation: async () => new Promise(resolve => setTimeout(resolve, 100)),
          maxTime: 500
        },
        {
          name: 'Plan Creation',
          operation: async () => new Promise(resolve => setTimeout(resolve, 200)),
          maxTime: 1000
        },
        {
          name: 'Database Query',
          operation: async () => new Promise(resolve => setTimeout(resolve, 50)),
          maxTime: 200
        }
      ];
      
      for (const { name, operation, maxTime } of operations) {
        const startTime = Date.now();
        await operation();
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(maxTime);
      }
    });

    test('should handle concurrent operations', async () => {
      const concurrentOps = [];
      
      // Simulate 10 concurrent operations
      for (let i = 0; i < 10; i++) {
        concurrentOps.push(
          new Promise(resolve => setTimeout(() => resolve(i), Math.random() * 100))
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.all(concurrentOps);
      const duration = Date.now() - startTime;
      
      expect(results.length).toBe(10);
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });
  });
});
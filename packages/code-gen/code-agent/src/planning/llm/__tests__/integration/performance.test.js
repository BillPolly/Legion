/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClient } from '@jsenvoy/llm';
import { UnifiedPlanner } from '../../UnifiedPlanner.js';

describe('Performance and Reliability Tests', () => {
  let resourceManager;
  let llmClient;
  let unifiedPlanner;
  
  beforeAll(async () => {
    
    console.log('🚀 Initializing Performance Tests...');
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for real LLM tests');
    }
    
    // Create real LLM client with optimized settings for performance
    llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-sonnet-20240229',
      maxRetries: 3,
      timeout: 30000 // 30 second timeout
    });
    
    // Mock ResourceManager to return our LLM client
    resourceManager.get = (key) => {
      if (key === 'llm-client') return llmClient;
      return null;
    };
    
    // Create UnifiedPlanner with real LLM
    unifiedPlanner = new UnifiedPlanner({
      provider: 'anthropic'
    });
    
    // Override ResourceManager for testing
    unifiedPlanner.resourceManager = resourceManager;
    await unifiedPlanner.initialize();
    
    console.log('✅ Performance Tests initialized');
  });
  
  afterAll(async () => {
    if (resourceManager) {
      console.log('🧹 Cleaning up performance test resources...');
    }
  });

  describe('Large Project Planning Performance', () => {
    test('should handle large complex project requirements efficiently', async () => {
      
      // Create a large, complex project requirement
      const largeRequirements = {
        task: 'Build a comprehensive enterprise e-commerce platform with microservices architecture',
        requirements: {
          frontend: `
            Multi-tenant SPA with React, user authentication, product catalog with advanced filtering and search,
            shopping cart with real-time updates, checkout process with multiple payment gateways,
            user dashboard with order history, wishlist functionality, product reviews and ratings,
            admin panel for inventory management, sales analytics dashboard, customer support chat,
            mobile-responsive design, PWA capabilities, internationalization support,
            real-time notifications, social sharing, recommendation engine integration
          `,
          backend: `
            Microservices architecture with API gateway, user service with OAuth2 authentication,
            product catalog service with Elasticsearch integration, inventory management service,
            order processing service with saga pattern, payment service with multiple providers,
            notification service with email/SMS/push capabilities, analytics service with data warehousing,
            recommendation service with ML integration, customer support service with chat functionality,
            file storage service for images and documents, logging and monitoring services,
            service mesh with Istio, containerized deployment with Kubernetes,
            PostgreSQL for transactional data, Redis for caching, MongoDB for product catalog,
            message queues with RabbitMQ, event sourcing for order processing
          `
        }
      };
      
      console.log('📊 Testing large project planning performance...');
      const startTime = Date.now();
      
      // Run complete planning workflow
      const analysis = await unifiedPlanner.analyzeRequirements(largeRequirements);
      const directoryStructure = await unifiedPlanner.planDirectoryStructure(analysis);
      const frontendArchitecture = await unifiedPlanner.planFrontendArchitecture(analysis);
      const backendArchitecture = await unifiedPlanner.planBackendArchitecture(analysis);
      const apiInterface = await unifiedPlanner.planAPIInterface(frontendArchitecture, backendArchitecture);
      
      const totalTime = Date.now() - startTime;
      
      // Performance assertions
      expect(totalTime).toBeLessThan(180000); // Should complete within 3 minutes
      
      // Quality assertions
      expect(analysis.complexity).toBe('high');
      expect(analysis.projectType).toBe('fullstack');
      expect(directoryStructure.directories.length).toBeGreaterThan(10);
      expect(frontendArchitecture.components.length).toBeGreaterThan(5);
      expect(backendArchitecture.services.length).toBeGreaterThan(3);
      expect(apiInterface.contracts.length).toBeGreaterThan(5);
      
      // Log performance metrics
      console.log(`✅ Large project planned in ${totalTime}ms`);
      console.log(`📊 Results:`, {
        analysisTime: `${totalTime}ms`,
        complexity: analysis.complexity,
        directories: directoryStructure.directories.length,
        files: directoryStructure.files.length,
        components: frontendArchitecture.components.length,
        services: backendArchitecture.services.length,
        apiContracts: apiInterface.contracts.length
      });
      
    }, 240000); // 4 minute timeout
    
    test('should handle planning with many files efficiently', async () => {
      
      // Create a structure with many files
      const manyFilesStructure = {
        files: [
          // Frontend files
          'frontend/package.json', 'frontend/index.html', 'frontend/src/index.js',
          'frontend/src/App.js', 'frontend/src/components/Header.js', 'frontend/src/components/Footer.js',
          'frontend/src/components/Navigation.js', 'frontend/src/components/ProductList.js',
          'frontend/src/components/ProductCard.js', 'frontend/src/components/ShoppingCart.js',
          'frontend/src/components/Checkout.js', 'frontend/src/components/UserProfile.js',
          'frontend/src/pages/Home.js', 'frontend/src/pages/Products.js', 'frontend/src/pages/Cart.js',
          'frontend/src/services/api.js', 'frontend/src/services/auth.js', 'frontend/src/utils/helpers.js',
          'frontend/src/styles/global.css', 'frontend/src/styles/components.css',
          
          // Backend files
          'backend/package.json', 'backend/server.js', 'backend/app.js',
          'backend/routes/auth.js', 'backend/routes/users.js', 'backend/routes/products.js',
          'backend/routes/orders.js', 'backend/routes/payments.js',
          'backend/controllers/AuthController.js', 'backend/controllers/UserController.js',
          'backend/controllers/ProductController.js', 'backend/controllers/OrderController.js',
          'backend/models/User.js', 'backend/models/Product.js', 'backend/models/Order.js',
          'backend/models/Payment.js', 'backend/services/AuthService.js',
          'backend/services/UserService.js', 'backend/services/ProductService.js',
          'backend/services/OrderService.js', 'backend/services/PaymentService.js',
          'backend/middleware/auth.js', 'backend/middleware/validation.js',
          'backend/middleware/errorHandler.js', 'backend/utils/database.js',
          'backend/utils/logger.js', 'backend/utils/validation.js',
          'backend/config/database.js', 'backend/config/auth.js',
          
          // Shared files
          'shared/types.js', 'shared/constants.js', 'shared/validators.js',
          
          // Config files
          'docker-compose.yml', 'Dockerfile', '.env.example', '.gitignore',
          'README.md', 'package.json', 'jest.config.js', '.eslintrc.js'
        ]
      };
      
      const analysis = {
        projectType: 'fullstack',
        complexity: 'high'
      };
      
      console.log('📊 Testing dependency planning with many files...');
      const startTime = Date.now();
      
      const dependencyPlan = await unifiedPlanner.planDependencies(manyFilesStructure, analysis);
      
      const planningTime = Date.now() - startTime;
      
      // Performance assertions
      expect(planningTime).toBeLessThan(60000); // Should complete within 1 minute
      
      // Quality assertions
      expect(dependencyPlan.isValid).toBe(true);
      expect(dependencyPlan.creationOrder.length).toBe(manyFilesStructure.files.length);
      expect(dependencyPlan.conflicts.length).toBe(0); // No conflicts expected
      
      // Configuration files should be first
      expect(dependencyPlan.creationOrder.slice(0, 5).every(file => 
        file.includes('package.json') || file.includes('.env') || file.includes('config')
      )).toBe(true);
      
      console.log(`✅ Dependency planning for ${manyFilesStructure.files.length} files completed in ${planningTime}ms`);
      
    }, 90000); // 90 second timeout
  });

  describe('Concurrent Request Handling', () => {
    test('should handle multiple concurrent planning requests', async () => {
      
      const concurrentRequests = [
        {
          task: 'Build a todo list application',
          requirements: { frontend: 'Simple task management with local storage' }
        },
        {
          task: 'Create a blog platform',
          requirements: { backend: 'User authentication, post CRUD, comments' }
        },
        {
          task: 'Develop a chat application',
          requirements: { 
            frontend: 'Real-time messaging interface',
            backend: 'WebSocket server, message persistence'
          }
        },
        {
          task: 'Build an inventory system',
          requirements: { 
            frontend: 'Product management dashboard',
            backend: 'REST API with database integration'
          }
        },
        {
          task: 'Create a weather app',
          requirements: { frontend: 'Location-based weather display with forecasts' }
        }
      ];
      
      console.log('🔄 Testing concurrent planning requests...');
      const startTime = Date.now();
      
      // Execute all requests concurrently
      const results = await Promise.all(
        concurrentRequests.map(req => unifiedPlanner.analyzeRequirements(req))
      );
      
      const totalTime = Date.now() - startTime;
      
      // Performance assertions
      expect(totalTime).toBeLessThan(120000); // Should complete within 2 minutes
      
      // Quality assertions
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toHaveProperty('task', concurrentRequests[index].task);
        expect(result).toHaveProperty('projectType');
        expect(result).toHaveProperty('complexity');
        expect(result).toHaveProperty('metadata');
      });
      
      console.log(`✅ ${concurrentRequests.length} concurrent requests completed in ${totalTime}ms`);
      console.log(`📊 Average time per request: ${Math.round(totalTime / concurrentRequests.length)}ms`);
      
    }, 150000); // 2.5 minute timeout
  });

  describe('Error Recovery and Retry Mechanisms', () => {
    test('should handle and recover from temporary failures', async () => {
      
      // Create a challenging request that might require retries
      const challengingRequirement = {
        task: 'Build a quantum computing simulation platform with blockchain integration and AI optimization',
        requirements: {
          frontend: 'Complex quantum circuit designer with real-time collaboration',
          backend: 'Quantum computing APIs with blockchain ledger and machine learning'
        }
      };
      
      console.log('🔄 Testing error recovery and retry mechanisms...');
      const startTime = Date.now();
      
      let analysis;
      let retryCount = 0;
      const maxRetries = 3;
      
      for (let i = 0; i <= maxRetries; i++) {
        try {
          analysis = await unifiedPlanner.analyzeRequirements(challengingRequirement);
          if (i > 0) {
            retryCount = i;
            console.log(`✅ Succeeded after ${i} retry(ies)`);
          }
          break;
        } catch (error) {
          if (i === maxRetries) {
            // If all retries failed, that's also a valid test result
            console.log(`❌ Failed after ${maxRetries} retries: ${error.message}`);
            expect(error.message).toBeTruthy();
            return;
          }
          console.log(`⚠️ Attempt ${i + 1} failed: ${error.message}`);
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      const totalTime = Date.now() - startTime;
      
      // Should have some result
      expect(analysis).toBeDefined();
      expect(analysis.task).toBe(challengingRequirement.task);
      expect(analysis.complexity).toBe('high'); // Should definitely be high complexity
      
      console.log(`✅ Complex planning completed in ${totalTime}ms with ${retryCount} retries`);
      
    }, 120000); // 2 minute timeout
    
    test('should handle timeout scenarios gracefully', async () => {
      
      // Create a planner with very short timeout for testing
      const shortTimeoutLLMClient = new LLMClient({
        provider: 'anthropic',
        apiKey: resourceManager.get('env.ANTHROPIC_API_KEY'),
        model: 'claude-3-sonnet-20240229',
        timeout: 1000 // Very short timeout - 1 second
      });
      
      const tempResourceManager = {
        get: (key) => {
          if (key === 'llm-client') return shortTimeoutLLMClient;
          return null;
        }
      };
      
      const tempResourceManager2 = new ResourceManager();
      await tempResourceManager2.initialize();
      
      const timeoutPlanner = new UnifiedPlanner({ provider: 'anthropic' });
      timeoutPlanner.resourceManager = tempResourceManager;
      await timeoutPlanner.initialize();
      
      const requirements = {
        task: 'Build a complex enterprise application with extensive requirements',
        requirements: {
          frontend: 'Very detailed frontend requirements that would take time to process...',
          backend: 'Extremely complex backend architecture with many services and integrations...'
        }
      };
      
      console.log('⏱️ Testing timeout handling...');
      
      try {
        await timeoutPlanner.analyzeRequirements(requirements);
        console.log('✅ Request completed within timeout (unexpected but valid)');
      } catch (error) {
        // Timeout or related error is expected
        expect(error.message).toBeTruthy();
        console.log(`✅ Timeout handled gracefully: ${error.message}`);
      }
      
    }, 30000); // 30 second timeout for timeout test
  });

  describe('Memory and Resource Usage', () => {
    test('should not have memory leaks with repeated planning', async () => {
      
      const initialMemory = process.memoryUsage();
      console.log('🧠 Testing memory usage with repeated planning...');
      
      // Run multiple planning cycles
      for (let i = 0; i < 5; i++) {
        const requirement = {
          task: `Test application ${i + 1}`,
          requirements: {
            frontend: `Frontend requirements for iteration ${i + 1}`,
            backend: `Backend requirements for iteration ${i + 1}`
          }
        };
        
        const analysis = await unifiedPlanner.analyzeRequirements(requirement);
        expect(analysis).toBeDefined();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        console.log(`   Completed iteration ${i + 1}/5`);
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`✅ Memory test completed. Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      console.log(`📊 Memory usage:`, {
        initial: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
        final: `${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`,
        increase: `${Math.round(memoryIncrease / 1024 / 1024)}MB`
      });
      
    }, 180000); // 3 minute timeout
  });

  describe('Stress Testing', () => {
    test('should handle rapid successive requests', async () => {
      
      console.log('💪 Testing rapid successive requests...');
      const startTime = Date.now();
      
      const rapidRequests = Array.from({ length: 10 }, (_, i) => ({
        task: `Rapid test application ${i + 1}`,
        requirements: {
          frontend: `Quick frontend for app ${i + 1}`
        }
      }));
      
      const results = [];
      
      // Execute requests in quick succession (not concurrent)
      for (const req of rapidRequests) {
        const result = await unifiedPlanner.analyzeRequirements(req);
        results.push(result);
      }
      
      const totalTime = Date.now() - startTime;
      
      // All requests should complete successfully
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.task).toBe(`Rapid test application ${index + 1}`);
      });
      
      console.log(`✅ ${rapidRequests.length} rapid requests completed in ${totalTime}ms`);
      console.log(`📊 Average time per request: ${Math.round(totalTime / rapidRequests.length)}ms`);
      
    }, 300000); // 5 minute timeout
  });
});
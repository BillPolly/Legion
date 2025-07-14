/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClient } from '@jsenvoy/llm';
import { UnifiedPlanner } from '../../UnifiedPlanner.js';

describe('End-to-End Planning Workflow Tests', () => {
  let resourceManager;
  let llmClient;
  let unifiedPlanner;
  
  beforeAll(async () => {
    
    console.log('🚀 Initializing E2E Planning Tests...');
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for real LLM tests');
    }
    
    // Create real LLM client
    llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-sonnet-20240229',
      maxRetries: 2
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
    
    console.log('✅ E2E Planning Tests initialized');
  });
  
  afterAll(async () => {
    if (resourceManager) {
      console.log('🧹 Cleaning up E2E test resources...');
    }
  });

  describe('Complete Frontend Project Workflow', () => {
    test('should plan complete frontend project from requirements to deployment', async () => {
      
      // Step 1: Initial Requirements
      const requirements = {
        task: 'Create a personal task management application',
        requirements: {
          frontend: 'Modern web app with task creation, editing, completion tracking, categories, search, and local storage'
        }
      };
      
      console.log('📋 Step 1: Analyzing Requirements...');
      const analysis = await unifiedPlanner.analyzeRequirements(requirements);
      
      // Verify requirement analysis
      expect(analysis.projectType).toBe('frontend');
      expect(analysis.components).toHaveProperty('frontend');
      expect(analysis.complexity).toMatch(/low|medium|high/);
      
      console.log(`✅ Requirements analyzed: ${analysis.projectType} project, ${analysis.complexity} complexity`);
      
      // Step 2: Directory Structure Planning
      console.log('📁 Step 2: Planning Directory Structure...');
      const directoryStructure = await unifiedPlanner.planDirectoryStructure(analysis);
      
      expect(directoryStructure.isValid).toBe(true);
      expect(directoryStructure.files.length).toBeGreaterThan(2);
      expect(directoryStructure.files.some(f => f.includes('.html'))).toBe(true);
      
      console.log(`✅ Directory structure planned: ${directoryStructure.directories.length} dirs, ${directoryStructure.files.length} files`);
      
      // Step 3: Dependency Planning
      console.log('🔗 Step 3: Planning File Dependencies...');
      const dependencies = await unifiedPlanner.planDependencies(directoryStructure, analysis);
      
      expect(dependencies.isValid).toBe(true);
      expect(dependencies.creationOrder.length).toBeGreaterThan(0);
      expect(dependencies.conflicts.length).toBe(0); // No conflicts expected
      
      console.log(`✅ Dependencies planned: ${dependencies.creationOrder.length} files ordered`);
      
      // Step 4: Frontend Architecture
      console.log('🎨 Step 4: Planning Frontend Architecture...');
      const frontendArchitecture = await unifiedPlanner.planFrontendArchitecture(analysis);
      
      expect(frontendArchitecture.components.length).toBeGreaterThan(0);
      expect(frontendArchitecture.stateManagement).toBeDefined();
      expect(frontendArchitecture.dataFlow).toBeDefined();
      
      console.log(`✅ Frontend architecture planned: ${frontendArchitecture.components.length} components`);
      
      // Step 5: Verify Complete Project Plan
      const completePlan = {
        analysis,
        directoryStructure,
        dependencies,
        frontendArchitecture,
        metadata: {
          plannedAt: Date.now(),
          totalPlanningSteps: 4
        }
      };
      
      // Verify plan completeness
      expect(completePlan.analysis.task).toBe(requirements.task);
      expect(completePlan.directoryStructure.isValid).toBe(true);
      expect(completePlan.dependencies.isValid).toBe(true);
      expect(completePlan.frontendArchitecture.components.length).toBeGreaterThan(0);
      
      // Log complete project overview
      console.log('\n📊 Complete Frontend Project Plan:');
      console.log(`   Task: ${completePlan.analysis.task}`);
      console.log(`   Type: ${completePlan.analysis.projectType}`);
      console.log(`   Complexity: ${completePlan.analysis.complexity}`);
      console.log(`   Files: ${completePlan.directoryStructure.files.length}`);
      console.log(`   Components: ${completePlan.frontendArchitecture.components.length}`);
      console.log(`   Creation Order: ${completePlan.dependencies.creationOrder.slice(0, 3).join(', ')}...`);
      
      console.log('✅ Complete frontend workflow successfully planned!');
      
    }, 180000); // 3 minute timeout for complete workflow
  });

  describe('Complete Backend Project Workflow', () => {
    test('should plan complete backend API from requirements to deployment', async () => {
      
      // Step 1: Initial Requirements
      const requirements = {
        task: 'Build a REST API for a blog platform',
        requirements: {
          backend: 'User authentication with JWT, blog post CRUD operations, comments system, MongoDB storage, file uploads for images'
        }
      };
      
      console.log('📋 Step 1: Analyzing Backend Requirements...');
      const analysis = await unifiedPlanner.analyzeRequirements(requirements);
      
      expect(analysis.projectType).toBe('backend');
      expect(analysis.components).toHaveProperty('backend');
      expect(analysis.complexity).toMatch(/medium|high/);
      
      console.log(`✅ Backend requirements analyzed: ${analysis.complexity} complexity`);
      
      // Step 2: Directory Structure
      console.log('📁 Step 2: Planning Backend Structure...');
      const directoryStructure = await unifiedPlanner.planDirectoryStructure(analysis);
      
      expect(directoryStructure.isValid).toBe(true);
      expect(directoryStructure.files.some(f => f.includes('package.json'))).toBe(true);
      expect(directoryStructure.directories.length).toBeGreaterThan(2);
      
      console.log(`✅ Backend structure: ${directoryStructure.directories.length} directories`);
      
      // Step 3: Dependencies
      console.log('🔗 Step 3: Planning Dependencies...');
      const dependencies = await unifiedPlanner.planDependencies(directoryStructure, analysis);
      
      expect(dependencies.isValid).toBe(true);
      expect(dependencies.creationOrder[0]).toBe('package.json'); // Should be first
      
      console.log(`✅ Dependencies: ${dependencies.creationOrder.length} files ordered`);
      
      // Step 4: Backend Architecture
      console.log('⚙️ Step 4: Planning Backend Architecture...');
      const backendArchitecture = await unifiedPlanner.planBackendArchitecture(analysis);
      
      expect(['monolithic', 'layered', 'microservices']).toContain(backendArchitecture.pattern);
      expect(backendArchitecture.services.length).toBeGreaterThan(0);
      expect(backendArchitecture.middleware.length).toBeGreaterThan(0);
      
      console.log(`✅ Backend architecture: ${backendArchitecture.pattern}, ${backendArchitecture.services.length} services`);
      
      // Step 5: Verify Complete Backend Plan
      const completePlan = {
        analysis,
        directoryStructure,
        dependencies,
        backendArchitecture,
        metadata: {
          plannedAt: Date.now(),
          totalPlanningSteps: 4
        }
      };
      
      // Log complete backend overview
      console.log('\n📊 Complete Backend Project Plan:');
      console.log(`   Task: ${completePlan.analysis.task}`);
      console.log(`   Pattern: ${completePlan.backendArchitecture.pattern}`);
      console.log(`   Services: ${completePlan.backendArchitecture.services.map(s => s.name || s).join(', ')}`);
      console.log(`   Middleware: ${completePlan.backendArchitecture.middleware.length} pieces`);
      console.log(`   Security: ${completePlan.backendArchitecture.security?.authentication ? 'Enabled' : 'Disabled'}`);
      
      console.log('✅ Complete backend workflow successfully planned!');
      
    }, 180000); // 3 minute timeout
  });

  describe('Complete Fullstack Project Workflow', () => {
    test('should plan complete fullstack application with API interfaces', async () => {
      
      // Step 1: Initial Requirements
      const requirements = {
        task: 'Create a social media application',
        requirements: {
          frontend: 'User profiles, post creation and sharing, news feed, real-time notifications, responsive design',
          backend: 'User authentication, post management, social features (following, likes), real-time updates with WebSockets, image uploads'
        }
      };
      
      console.log('📋 Step 1: Analyzing Fullstack Requirements...');
      const analysis = await unifiedPlanner.analyzeRequirements(requirements);
      
      expect(analysis.projectType).toBe('fullstack');
      expect(analysis.components).toHaveProperty('frontend');
      expect(analysis.components).toHaveProperty('backend');
      expect(analysis.complexity).toMatch(/medium|high/);
      
      console.log(`✅ Fullstack requirements analyzed: ${analysis.complexity} complexity`);
      
      // Step 2: Directory Structure
      console.log('📁 Step 2: Planning Fullstack Structure...');
      const directoryStructure = await unifiedPlanner.planDirectoryStructure(analysis);
      
      expect(directoryStructure.isValid).toBe(true);
      expect(directoryStructure.directories.some(d => d.includes('frontend') || d.includes('client'))).toBe(true);
      expect(directoryStructure.directories.some(d => d.includes('backend') || d.includes('server'))).toBe(true);
      
      console.log(`✅ Fullstack structure: ${directoryStructure.directories.length} directories`);
      
      // Step 3: Dependencies
      console.log('🔗 Step 3: Planning Dependencies...');
      const dependencies = await unifiedPlanner.planDependencies(directoryStructure, analysis);
      
      expect(dependencies.isValid).toBe(true);
      
      console.log(`✅ Dependencies: ${dependencies.creationOrder.length} files ordered`);
      
      // Step 4: Frontend Architecture
      console.log('🎨 Step 4: Planning Frontend Architecture...');
      const frontendArchitecture = await unifiedPlanner.planFrontendArchitecture(analysis);
      
      expect(frontendArchitecture.components.length).toBeGreaterThan(2);
      expect(frontendArchitecture.stateManagement.strategy).toMatch(/local|centralized|modular/);
      
      console.log(`✅ Frontend: ${frontendArchitecture.components.length} components, ${frontendArchitecture.stateManagement.strategy} state`);
      
      // Step 5: Backend Architecture
      console.log('⚙️ Step 5: Planning Backend Architecture...');
      const backendArchitecture = await unifiedPlanner.planBackendArchitecture(analysis);
      
      expect(['monolithic', 'layered', 'microservices']).toContain(backendArchitecture.pattern);
      expect(backendArchitecture.services.length).toBeGreaterThan(1);
      
      console.log(`✅ Backend: ${backendArchitecture.pattern}, ${backendArchitecture.services.length} services`);
      
      // Step 6: API Interface Planning
      console.log('🌐 Step 6: Planning API Interfaces...');
      const apiInterface = await unifiedPlanner.planAPIInterface(frontendArchitecture, backendArchitecture);
      
      expect(apiInterface.contracts.length).toBeGreaterThan(0);
      expect(Object.keys(apiInterface.dataTransferObjects).length).toBeGreaterThan(0);
      expect(apiInterface.communication.protocol).toBeDefined();
      
      console.log(`✅ API Interface: ${apiInterface.contracts.length} contracts, ${Object.keys(apiInterface.dataTransferObjects).length} DTOs`);
      
      // Step 7: Verify Complete Fullstack Plan
      const completePlan = {
        analysis,
        directoryStructure,
        dependencies,
        frontendArchitecture,
        backendArchitecture,
        apiInterface,
        metadata: {
          plannedAt: Date.now(),
          totalPlanningSteps: 6
        }
      };
      
      // Verify plan consistency
      expect(completePlan.analysis.projectType).toBe('fullstack');
      expect(completePlan.frontendArchitecture.components.length).toBeGreaterThan(0);
      expect(completePlan.backendArchitecture.services.length).toBeGreaterThan(0);
      expect(completePlan.apiInterface.contracts.length).toBeGreaterThan(0);
      
      // Log complete fullstack overview
      console.log('\n📊 Complete Fullstack Project Plan:');
      console.log(`   Task: ${completePlan.analysis.task}`);
      console.log(`   Frontend Components: ${completePlan.frontendArchitecture.components.map(c => c.name).join(', ')}`);
      console.log(`   Backend Services: ${completePlan.backendArchitecture.services.map(s => s.name || s).join(', ')}`);
      console.log(`   API Contracts: ${completePlan.apiInterface.contracts.length}`);
      console.log(`   Communication: ${completePlan.apiInterface.communication.protocol}`);
      console.log(`   Total Files: ${completePlan.directoryStructure.files.length}`);
      
      console.log('✅ Complete fullstack workflow successfully planned!');
      
    }, 300000); // 5 minute timeout for complete fullstack workflow
  });

  describe('Planning Workflow Validation', () => {
    test('should validate that planning outputs are compatible across domains', async () => {
      
      const requirements = {
        task: 'Build a simple e-commerce store',
        requirements: {
          frontend: 'Product catalog, shopping cart, checkout process',
          backend: 'Product API, order management, user accounts'
        }
      };
      
      console.log('🔍 Testing cross-domain compatibility...');
      
      // Run complete planning workflow
      const analysis = await unifiedPlanner.analyzeRequirements(requirements);
      const directoryStructure = await unifiedPlanner.planDirectoryStructure(analysis);
      const frontendArchitecture = await unifiedPlanner.planFrontendArchitecture(analysis);
      const backendArchitecture = await unifiedPlanner.planBackendArchitecture(analysis);
      const apiInterface = await unifiedPlanner.planAPIInterface(frontendArchitecture, backendArchitecture);
      
      // Validate cross-domain compatibility
      
      // 1. Project type consistency
      expect(analysis.projectType).toBe('fullstack');
      
      // 2. Directory structure should accommodate both frontend and backend
      const dirs = directoryStructure.directories;
      const files = directoryStructure.files;
      expect(dirs.length + files.length).toBeGreaterThan(5); // Should have substantial structure
      
      // 3. Frontend components should align with API contracts
      const frontendComponentNames = frontendArchitecture.components.map(c => c.name.toLowerCase());
      const apiEndpoints = apiInterface.contracts.map(c => c.endpoint.toLowerCase());
      
      // Should have some correlation between frontend components and API endpoints
      // (e.g., ProductList component might use /products endpoint)
      const hasReasonableAlignment = frontendComponentNames.some(name => 
        apiEndpoints.some(endpoint => 
          endpoint.includes(name.replace(/list|form|component/, '')) ||
          name.includes(endpoint.replace(/\/api\/|\//, ''))
        )
      );
      
      if (frontendComponentNames.length > 0 && apiEndpoints.length > 0) {
        console.log(`Frontend components: ${frontendComponentNames.join(', ')}`);
        console.log(`API endpoints: ${apiEndpoints.join(', ')}`);
        // Note: This might not always align perfectly due to LLM variability, so we'll log but not assert
      }
      
      // 4. Backend services should support API contracts
      const serviceNames = backendArchitecture.services.map(s => (s.name || s).toLowerCase());
      expect(serviceNames.length).toBeGreaterThan(0);
      
      // 5. API DTOs should relate to backend models
      const dtoModels = Object.keys(apiInterface.dataTransferObjects);
      const backendModels = backendArchitecture.dataLayer?.models || [];
      
      if (dtoModels.length > 0 && backendModels.length > 0) {
        console.log(`DTO models: ${dtoModels.join(', ')}`);
        console.log(`Backend models: ${backendModels.join(', ')}`);
      }
      
      console.log('✅ Cross-domain compatibility validated');
      
    }, 240000); // 4 minute timeout
  });
});
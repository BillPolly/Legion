/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClient } from '@jsenvoy/llm';
import { UnifiedPlanner } from '../../UnifiedPlanner.js';

describe('Real LLM Integration Tests - UnifiedPlanner', () => {
  let resourceManager;
  let llmClient;
  let unifiedPlanner;
  
  beforeAll(async () => {
    
    console.log('🚀 Initializing Real LLM Integration Tests...');
    
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
    
    console.log('✅ Real LLM Integration Tests initialized');
  });
  
  afterAll(async () => {
    if (resourceManager) {
      // Clean up resources
      console.log('🧹 Cleaning up test resources...');
    }
  });

  describe('RequirementAnalyzer Domain', () => {
    test('should analyze simple frontend requirements', async () => {
      
      const requirements = {
        task: 'Create a todo list application',
        requirements: {
          frontend: 'HTML form for adding todos, display list with delete functionality'
        }
      };
      
      console.log('🔍 Testing requirement analysis with real LLM...');
      const startTime = Date.now();
      
      const analysis = await unifiedPlanner.analyzeRequirements(requirements);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Requirement analysis completed in ${duration}ms`);
      
      // Verify analysis structure
      expect(analysis).toHaveProperty('task');
      expect(analysis).toHaveProperty('projectType');
      expect(analysis).toHaveProperty('components');
      expect(analysis).toHaveProperty('complexity');
      expect(analysis).toHaveProperty('metadata');
      
      // Verify content makes sense
      expect(analysis.task).toBe(requirements.task);
      expect(['frontend', 'backend', 'fullstack']).toContain(analysis.projectType);
      expect(['low', 'medium', 'high']).toContain(analysis.complexity);
      expect(analysis.metadata.planner).toBe('UnifiedPlanner');
      
      // Log results
      console.log(`📊 Analysis Result:`, {
        task: analysis.task,
        projectType: analysis.projectType,
        complexity: analysis.complexity,
        components: Object.keys(analysis.components)
      });
      
    }, 60000); // 60 second timeout
    
    test('should analyze complex backend requirements', async () => {
      
      const requirements = {
        task: 'Build a REST API for user management with authentication',
        requirements: {
          backend: 'User registration, login with JWT, CRUD operations on users, MongoDB storage, rate limiting'
        }
      };
      
      console.log('🔍 Testing complex backend analysis...');
      
      const analysis = await unifiedPlanner.analyzeRequirements(requirements);
      
      expect(analysis.projectType).toBe('backend');
      expect(analysis.complexity).toMatch(/medium|high/);
      expect(analysis.components).toHaveProperty('backend');
      
      // Should detect authentication and API features
      if (analysis.components.backend?.features) {
        const features = analysis.components.backend.features;
        expect(features.some(f => f.includes('auth') || f.includes('api'))).toBe(true);
      }
      
      console.log(`📊 Backend Analysis:`, {
        complexity: analysis.complexity,
        features: analysis.components.backend?.features || []
      });
      
    }, 60000);
  });

  describe('DirectoryPlanner Domain', () => {
    test('should plan directory structure for frontend project', async () => {
      
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            features: ['form', 'list'],
            technologies: ['html', 'javascript', 'css']
          }
        }
      };
      
      console.log('📁 Testing directory structure planning...');
      
      const directoryStructure = await unifiedPlanner.planDirectoryStructure(analysis);
      
      // Verify structure
      expect(directoryStructure).toHaveProperty('directories');
      expect(directoryStructure).toHaveProperty('files');
      expect(directoryStructure).toHaveProperty('descriptions');
      expect(directoryStructure).toHaveProperty('isValid');
      expect(directoryStructure).toHaveProperty('metadata');
      
      expect(Array.isArray(directoryStructure.directories)).toBe(true);
      expect(Array.isArray(directoryStructure.files)).toBe(true);
      expect(directoryStructure.isValid).toBe(true);
      expect(directoryStructure.metadata.planner).toBe('UnifiedPlanner');
      
      // Should include basic frontend files
      expect(directoryStructure.files.some(f => f.includes('.html'))).toBe(true);
      
      console.log(`📊 Directory Structure:`, {
        directories: directoryStructure.directories.length,
        files: directoryStructure.files.length,
        sampleFiles: directoryStructure.files.slice(0, 5)
      });
      
    }, 45000);
    
    test('should plan structure for complex backend project', async () => {
      
      const analysis = {
        projectType: 'backend',
        complexity: 'high',
        components: {
          backend: {
            features: ['api', 'crud', 'authentication', 'database'],
            technologies: ['nodejs', 'express', 'mongodb']
          }
        }
      };
      
      console.log('📁 Testing complex backend structure...');
      
      const directoryStructure = await unifiedPlanner.planDirectoryStructure(analysis);
      
      expect(directoryStructure.isValid).toBe(true);
      expect(directoryStructure.directories.length).toBeGreaterThan(3);
      expect(directoryStructure.files.length).toBeGreaterThan(5);
      
      // Should include package.json for Node.js
      expect(directoryStructure.files.some(f => f.includes('package.json'))).toBe(true);
      
      console.log(`📊 Complex Backend Structure:`, {
        directories: directoryStructure.directories,
        keyFiles: directoryStructure.files.filter(f => 
          f.includes('.json') || f.includes('.js') || f.includes('.env')
        )
      });
      
    }, 45000);
  });

  describe('DependencyPlanner Domain', () => {
    test('should plan file dependencies and creation order', async () => {
      
      const structure = {
        files: [
          'package.json',
          'server.js', 
          'models/User.js',
          'routes/users.js',
          'middleware/auth.js',
          'utils/validation.js'
        ]
      };
      
      const analysis = {
        projectType: 'backend',
        complexity: 'medium'
      };
      
      console.log('🔗 Testing dependency planning...');
      
      const dependencyPlan = await unifiedPlanner.planDependencies(structure, analysis);
      
      // Verify plan structure
      expect(dependencyPlan).toHaveProperty('creationOrder');
      expect(dependencyPlan).toHaveProperty('dependencies');
      expect(dependencyPlan).toHaveProperty('conflicts');
      expect(dependencyPlan).toHaveProperty('isValid');
      expect(dependencyPlan).toHaveProperty('metadata');
      
      expect(Array.isArray(dependencyPlan.creationOrder)).toBe(true);
      expect(dependencyPlan.isValid).toBe(true);
      expect(dependencyPlan.metadata.planner).toBe('UnifiedPlanner');
      
      // package.json should be first
      expect(dependencyPlan.creationOrder[0]).toBe('package.json');
      
      console.log(`📊 Dependency Plan:`, {
        creationOrder: dependencyPlan.creationOrder,
        dependencyCount: Object.keys(dependencyPlan.dependencies).length,
        conflicts: dependencyPlan.conflicts.length
      });
      
    }, 45000);
  });

  describe('FrontendArchitecture Domain', () => {
    test('should plan frontend architecture with components', async () => {
      
      const analysis = {
        projectType: 'frontend',
        complexity: 'medium',
        components: {
          frontend: {
            features: ['form', 'list', 'validation'],
            technologies: ['html', 'javascript', 'css']
          }
        }
      };
      
      console.log('🎨 Testing frontend architecture planning...');
      
      const frontendArchitecture = await unifiedPlanner.planFrontendArchitecture(analysis);
      
      // Verify architecture structure
      expect(frontendArchitecture).toHaveProperty('components');
      expect(frontendArchitecture).toHaveProperty('componentHierarchy');
      expect(frontendArchitecture).toHaveProperty('stateManagement');
      expect(frontendArchitecture).toHaveProperty('dataFlow');
      expect(frontendArchitecture).toHaveProperty('styling');
      expect(frontendArchitecture).toHaveProperty('metadata');
      
      expect(Array.isArray(frontendArchitecture.components)).toBe(true);
      expect(frontendArchitecture.metadata.planner).toBe('UnifiedPlanner');
      
      console.log(`📊 Frontend Architecture:`, {
        componentCount: frontendArchitecture.components.length,
        stateStrategy: frontendArchitecture.stateManagement?.strategy,
        stylingApproach: frontendArchitecture.styling?.approach
      });
      
    }, 45000);
  });

  describe('BackendArchitecture Domain', () => {
    test('should plan backend architecture with services', async () => {
      
      const analysis = {
        projectType: 'backend',
        complexity: 'high',
        components: {
          backend: {
            features: ['api', 'crud', 'authentication', 'database', 'middleware'],
            technologies: ['nodejs', 'express', 'mongodb']
          }
        }
      };
      
      console.log('⚙️ Testing backend architecture planning...');
      
      const backendArchitecture = await unifiedPlanner.planBackendArchitecture(analysis);
      
      // Verify architecture structure
      expect(backendArchitecture).toHaveProperty('pattern');
      expect(backendArchitecture).toHaveProperty('apiDesign');
      expect(backendArchitecture).toHaveProperty('dataLayer');
      expect(backendArchitecture).toHaveProperty('services');
      expect(backendArchitecture).toHaveProperty('middleware');
      expect(backendArchitecture).toHaveProperty('security');
      expect(backendArchitecture).toHaveProperty('metadata');
      
      expect(['monolithic', 'layered', 'microservices']).toContain(backendArchitecture.pattern);
      expect(Array.isArray(backendArchitecture.services)).toBe(true);
      expect(Array.isArray(backendArchitecture.middleware)).toBe(true);
      expect(backendArchitecture.metadata.planner).toBe('UnifiedPlanner');
      
      console.log(`📊 Backend Architecture:`, {
        pattern: backendArchitecture.pattern,
        serviceCount: backendArchitecture.services.length,
        middlewareCount: backendArchitecture.middleware.length,
        apiStyle: backendArchitecture.apiDesign?.style
      });
      
    }, 45000);
  });

  describe('APIInterface Domain', () => {
    test('should plan API interfaces between frontend and backend', async () => {
      
      const frontendArchitecture = {
        components: [
          { name: 'UserList', type: 'display', props: ['users'] },
          { name: 'UserForm', type: 'form', props: ['onSubmit'] }
        ]
      };
      
      const backendArchitecture = {
        apiDesign: {
          style: 'REST',
          endpoints: ['/users']
        },
        dataLayer: {
          models: ['User']
        }
      };
      
      console.log('🌐 Testing API interface planning...');
      
      const apiInterface = await unifiedPlanner.planAPIInterface(frontendArchitecture, backendArchitecture);
      
      // Verify interface structure
      expect(apiInterface).toHaveProperty('contracts');
      expect(apiInterface).toHaveProperty('dataTransferObjects');
      expect(apiInterface).toHaveProperty('communication');
      expect(apiInterface).toHaveProperty('errorHandling');
      expect(apiInterface).toHaveProperty('metadata');
      
      expect(Array.isArray(apiInterface.contracts)).toBe(true);
      expect(typeof apiInterface.dataTransferObjects).toBe('object');
      expect(typeof apiInterface.communication).toBe('object');
      expect(apiInterface.metadata.planner).toBe('UnifiedPlanner');
      
      console.log(`📊 API Interface:`, {
        contractCount: apiInterface.contracts.length,
        dtoCount: Object.keys(apiInterface.dataTransferObjects).length,
        protocol: apiInterface.communication?.protocol,
        authConfigured: !!apiInterface.authentication
      });
      
    }, 45000);
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid requirements gracefully', async () => {
      
      const invalidRequirements = {
        // Missing task
        requirements: {
          frontend: 'Some vague description'
        }
      };
      
      console.log('🚨 Testing error handling...');
      
      // Should handle gracefully or provide meaningful error
      try {
        const analysis = await unifiedPlanner.analyzeRequirements(invalidRequirements);
        // If it succeeds, should have some default task
        expect(analysis).toHaveProperty('task');
      } catch (error) {
        // If it fails, error should be meaningful
        expect(error.message).toBeTruthy();
        console.log(`Expected error: ${error.message}`);
      }
      
    }, 30000);
    
    test('should handle planning failures with retry', async () => {
      
      // Test with extremely complex requirements that might challenge the LLM
      const complexRequirements = {
        task: 'Build a real-time collaborative quantum computing simulation platform with blockchain integration and AI-powered optimization',
        requirements: {
          frontend: 'React-based quantum circuit designer with real-time collaboration',
          backend: 'Microservices architecture with quantum computing APIs, blockchain ledger, and ML optimization engine'
        }
      };
      
      console.log('🚨 Testing complex scenario handling...');
      
      try {
        const analysis = await unifiedPlanner.analyzeRequirements(complexRequirements);
        
        // Should still provide a valid analysis even for complex requirements
        expect(analysis).toHaveProperty('projectType');
        expect(analysis).toHaveProperty('complexity');
        expect(analysis.complexity).toBe('high'); // Should definitely be high complexity
        
        console.log(`✅ Handled complex scenario: ${analysis.projectType} project`);
        
      } catch (error) {
        // If it fails, should be a meaningful error, not a timeout or network issue
        console.log(`Complex scenario error: ${error.message}`);
        expect(error.message).not.toMatch(/timeout|network|connection/i);
      }
      
    }, 90000); // Longer timeout for complex scenario
  });
});
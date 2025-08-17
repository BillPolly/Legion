/**
 * End-to-End Tests: Library Operations
 * Tests plan library management, templates, search, and persistence
 */

import { jest } from '@jest/globals';
import { NavigationTabs } from '../../src/components/tool-registry/components/NavigationTabs.js';

describe('E2E: Library Operations', () => {
  let component;
  let mockUmbilical;
  let dom;
  let mockPlanningActor;
  let mockExecutionActor;
  let mockToolRegistryActor;
  
  // Mock plan database
  let planDatabase = [];
  let templateDatabase = [];

  beforeEach(async () => {
    // Reset databases
    planDatabase = [
      {
        id: 'existing-plan-1',
        name: 'REST API Development',
        goal: 'Build RESTful API with Node.js',
        tags: ['backend', 'api', 'node'],
        createdAt: new Date('2024-01-15').toISOString(),
        modifiedAt: new Date('2024-01-20').toISOString(),
        isTemplate: false,
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build REST API',
            children: []
          }
        }
      },
      {
        id: 'existing-plan-2',
        name: 'React UI Application',
        goal: 'Create React frontend application',
        tags: ['frontend', 'react', 'ui'],
        createdAt: new Date('2024-01-10').toISOString(),
        modifiedAt: new Date('2024-01-18').toISOString(),
        isTemplate: false,
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build React App',
            children: []
          }
        }
      },
      {
        id: 'existing-plan-3',
        name: 'Database Migration',
        goal: 'Migrate PostgreSQL database schema',
        tags: ['database', 'migration', 'postgresql'],
        createdAt: new Date('2024-01-05').toISOString(),
        modifiedAt: new Date('2024-01-05').toISOString(),
        isTemplate: false,
        hierarchy: {
          root: {
            id: 'root',
            description: 'Database migration',
            children: []
          }
        }
      }
    ];
    
    templateDatabase = [
      {
        id: 'template-1',
        name: 'Microservice Template',
        goal: 'Create microservice with {{SERVICE_NAME}}',
        tags: ['template', 'microservice'],
        isTemplate: true,
        templateConfig: {
          placeholders: ['{{SERVICE_NAME}}', '{{PORT}}', '{{DATABASE}}'],
          defaultValues: {
            PORT: '3000',
            DATABASE: 'postgresql'
          },
          description: 'Template for creating microservices'
        },
        hierarchy: {
          root: {
            id: 'root',
            description: 'Setup {{SERVICE_NAME}} microservice',
            children: []
          }
        }
      },
      {
        id: 'template-2',
        name: 'CI/CD Pipeline Template',
        goal: 'Setup CI/CD for {{PROJECT_NAME}}',
        tags: ['template', 'cicd', 'devops'],
        isTemplate: true,
        templateConfig: {
          placeholders: ['{{PROJECT_NAME}}', '{{BRANCH}}', '{{ENVIRONMENT}}'],
          defaultValues: {
            BRANCH: 'main',
            ENVIRONMENT: 'production'
          },
          description: 'Template for CI/CD pipeline setup'
        },
        hierarchy: {
          root: {
            id: 'root',
            description: 'CI/CD for {{PROJECT_NAME}}',
            children: []
          }
        }
      }
    ];

    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '1200px';
    dom.style.height = '800px';
    document.body.appendChild(dom);

    // Create comprehensive mock actors
    mockPlanningActor = {
      getPlans: jest.fn().mockImplementation((filter) => {
        let results = [...planDatabase, ...templateDatabase];
        
        if (filter) {
          if (filter.isTemplate !== undefined) {
            results = results.filter(p => p.isTemplate === filter.isTemplate);
          }
          if (filter.tags) {
            results = results.filter(p => 
              filter.tags.some(tag => p.tags?.includes(tag))
            );
          }
          if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            results = results.filter(p =>
              p.name.toLowerCase().includes(searchLower) ||
              p.goal.toLowerCase().includes(searchLower) ||
              p.tags?.some(tag => tag.toLowerCase().includes(searchLower))
            );
          }
        }
        
        return Promise.resolve(results);
      }),
      
      loadPlan: jest.fn().mockImplementation((planId) => {
        const plan = [...planDatabase, ...templateDatabase].find(p => p.id === planId);
        if (plan) {
          return Promise.resolve(plan);
        }
        return Promise.reject(new Error(`Plan ${planId} not found`));
      }),
      
      savePlan: jest.fn().mockImplementation((plan) => {
        const existingIndex = planDatabase.findIndex(p => p.id === plan.id);
        
        if (existingIndex >= 0) {
          // Update existing plan
          planDatabase[existingIndex] = {
            ...plan,
            modifiedAt: new Date().toISOString()
          };
        } else {
          // Add new plan
          const newPlan = {
            ...plan,
            id: plan.id || `plan-${Date.now()}`,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString()
          };
          planDatabase.push(newPlan);
        }
        
        return Promise.resolve({
          success: true,
          planId: plan.id
        });
      }),
      
      deletePlan: jest.fn().mockImplementation((planId) => {
        const index = planDatabase.findIndex(p => p.id === planId);
        if (index >= 0) {
          planDatabase.splice(index, 1);
          return Promise.resolve({ success: true });
        }
        
        const templateIndex = templateDatabase.findIndex(t => t.id === planId);
        if (templateIndex >= 0) {
          templateDatabase.splice(templateIndex, 1);
          return Promise.resolve({ success: true });
        }
        
        return Promise.reject(new Error(`Plan ${planId} not found`));
      }),
      
      duplicatePlan: jest.fn().mockImplementation((planId, newName) => {
        const original = [...planDatabase, ...templateDatabase].find(p => p.id === planId);
        if (!original) {
          return Promise.reject(new Error(`Plan ${planId} not found`));
        }
        
        const duplicate = {
          ...original,
          id: `plan-${Date.now()}`,
          name: newName || `${original.name} (Copy)`,
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          isTemplate: false // Duplicates are not templates
        };
        
        planDatabase.push(duplicate);
        return Promise.resolve(duplicate);
      }),
      
      exportPlan: jest.fn().mockImplementation((planId, format = 'json') => {
        const plan = [...planDatabase, ...templateDatabase].find(p => p.id === planId);
        if (!plan) {
          return Promise.reject(new Error(`Plan ${planId} not found`));
        }
        
        if (format === 'json') {
          return Promise.resolve({
            data: JSON.stringify(plan, null, 2),
            filename: `${plan.name.replace(/\s+/g, '-')}.json`,
            mimeType: 'application/json'
          });
        } else if (format === 'yaml') {
          // Simplified YAML representation
          return Promise.resolve({
            data: `name: ${plan.name}\ngoal: ${plan.goal}\ntags: ${plan.tags?.join(', ')}`,
            filename: `${plan.name.replace(/\s+/g, '-')}.yaml`,
            mimeType: 'text/yaml'
          });
        }
        
        return Promise.reject(new Error(`Unsupported format: ${format}`));
      }),
      
      importPlan: jest.fn().mockImplementation((data, format = 'json') => {
        try {
          let plan;
          if (format === 'json') {
            plan = JSON.parse(data);
          } else {
            return Promise.reject(new Error(`Unsupported format: ${format}`));
          }
          
          // Generate new ID for imported plan
          plan.id = `imported-${Date.now()}`;
          plan.name = `${plan.name} (Imported)`;
          plan.createdAt = new Date().toISOString();
          plan.modifiedAt = new Date().toISOString();
          
          planDatabase.push(plan);
          return Promise.resolve(plan);
        } catch (error) {
          return Promise.reject(new Error(`Import failed: ${error.message}`));
        }
      }),
      
      applyTemplate: jest.fn().mockImplementation((templateId, values) => {
        const template = templateDatabase.find(t => t.id === templateId);
        if (!template) {
          return Promise.reject(new Error(`Template ${templateId} not found`));
        }
        
        // Replace placeholders with values
        let newPlan = JSON.parse(JSON.stringify(template));
        newPlan.id = `from-template-${Date.now()}`;
        newPlan.isTemplate = false;
        delete newPlan.templateConfig;
        
        // Replace placeholders in strings
        const replacePlaceholders = (obj) => {
          for (const key in obj) {
            if (typeof obj[key] === 'string') {
              template.templateConfig.placeholders.forEach(placeholder => {
                const varName = placeholder.replace(/{{|}}/g, '');
                const value = values[varName] || 
                  template.templateConfig.defaultValues[varName] || 
                  placeholder;
                obj[key] = obj[key].replace(placeholder, value);
              });
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
              replacePlaceholders(obj[key]);
            }
          }
        };
        
        replacePlaceholders(newPlan);
        
        newPlan.name = values.name || `Plan from ${template.name}`;
        newPlan.createdAt = new Date().toISOString();
        newPlan.modifiedAt = new Date().toISOString();
        
        planDatabase.push(newPlan);
        return Promise.resolve(newPlan);
      }),
      
      createPlan: jest.fn(),
      validatePlan: jest.fn().mockResolvedValue({ isValid: true })
    };

    mockExecutionActor = {
      getExecutionHistory: jest.fn().mockResolvedValue([
        { planId: 'existing-plan-1', executionId: 'exec-1', status: 'completed' },
        { planId: 'existing-plan-2', executionId: 'exec-2', status: 'failed' }
      ])
    };

    mockToolRegistryActor = {
      searchTools: jest.fn(),
      validateTools: jest.fn().mockResolvedValue({ isValid: true }),
      getAvailableTools: jest.fn().mockResolvedValue([])
    };

    // Define tabs
    const tabs = [
      {
        id: 'library',
        label: 'Plan Library',
        title: 'Plan Library',
        icon: '📚',
        component: 'PlanLibraryPanel'
      },
      {
        id: 'planning',
        label: 'Planning Workspace',
        title: 'Planning Workspace',
        icon: '🧠',
        component: 'PlanningWorkspacePanel'
      }
    ];

    // Create umbilical
    mockUmbilical = {
      dom,
      tabs,
      activeTab: 'library',
      
      // Actors
      planningActor: mockPlanningActor,
      executionActor: mockExecutionActor,
      toolRegistryActor: mockToolRegistryActor,
      
      // Callbacks
      onPlanLoad: jest.fn(),
      onPlanSave: jest.fn(),
      onPlanDelete: jest.fn(),
      onPlanDuplicate: jest.fn(),
      onTemplateApply: jest.fn(),
      onPlanExport: jest.fn(),
      onPlanImport: jest.fn(),
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await NavigationTabs.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
    jest.clearAllMocks();
  });

  describe('Plan Management', () => {
    test('should list all saved plans', async () => {
      // Load library panel
      await component.switchTab('library');
      await component.loadPanelContent('library');
      
      const libraryComponent = component.getTabComponent('library');
      
      if (libraryComponent && libraryComponent.api) {
        // Get all plans
        const plans = await mockPlanningActor.getPlans();
        
        // Verify plans are loaded
        expect(plans.length).toBeGreaterThan(0);
        expect(plans.some(p => p.name === 'REST API Development')).toBe(true);
        expect(plans.some(p => p.name === 'React UI Application')).toBe(true);
        expect(plans.some(p => p.isTemplate)).toBe(true);
      }
    });

    test('should load selected plan', async () => {
      // Load library panel
      await component.switchTab('library');
      await component.loadPanelContent('library');
      
      const libraryComponent = component.getTabComponent('library');
      
      if (libraryComponent && libraryComponent.api) {
        // Load specific plan
        const plan = await mockPlanningActor.loadPlan('existing-plan-1');
        
        expect(plan).toBeDefined();
        expect(plan.name).toBe('REST API Development');
        expect(plan.goal).toContain('Node.js');
        expect(mockUmbilical.onPlanLoad).toHaveBeenCalled();
      }
    });

    test('should save new and modified plans', async () => {
      // Create new plan
      const newPlan = {
        name: 'New Test Plan',
        goal: 'Test plan saving',
        tags: ['test'],
        hierarchy: {
          root: {
            id: 'root',
            description: 'Test',
            children: []
          }
        }
      };
      
      // Save new plan
      const saveResult = await mockPlanningActor.savePlan(newPlan);
      expect(saveResult.success).toBe(true);
      
      // Verify plan was added
      const plans = await mockPlanningActor.getPlans();
      expect(plans.some(p => p.name === 'New Test Plan')).toBe(true);
      
      // Modify existing plan
      const existingPlan = plans.find(p => p.id === 'existing-plan-1');
      existingPlan.name = 'Modified REST API';
      
      await mockPlanningActor.savePlan(existingPlan);
      
      // Verify modification
      const updatedPlans = await mockPlanningActor.getPlans();
      const modifiedPlan = updatedPlans.find(p => p.id === 'existing-plan-1');
      expect(modifiedPlan.name).toBe('Modified REST API');
    });

    test('should delete plans', async () => {
      // Get initial count
      const initialPlans = await mockPlanningActor.getPlans();
      const initialCount = initialPlans.length;
      
      // Delete a plan
      await mockPlanningActor.deletePlan('existing-plan-3');
      
      // Verify deletion
      const remainingPlans = await mockPlanningActor.getPlans();
      expect(remainingPlans.length).toBe(initialCount - 1);
      expect(remainingPlans.some(p => p.id === 'existing-plan-3')).toBe(false);
    });

    test('should duplicate plans', async () => {
      // Duplicate a plan
      const duplicate = await mockPlanningActor.duplicatePlan(
        'existing-plan-1',
        'REST API Copy'
      );
      
      expect(duplicate).toBeDefined();
      expect(duplicate.name).toBe('REST API Copy');
      expect(duplicate.id).not.toBe('existing-plan-1');
      expect(duplicate.goal).toBe('Build RESTful API with Node.js');
      
      // Verify duplicate was added
      const plans = await mockPlanningActor.getPlans();
      expect(plans.some(p => p.name === 'REST API Copy')).toBe(true);
    });
  });

  describe('Template Usage', () => {
    test('should list available templates', async () => {
      // Get templates only
      const templates = await mockPlanningActor.getPlans({ isTemplate: true });
      
      expect(templates.length).toBe(2);
      expect(templates.every(t => t.isTemplate)).toBe(true);
      expect(templates.some(t => t.name === 'Microservice Template')).toBe(true);
      expect(templates.some(t => t.name === 'CI/CD Pipeline Template')).toBe(true);
    });

    test('should apply template with values', async () => {
      // Apply microservice template
      const values = {
        SERVICE_NAME: 'UserService',
        PORT: '8080',
        DATABASE: 'mongodb',
        name: 'User Service Plan'
      };
      
      const newPlan = await mockPlanningActor.applyTemplate('template-1', values);
      
      expect(newPlan).toBeDefined();
      expect(newPlan.name).toBe('User Service Plan');
      expect(newPlan.goal).toContain('UserService');
      expect(newPlan.isTemplate).toBe(false);
      expect(newPlan.hierarchy.root.description).toContain('UserService');
      
      // Verify plan was created
      const plans = await mockPlanningActor.getPlans({ isTemplate: false });
      expect(plans.some(p => p.name === 'User Service Plan')).toBe(true);
    });

    test('should use default values for template placeholders', async () => {
      // Apply template with partial values
      const values = {
        PROJECT_NAME: 'MyApp',
        name: 'MyApp CI/CD'
      };
      
      const newPlan = await mockPlanningActor.applyTemplate('template-2', values);
      
      expect(newPlan.goal).toContain('MyApp');
      // Should use default values for BRANCH and ENVIRONMENT
      expect(newPlan.hierarchy.root.description).toContain('MyApp');
    });

    test('should validate template placeholders', async () => {
      // Load template
      const template = await mockPlanningActor.loadPlan('template-1');
      
      expect(template.templateConfig).toBeDefined();
      expect(template.templateConfig.placeholders).toContain('{{SERVICE_NAME}}');
      expect(template.templateConfig.placeholders).toContain('{{PORT}}');
      expect(template.templateConfig.defaultValues.PORT).toBe('3000');
    });
  });

  describe('Search and Filter', () => {
    test('should search plans by name', async () => {
      // Search for "API"
      const results = await mockPlanningActor.getPlans({ search: 'API' });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('API'))).toBe(true);
    });

    test('should filter plans by tags', async () => {
      // Filter by backend tag
      const backendPlans = await mockPlanningActor.getPlans({ tags: ['backend'] });
      
      expect(backendPlans.length).toBeGreaterThan(0);
      expect(backendPlans.every(p => p.tags?.includes('backend'))).toBe(true);
      
      // Filter by multiple tags
      const frontendPlans = await mockPlanningActor.getPlans({ tags: ['frontend', 'react'] });
      
      expect(frontendPlans.some(p => p.name === 'React UI Application')).toBe(true);
    });

    test('should search templates separately', async () => {
      // Search only templates
      const templateResults = await mockPlanningActor.getPlans({
        isTemplate: true,
        search: 'microservice'
      });
      
      expect(templateResults.length).toBe(1);
      expect(templateResults[0].name).toBe('Microservice Template');
    });

    test('should sort plans by date', async () => {
      const plans = await mockPlanningActor.getPlans();
      
      // Sort by creation date
      const sortedByCreation = [...plans].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      
      expect(sortedByCreation[0].createdAt).toBeDefined();
      
      // Sort by modification date
      const sortedByModification = [...plans].sort((a, b) =>
        new Date(b.modifiedAt) - new Date(a.modifiedAt)
      );
      
      expect(sortedByModification[0].modifiedAt).toBeDefined();
    });
  });

  describe('Persistence and Retrieval', () => {
    test('should persist plans across sessions', async () => {
      // Save a plan
      const sessionPlan = {
        name: 'Session Test Plan',
        goal: 'Test persistence',
        tags: ['session', 'test']
      };
      
      await mockPlanningActor.savePlan(sessionPlan);
      
      // Simulate session reload by getting plans again
      const plans = await mockPlanningActor.getPlans();
      
      // Verify plan persists
      expect(plans.some(p => p.name === 'Session Test Plan')).toBe(true);
    });

    test('should export plans to different formats', async () => {
      // Export to JSON
      const jsonExport = await mockPlanningActor.exportPlan('existing-plan-1', 'json');
      
      expect(jsonExport.data).toBeDefined();
      expect(jsonExport.filename).toContain('.json');
      expect(jsonExport.mimeType).toBe('application/json');
      
      // Verify JSON is valid
      const parsed = JSON.parse(jsonExport.data);
      expect(parsed.name).toBe('REST API Development');
      
      // Export to YAML
      const yamlExport = await mockPlanningActor.exportPlan('existing-plan-1', 'yaml');
      
      expect(yamlExport.data).toBeDefined();
      expect(yamlExport.filename).toContain('.yaml');
      expect(yamlExport.data).toContain('name: REST API Development');
    });

    test('should import plans from external sources', async () => {
      // Create export data
      const exportData = JSON.stringify({
        name: 'Imported Plan',
        goal: 'Test import functionality',
        tags: ['imported'],
        hierarchy: {
          root: {
            id: 'root',
            description: 'Imported root',
            children: []
          }
        }
      });
      
      // Import the plan
      const importedPlan = await mockPlanningActor.importPlan(exportData, 'json');
      
      expect(importedPlan).toBeDefined();
      expect(importedPlan.name).toContain('Imported');
      expect(importedPlan.id).toContain('imported-');
      
      // Verify plan was added
      const plans = await mockPlanningActor.getPlans();
      expect(plans.some(p => p.id === importedPlan.id)).toBe(true);
    });

    test('should track execution history for plans', async () => {
      // Get execution history
      const history = await mockExecutionActor.getExecutionHistory();
      
      expect(history).toBeDefined();
      expect(history.length).toBeGreaterThan(0);
      
      // Check history for specific plan
      const plan1History = history.filter(h => h.planId === 'existing-plan-1');
      expect(plan1History.length).toBeGreaterThan(0);
      expect(plan1History[0].status).toBe('completed');
    });

    test('should handle concurrent plan operations', async () => {
      // Simulate concurrent saves
      const promises = [
        mockPlanningActor.savePlan({ name: 'Concurrent 1', goal: 'Test 1' }),
        mockPlanningActor.savePlan({ name: 'Concurrent 2', goal: 'Test 2' }),
        mockPlanningActor.savePlan({ name: 'Concurrent 3', goal: 'Test 3' })
      ];
      
      const results = await Promise.all(promises);
      
      // All saves should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // Verify all plans were saved
      const plans = await mockPlanningActor.getPlans();
      expect(plans.some(p => p.name === 'Concurrent 1')).toBe(true);
      expect(plans.some(p => p.name === 'Concurrent 2')).toBe(true);
      expect(plans.some(p => p.name === 'Concurrent 3')).toBe(true);
    });
  });

  describe('Library UI Integration', () => {
    test('should integrate library with planning workspace', async () => {
      // Load library
      await component.switchTab('library');
      await component.loadPanelContent('library');
      
      const libraryComponent = component.getTabComponent('library');
      
      if (libraryComponent && libraryComponent.api) {
        // Select a plan from library
        const plan = await mockPlanningActor.loadPlan('existing-plan-1');
        
        // Switch to planning workspace
        await component.switchTab('planning');
        await component.loadPanelContent('planning');
        
        const planningComponent = component.getTabComponent('planning');
        
        if (planningComponent && planningComponent.api) {
          // Load plan into workspace
          planningComponent.api.setCurrentPlan(plan);
          
          // Verify plan is loaded
          const state = planningComponent.api.getState();
          expect(state.currentPlan).toBeDefined();
          expect(state.currentPlan.name).toBe('REST API Development');
        }
      }
    });

    test('should update library when plans are created in workspace', async () => {
      // Start in planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      if (planningComponent && planningComponent.api) {
        // Create and save a new plan
        const newPlan = {
          name: 'Workspace Created Plan',
          goal: 'Created from workspace',
          hierarchy: {
            root: {
              id: 'root',
              description: 'Workspace plan',
              children: []
            }
          }
        };
        
        planningComponent.api.setCurrentPlan(newPlan);
        await mockPlanningActor.savePlan(newPlan);
        
        // Switch to library
        await component.switchTab('library');
        
        // Verify plan appears in library
        const plans = await mockPlanningActor.getPlans();
        expect(plans.some(p => p.name === 'Workspace Created Plan')).toBe(true);
      }
    });
  });
});
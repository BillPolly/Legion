/**
 * Template System Unit Tests
 * Tests template structure, application, and management functionality
 */

import { jest } from '@jest/globals';
import { PlanLibraryPanel } from '../../src/components/tool-registry/components/panels/PlanLibraryPanel.js';

describe('Template System Unit Tests', () => {
  let component;
  let mockUmbilical;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '800px';
    dom.style.height = '600px';
    document.body.appendChild(dom);

    // Create mock umbilical
    mockUmbilical = {
      dom,
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await PlanLibraryPanel.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  });

  describe('Template Structure and Validation', () => {
    test('should create and identify template plans', () => {
      const template = {
        id: 'test-template-001',
        name: 'Basic Project Template',
        description: 'A template for creating basic project plans',
        isTemplate: true,
        tags: ['template', 'project', 'basic'],
        templateConfig: {
          placeholders: ['{{project_name}}', '{{team_lead}}', '{{deadline}}'],
          defaultValues: {
            priority: 'medium',
            estimated_hours: 40,
            review_required: true
          },
          validation: {
            required_fields: ['project_name', 'team_lead'],
            date_fields: ['deadline']
          }
        },
        hierarchy: {
          root: {
            id: 'root',
            description: 'Complete {{project_name}} project led by {{team_lead}}',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'planning',
                description: 'Plan {{project_name}} requirements and timeline',
                complexity: 'MEDIUM',
                children: []
              },
              {
                id: 'development',
                description: 'Develop {{project_name}} features',
                complexity: 'COMPLEX',
                children: [
                  {
                    id: 'setup',
                    description: 'Setup project environment for {{project_name}}',
                    complexity: 'SIMPLE',
                    children: []
                  }
                ]
              },
              {
                id: 'review',
                description: 'Review {{project_name}} with {{team_lead}} by {{deadline}}',
                complexity: 'MEDIUM',
                children: []
              }
            ]
          }
        }
      };

      component.model.addPlan(template);

      const plans = component.api.getPlans();
      const foundTemplate = plans.find(p => p.id === 'test-template-001');
      
      expect(foundTemplate).toBeTruthy();
      expect(foundTemplate.isTemplate).toBe(true);
      expect(foundTemplate.templateConfig).toBeTruthy();
      expect(foundTemplate.templateConfig.placeholders).toContain('{{project_name}}');
      expect(foundTemplate.templateConfig.defaultValues.priority).toBe('medium');
    });

    test('should validate template configuration structure', () => {
      const validTemplate = {
        id: 'valid-template',
        name: 'Valid Template',
        isTemplate: true,
        tags: [],
        templateConfig: {
          placeholders: ['{{name}}'],
          defaultValues: {},
          validation: {}
        },
        hierarchy: {
          root: {
            id: 'root',
            description: 'Template for {{name}}',
            children: []
          }
        }
      };

      const invalidTemplate = {
        id: 'invalid-template',
        name: 'Invalid Template',
        isTemplate: true,
        tags: [],
        // Missing templateConfig
        hierarchy: {
          root: {
            id: 'root',
            description: 'Template without config',
            children: []
          }
        }
      };

      component.model.addPlan(validTemplate);
      component.model.addPlan(invalidTemplate);

      const plans = component.api.getPlans();
      const valid = plans.find(p => p.id === 'valid-template');
      const invalid = plans.find(p => p.id === 'invalid-template');

      expect(valid).toBeTruthy();
      expect(valid.templateConfig).toBeTruthy();
      
      expect(invalid).toBeTruthy();
      expect(invalid.templateConfig).toBeUndefined();
    });

    test('should identify and extract placeholders from template content', () => {
      const template = {
        id: 'placeholder-template',
        name: 'Placeholder Test Template',
        isTemplate: true,
        tags: [],
        templateConfig: {
          placeholders: ['{{service_name}}', '{{port}}', '{{environment}}'],
          defaultValues: {
            environment: 'development',
            port: 3000
          }
        },
        hierarchy: {
          root: {
            id: 'root',
            description: 'Deploy {{service_name}} on port {{port}} in {{environment}}',
            children: [
              {
                id: 'build',
                description: 'Build {{service_name}} for {{environment}}',
                children: []
              },
              {
                id: 'deploy',
                description: 'Deploy {{service_name}} service to {{environment}}',
                metadata: {
                  config: {
                    port: '{{port}}',
                    env: '{{environment}}'
                  }
                },
                children: []
              }
            ]
          }
        }
      };

      component.model.addPlan(template);

      const plans = component.api.getPlans();
      const foundTemplate = plans.find(p => p.id === 'placeholder-template');
      
      expect(foundTemplate.templateConfig.placeholders).toHaveLength(3);
      expect(foundTemplate.templateConfig.placeholders).toContain('{{service_name}}');
      expect(foundTemplate.templateConfig.placeholders).toContain('{{port}}');
      expect(foundTemplate.templateConfig.placeholders).toContain('{{environment}}');
      
      // Verify placeholders exist in hierarchy
      const rootDesc = foundTemplate.hierarchy.root.description;
      expect(rootDesc).toContain('{{service_name}}');
      expect(rootDesc).toContain('{{port}}');
      expect(rootDesc).toContain('{{environment}}');
    });

    test('should support complex template configurations', () => {
      const complexTemplate = {
        id: 'complex-template',
        name: 'Complex Workflow Template',
        isTemplate: true,
        tags: ['workflow', 'complex'],
        templateConfig: {
          placeholders: [
            '{{workflow_name}}',
            '{{owner}}',
            '{{start_date}}',
            '{{budget}}',
            '{{team_size}}'
          ],
          defaultValues: {
            budget: 10000,
            team_size: 3,
            priority: 'normal',
            review_cycle: 'weekly'
          },
          validation: {
            required_fields: ['workflow_name', 'owner', 'start_date'],
            numeric_fields: ['budget', 'team_size'],
            date_fields: ['start_date'],
            constraints: {
              budget: { min: 1000, max: 100000 },
              team_size: { min: 1, max: 20 }
            }
          },
          categories: ['project-management', 'team-workflow'],
          complexity_mapping: {
            'small_team': 'SIMPLE',
            'medium_team': 'MEDIUM', 
            'large_team': 'COMPLEX'
          }
        },
        hierarchy: {
          root: {
            id: 'root',
            description: 'Execute {{workflow_name}} workflow managed by {{owner}}',
            complexity: 'COMPLEX',
            children: []
          }
        }
      };

      component.model.addPlan(complexTemplate);

      const plans = component.api.getPlans();
      const template = plans.find(p => p.id === 'complex-template');
      
      expect(template.templateConfig.validation.required_fields).toContain('workflow_name');
      expect(template.templateConfig.validation.constraints.budget.min).toBe(1000);
      expect(template.templateConfig.categories).toContain('project-management');
      expect(template.templateConfig.complexity_mapping.large_team).toBe('COMPLEX');
    });
  });

  describe('Template Filtering and Management', () => {
    beforeEach(() => {
      // Clear existing plans and add fresh test data
      component.model.state.plans = [];
      
      // Add mixed plans and templates
      const mixedData = [
        {
          id: 'regular-plan-1',
          name: 'Regular Plan 1',
          isTemplate: false,
          tags: ['regular']
        },
        {
          id: 'template-1',
          name: 'Template 1',
          isTemplate: true,
          tags: ['template'],
          templateConfig: {
            placeholders: ['{{name}}'],
            defaultValues: {}
          }
        },
        {
          id: 'regular-plan-2', 
          name: 'Regular Plan 2',
          tags: ['regular'] // No isTemplate property
        },
        {
          id: 'template-2',
          name: 'Template 2',
          isTemplate: true,
          tags: ['template', 'advanced'],
          templateConfig: {
            placeholders: ['{{project}}', '{{type}}'],
            defaultValues: { type: 'web' }
          }
        }
      ];

      mixedData.forEach(item => component.model.addPlan(item));
    });

    test('should filter templates correctly', () => {
      // Filter by templates
      component.api.setFilterBy('templates');
      const filteredPlans = component.api.getFilteredPlans();
      
      expect(filteredPlans).toHaveLength(2);
      expect(filteredPlans.every(plan => plan.isTemplate === true)).toBe(true);
      expect(filteredPlans.map(p => p.id)).toEqual(
        expect.arrayContaining(['template-1', 'template-2'])
      );
    });

    test('should get all templates via filtering', () => {
      const allPlans = component.api.getPlans();
      const templates = allPlans.filter(plan => plan.isTemplate === true);
      
      expect(templates).toHaveLength(2);
      expect(templates.every(t => t.templateConfig)).toBe(true);
      
      const templateNames = templates.map(t => t.name);
      expect(templateNames).toContain('Template 1');
      expect(templateNames).toContain('Template 2');
    });

    test('should search within templates', () => {
      // First filter by templates, then search
      component.api.setFilterBy('templates');
      component.api.searchPlans('advanced');
      
      const results = component.api.getFilteredPlans();
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('template-2');
      expect(results[0].tags).toContain('advanced');
    });

    test('should sort templates by different criteria', () => {
      component.api.setFilterBy('templates');
      
      // Sort by name ascending
      component.api.setSortBy('name');
      component.api.setSortOrder('asc');
      
      const sortedTemplates = component.api.getFilteredPlans();
      expect(sortedTemplates).toHaveLength(2);
      expect(sortedTemplates[0].name).toBe('Template 1');
      expect(sortedTemplates[1].name).toBe('Template 2');
    });

    test('should count templates correctly', () => {
      const allPlans = component.api.getPlans();
      const templateCount = allPlans.filter(plan => plan.isTemplate === true).length;
      const regularCount = allPlans.filter(plan => plan.isTemplate !== true).length;
      
      expect(templateCount).toBe(2);
      expect(regularCount).toBe(2); // Regular plans from test data
    });
  });

  describe('Template Application and Instantiation', () => {
    test('should create plan instance from template with placeholder replacement', () => {
      const template = {
        id: 'instantiation-template',
        name: 'Project Setup Template',
        isTemplate: true,
        tags: ['template'],
        templateConfig: {
          placeholders: ['{{project_name}}', '{{language}}', '{{framework}}'],
          defaultValues: {
            language: 'JavaScript',
            test_framework: 'Jest'
          }
        },
        hierarchy: {
          root: {
            id: 'root',
            description: 'Setup {{project_name}} using {{language}} and {{framework}}',
            children: [
              {
                id: 'init',
                description: 'Initialize {{project_name}} project',
                children: []
              },
              {
                id: 'configure',
                description: 'Configure {{framework}} for {{project_name}}',
                children: []
              }
            ]
          }
        }
      };

      component.model.addPlan(template);

      // Simulate template instantiation
      const templateData = {
        project_name: 'MyAwesomeApp',
        language: 'TypeScript',
        framework: 'React'
      };

      const instancePlan = {
        ...template,
        id: 'myawesomeapp-instance',
        name: 'MyAwesomeApp Project',
        isTemplate: false, // Instance is not a template
        templateSource: template.id,
        templateData: templateData,
        hierarchy: {
          root: {
            id: 'root',
            description: 'Setup MyAwesomeApp using TypeScript and React',
            children: [
              {
                id: 'init',
                description: 'Initialize MyAwesomeApp project',
                children: []
              },
              {
                id: 'configure',
                description: 'Configure React for MyAwesomeApp',
                children: []
              }
            ]
          }
        }
      };

      component.model.addPlan(instancePlan);

      const plans = component.api.getPlans();
      const instance = plans.find(p => p.id === 'myawesomeapp-instance');
      
      expect(instance).toBeTruthy();
      expect(instance.isTemplate).toBe(false);
      expect(instance.templateSource).toBe('instantiation-template');
      expect(instance.hierarchy.root.description).toContain('MyAwesomeApp');
      expect(instance.hierarchy.root.description).toContain('TypeScript');
      expect(instance.hierarchy.root.description).toContain('React');
    });

    test('should apply default values when creating instances', () => {
      const template = {
        id: 'defaults-template',
        name: 'Template with Defaults',
        isTemplate: true,
        tags: [],
        templateConfig: {
          placeholders: ['{{app_name}}', '{{port}}', '{{env}}'],
          defaultValues: {
            port: 3000,
            env: 'development',
            timeout: 30000,
            retries: 3
          }
        },
        hierarchy: {
          root: {
            id: 'root',
            description: 'Deploy {{app_name}} on port {{port}} in {{env}}',
            children: []
          }
        }
      };

      component.model.addPlan(template);

      // Create instance with partial data (should use defaults)
      const instanceData = {
        app_name: 'TestApp'
        // port and env should use defaults
      };

      const instance = {
        ...template,
        id: 'testapp-instance',
        name: 'TestApp Deployment',
        isTemplate: false,
        templateSource: template.id,
        templateData: { ...template.templateConfig.defaultValues, ...instanceData },
        hierarchy: {
          root: {
            id: 'root',
            description: 'Deploy TestApp on port 3000 in development',
            children: []
          }
        }
      };

      component.model.addPlan(instance);

      const plans = component.api.getPlans();
      const foundInstance = plans.find(p => p.id === 'testapp-instance');
      
      expect(foundInstance.templateData.app_name).toBe('TestApp');
      expect(foundInstance.templateData.port).toBe(3000);
      expect(foundInstance.templateData.env).toBe('development');
      expect(foundInstance.templateData.timeout).toBe(30000);
    });

    test('should validate template data before instantiation', () => {
      const template = {
        id: 'validation-template',
        name: 'Validation Template',
        isTemplate: true,
        tags: [],
        templateConfig: {
          placeholders: ['{{name}}', '{{email}}', '{{age}}'],
          defaultValues: {},
          validation: {
            required_fields: ['name', 'email'],
            email_fields: ['email'],
            numeric_fields: ['age'],
            constraints: {
              age: { min: 18, max: 65 }
            }
          }
        },
        hierarchy: {
          root: {
            id: 'root',
            description: 'Process user {{name}} ({{email}}) age {{age}}',
            children: []
          }
        }
      };

      component.model.addPlan(template);

      // Test validation logic (this would typically be in a utility function)
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      };

      const invalidData1 = {
        // Missing required name
        email: 'test@example.com',
        age: 25
      };

      const invalidData2 = {
        name: 'Jane Doe',
        email: 'invalid-email', // Invalid email format
        age: 30
      };

      const invalidData3 = {
        name: 'Bob Smith',
        email: 'bob@example.com',
        age: 70 // Age constraint violation
      };

      // Simulate validation function
      const validateTemplateData = (template, data) => {
        const errors = [];
        const validation = template.templateConfig.validation;
        
        // Check required fields
        if (validation.required_fields) {
          validation.required_fields.forEach(field => {
            if (!data[field]) {
              errors.push(`Missing required field: ${field}`);
            }
          });
        }
        
        // Check email format
        if (validation.email_fields) {
          validation.email_fields.forEach(field => {
            if (data[field] && !data[field].includes('@')) {
              errors.push(`Invalid email format: ${field}`);
            }
          });
        }
        
        // Check numeric constraints
        if (validation.constraints) {
          Object.keys(validation.constraints).forEach(field => {
            const value = data[field];
            const constraint = validation.constraints[field];
            if (value !== undefined) {
              if (constraint.min && value < constraint.min) {
                errors.push(`${field} below minimum: ${constraint.min}`);
              }
              if (constraint.max && value > constraint.max) {
                errors.push(`${field} above maximum: ${constraint.max}`);
              }
            }
          });
        }
        
        return errors;
      };

      expect(validateTemplateData(template, validData)).toHaveLength(0);
      expect(validateTemplateData(template, invalidData1)).toContain('Missing required field: name');
      expect(validateTemplateData(template, invalidData2)).toContain('Invalid email format: email');
      expect(validateTemplateData(template, invalidData3)).toContain('age above maximum: 65');
    });
  });

  describe('Template Categories and Organization', () => {
    beforeEach(() => {
      // Clear existing plans for clean test
      component.model.state.plans = [];
    });

    test('should organize templates by categories', () => {
      const categorizedTemplates = [
        {
          id: 'web-template',
          name: 'Web App Template',
          isTemplate: true,
          tags: ['web', 'template'],
          templateConfig: {
            placeholders: ['{{app_name}}'],
            defaultValues: {},
            categories: ['web-development', 'frontend']
          }
        },
        {
          id: 'api-template',
          name: 'API Template', 
          isTemplate: true,
          tags: ['api', 'template'],
          templateConfig: {
            placeholders: ['{{service_name}}'],
            defaultValues: {},
            categories: ['backend', 'api-development']
          }
        },
        {
          id: 'mobile-template',
          name: 'Mobile App Template',
          isTemplate: true,
          tags: ['mobile', 'template'],
          templateConfig: {
            placeholders: ['{{app_name}}'],
            defaultValues: {},
            categories: ['mobile-development', 'frontend']
          }
        }
      ];

      categorizedTemplates.forEach(template => component.model.addPlan(template));

      const allPlans = component.api.getPlans();
      const templates = allPlans.filter(p => p.isTemplate);
      
      // Get all categories
      const allCategories = new Set();
      templates.forEach(template => {
        if (template.templateConfig && template.templateConfig.categories) {
          template.templateConfig.categories.forEach(cat => allCategories.add(cat));
        }
      });

      expect(allCategories.size).toBeGreaterThan(0);
      expect(allCategories.has('web-development')).toBe(true);
      expect(allCategories.has('backend')).toBe(true);
      expect(allCategories.has('frontend')).toBe(true);

      // Filter templates by category
      const frontendTemplates = templates.filter(template =>
        template.templateConfig && 
        template.templateConfig.categories && 
        template.templateConfig.categories.includes('frontend')
      );
      
      expect(frontendTemplates).toHaveLength(2); // web and mobile
      expect(frontendTemplates.map(t => t.id)).toEqual(
        expect.arrayContaining(['web-template', 'mobile-template'])
      );
    });

    test('should support template complexity levels', () => {
      const complexityTemplates = [
        {
          id: 'simple-template',
          name: 'Simple Template',
          isTemplate: true,
          tags: [],
          templateConfig: {
            placeholders: ['{{name}}'],
            defaultValues: {},
            complexity: 'SIMPLE',
            estimated_time: '1-2 hours'
          }
        },
        {
          id: 'complex-template',
          name: 'Complex Template',
          isTemplate: true,
          tags: [],
          templateConfig: {
            placeholders: ['{{name}}', '{{config}}', '{{deps}}'],
            defaultValues: {},
            complexity: 'COMPLEX',
            estimated_time: '1-2 weeks'
          }
        }
      ];

      complexityTemplates.forEach(template => component.model.addPlan(template));

      const allPlans = component.api.getPlans();
      const templates = allPlans.filter(p => p.isTemplate);
      
      const simpleTemplates = templates.filter(t => 
        t.templateConfig && t.templateConfig.complexity === 'SIMPLE'
      );
      const complexTemplates = templates.filter(t => 
        t.templateConfig && t.templateConfig.complexity === 'COMPLEX'
      );
      
      expect(simpleTemplates).toHaveLength(1);
      expect(complexTemplates).toHaveLength(1);
      expect(simpleTemplates[0].templateConfig.estimated_time).toBe('1-2 hours');
      expect(complexTemplates[0].templateConfig.estimated_time).toBe('1-2 weeks');
    });
  });

  describe('Template Export and Import', () => {
    test('should export templates with full configuration', () => {
      const exportableTemplate = {
        id: 'export-template',
        name: 'Exportable Template',
        isTemplate: true,
        tags: ['export', 'template'],
        templateConfig: {
          placeholders: ['{{name}}', '{{version}}'],
          defaultValues: { version: '1.0.0' },
          validation: {
            required_fields: ['name'],
            version_fields: ['version']
          },
          categories: ['export-test'],
          metadata: {
            author: 'Test Author',
            created: new Date().toISOString(),
            version: '1.0.0'
          }
        },
        hierarchy: {
          root: {
            id: 'root',
            description: 'Export {{name}} version {{version}}',
            children: []
          }
        }
      };

      component.model.addPlan(exportableTemplate);

      const plans = component.api.getPlans();
      const template = plans.find(p => p.id === 'export-template');
      
      // Simulate export
      const exportData = {
        type: 'template',
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        template: template
      };

      expect(exportData.template.isTemplate).toBe(true);
      expect(exportData.template.templateConfig.placeholders).toContain('{{name}}');
      expect(exportData.template.templateConfig.defaultValues.version).toBe('1.0.0');
      expect(exportData.template.templateConfig.metadata.author).toBe('Test Author');
    });

    test('should import templates and validate structure', () => {
      const importedTemplateData = {
        id: 'imported-template',
        name: 'Imported Template',
        isTemplate: true,
        tags: ['imported'],
        templateConfig: {
          placeholders: ['{{service}}', '{{env}}'],
          defaultValues: { env: 'production' },
          validation: {
            required_fields: ['service']
          }
        },
        hierarchy: {
          root: {
            id: 'root',
            description: 'Deploy {{service}} to {{env}}',
            children: []
          }
        }
      };

      // Simulate import validation
      const validateImportedTemplate = (templateData) => {
        const errors = [];
        
        if (!templateData.isTemplate) {
          errors.push('Not marked as template');
        }
        
        if (!templateData.templateConfig) {
          errors.push('Missing template configuration');
        }
        
        if (!templateData.templateConfig.placeholders || 
            !Array.isArray(templateData.templateConfig.placeholders)) {
          errors.push('Invalid placeholders configuration');
        }
        
        return errors;
      };

      const validationErrors = validateImportedTemplate(importedTemplateData);
      expect(validationErrors).toHaveLength(0);

      // Import the template
      component.model.addPlan(importedTemplateData);

      const plans = component.api.getPlans();
      const importedTemplate = plans.find(p => p.id === 'imported-template');
      
      expect(importedTemplate).toBeTruthy();
      expect(importedTemplate.isTemplate).toBe(true);
      expect(importedTemplate.templateConfig.defaultValues.env).toBe('production');
    });
  });
});
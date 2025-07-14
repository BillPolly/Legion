/**
 * Tests for FrontendArchitecturePlanner class
 * 
 * FrontendArchitecturePlanner is responsible for planning frontend architecture
 * including component hierarchy, state management, and interaction patterns.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { FrontendArchitecturePlanner } from '../../../src/planning/FrontendArchitecturePlanner.js';

describe('FrontendArchitecturePlanner', () => {
  let planner;

  beforeEach(() => {
    planner = new FrontendArchitecturePlanner();
  });

  describe('Constructor', () => {
    test('should create FrontendArchitecturePlanner with default configuration', () => {
      expect(planner).toBeDefined();
      expect(planner.config).toBeDefined();
      expect(planner.config.componentPatterns).toBeDefined();
      expect(planner.config.stateManagement).toBe('vanilla');
    });

    test('should accept custom configuration', () => {
      const customPlanner = new FrontendArchitecturePlanner({
        stateManagement: 'local-storage',
        componentPatterns: 'modular',
        enableRouting: true
      });

      expect(customPlanner.config.stateManagement).toBe('local-storage');
      expect(customPlanner.config.componentPatterns).toBe('modular');
      expect(customPlanner.config.enableRouting).toBe(true);
    });
  });

  describe('Architecture Planning', () => {
    test('should plan simple component architecture', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            features: ['form', 'display'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const architecture = await planner.planArchitecture(analysis);

      expect(architecture.components).toBeDefined();
      expect(architecture.components.length).toBeGreaterThan(0);
      expect(architecture.stateManagement).toBeDefined();
      expect(architecture.dataFlow).toBeDefined();
    });

    test('should plan modular component architecture for medium complexity', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'medium',
        components: {
          frontend: {
            features: ['auth', 'dashboard', 'user-profile', 'settings'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const architecture = await planner.planArchitecture(analysis);

      expect(architecture.components.length).toBeGreaterThan(3);
      expect(architecture.components.some(c => c.name.includes('auth'))).toBe(true);
      expect(architecture.components.some(c => c.name.includes('dashboard'))).toBe(true);
      expect(architecture.stateManagement.pattern).toBeDefined();
    });

    test('should plan component hierarchy for high complexity', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'high',
        components: {
          frontend: {
            features: ['spa', 'routing', 'auth', 'dashboard', 'admin', 'api'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const architecture = await planner.planArchitecture(analysis);

      expect(architecture.componentHierarchy).toBeDefined();
      expect(architecture.componentHierarchy.root).toBeDefined();
      expect(architecture.componentHierarchy.pages).toBeDefined();
      expect(architecture.componentHierarchy.shared).toBeDefined();
    });
  });

  describe('Component Analysis', () => {
    test('should identify UI components from features', async () => {
      const features = ['login-form', 'todo-list', 'user-profile', 'settings-panel'];
      
      const components = await planner.analyzeComponents(features);

      expect(components).toContain('LoginForm');
      expect(components).toContain('TodoList');
      expect(components).toContain('UserProfile');
      expect(components).toContain('SettingsPanel');
    });

    test('should handle generic features', async () => {
      const features = ['crud', 'authentication', 'dashboard'];
      
      const components = await planner.analyzeComponents(features);

      expect(components.length).toBeGreaterThan(0);
      expect(components.some(c => c.includes('Auth'))).toBe(true);
      expect(components.some(c => c.includes('Dashboard'))).toBe(true);
    });

    test('should create component specifications', async () => {
      const features = ['todo-list', 'add-todo-form'];
      
      const specs = await planner.createComponentSpecs(features);

      expect(specs.length).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(spec.name).toBeDefined();
        expect(spec.purpose).toBeDefined();
        expect(spec.props).toBeDefined();
        expect(spec.methods).toBeDefined();
      }
    });
  });

  describe('State Management Planning', () => {
    test('should plan simple state management for low complexity', async () => {
      const analysis = {
        complexity: 'low',
        components: {
          frontend: {
            features: ['form', 'display']
          }
        }
      };

      const stateManagement = await planner.planStateManagement(analysis);

      expect(stateManagement.pattern).toBe('local');
      expect(stateManagement.stores).toBeDefined();
      expect(stateManagement.globalState).toBe(false);
    });

    test('should plan centralized state for medium complexity', async () => {
      const analysis = {
        complexity: 'medium',
        components: {
          frontend: {
            features: ['auth', 'dashboard', 'user-profile', 'settings']
          }
        }
      };

      const stateManagement = await planner.planStateManagement(analysis);

      expect(stateManagement.pattern).toBe('centralized');
      expect(stateManagement.stores.length).toBeGreaterThan(1);
      expect(stateManagement.globalState).toBe(true);
    });

    test('should plan modular state for high complexity', async () => {
      const analysis = {
        complexity: 'high',
        components: {
          frontend: {
            features: ['spa', 'routing', 'auth', 'dashboard', 'admin', 'api']
          }
        }
      };

      const stateManagement = await planner.planStateManagement(analysis);

      expect(stateManagement.pattern).toBe('modular');
      expect(stateManagement.stores.length).toBeGreaterThan(2);
      expect(stateManagement.modules).toBeDefined();
    });
  });

  describe('Data Flow Planning', () => {
    test('should plan data flow between components', async () => {
      const components = [
        { name: 'TodoForm', type: 'form' },
        { name: 'TodoList', type: 'display' },
        { name: 'TodoItem', type: 'item' }
      ];

      const dataFlow = await planner.planDataFlow(components);

      expect(dataFlow.interactions).toBeDefined();
      expect(dataFlow.interactions.length).toBeGreaterThan(0);
      expect(dataFlow.eventHandlers).toBeDefined();
    });

    test('should identify parent-child relationships', async () => {
      const components = [
        { name: 'App', type: 'container' },
        { name: 'Header', type: 'layout' },
        { name: 'MainContent', type: 'container' },
        { name: 'TodoList', type: 'display' }
      ];

      const hierarchy = await planner.analyzeComponentHierarchy(components);

      expect(hierarchy.root).toBe('App');
      expect(hierarchy.children['App']).toContain('Header');
      expect(hierarchy.children['App']).toContain('MainContent');
    });

    test('should plan event handling patterns', async () => {
      const analysis = {
        components: {
          frontend: {
            features: ['form-submission', 'list-management', 'item-deletion']
          }
        }
      };

      const eventHandling = await planner.planEventHandling(analysis);

      expect(eventHandling.patterns).toBeDefined();
      expect(eventHandling.handlers).toBeDefined();
      expect(eventHandling.eventTypes).toContain('submit');
      expect(eventHandling.eventTypes).toContain('click');
    });
  });

  describe('Styling Architecture', () => {
    test('should plan CSS architecture for simple projects', async () => {
      const analysis = {
        complexity: 'low',
        components: {
          frontend: {
            features: ['form', 'display'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const styling = await planner.planStylingArchitecture(analysis);

      expect(styling.approach).toBe('single-file');
      expect(styling.files).toContain('style.css');
      expect(styling.organization).toBe('simple');
    });

    test('should plan modular CSS for complex projects', async () => {
      const analysis = {
        complexity: 'high',
        components: {
          frontend: {
            features: ['spa', 'auth', 'dashboard', 'admin'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const styling = await planner.planStylingArchitecture(analysis);

      expect(styling.approach).toBe('modular');
      expect(styling.files.length).toBeGreaterThan(1);
      expect(styling.organization).toBe('component-based');
    });

    test('should handle CSS preprocessing requirements', async () => {
      const analysis = {
        complexity: 'medium',
        components: {
          frontend: {
            features: ['theming', 'responsive-design'],
            technologies: ['html', 'scss', 'javascript']
          }
        }
      };

      const styling = await planner.planStylingArchitecture(analysis);

      expect(styling.preprocessor).toBe('scss');
      expect(styling.features).toContain('variables');
      expect(styling.features).toContain('mixins');
    });
  });

  describe('Routing and Navigation', () => {
    test('should not plan routing for simple single-page apps', async () => {
      const analysis = {
        complexity: 'low',
        components: {
          frontend: {
            features: ['form', 'display']
          }
        }
      };

      const routing = await planner.planRouting(analysis);

      expect(routing.enabled).toBe(false);
      expect(routing.routes).toEqual([]);
    });

    test('should plan hash-based routing for medium complexity', async () => {
      const analysis = {
        complexity: 'medium',
        components: {
          frontend: {
            features: ['spa', 'multiple-pages', 'navigation']
          }
        }
      };

      const routing = await planner.planRouting(analysis);

      expect(routing.enabled).toBe(true);
      expect(routing.type).toBe('hash');
      expect(routing.routes.length).toBeGreaterThan(0);
    });

    test('should plan history API routing for complex SPAs', async () => {
      const analysis = {
        complexity: 'high',
        components: {
          frontend: {
            features: ['spa', 'routing', 'auth', 'admin']
          }
        }
      };

      const routing = await planner.planRouting(analysis);

      expect(routing.enabled).toBe(true);
      expect(routing.type).toBe('history');
      expect(routing.guards).toBeDefined();
      expect(routing.guards.auth).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid analysis gracefully', async () => {
      const invalidAnalysis = null;

      await expect(planner.planArchitecture(invalidAnalysis))
        .rejects.toThrow('Analysis must be provided');
    });

    test('should handle missing components gracefully', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'low'
      };

      const architecture = await planner.planArchitecture(analysis);

      expect(architecture).toBeDefined();
      expect(architecture.components).toBeDefined();
    });

    test('should provide fallback for unknown features', async () => {
      const features = ['unknown-feature', 'mysterious-component'];
      
      const components = await planner.analyzeComponents(features);

      expect(components.length).toBeGreaterThan(0);
      expect(components).toContain('GenericComponent');
    });
  });

  describe('Architecture Validation', () => {
    test('should validate architecture completeness', async () => {
      const architecture = {
        components: [
          { name: 'App', type: 'container' },
          { name: 'TodoList', type: 'display' }
        ],
        stateManagement: { pattern: 'local' },
        dataFlow: { interactions: [] }
      };

      const validation = await planner.validateArchitecture(architecture);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toBeDefined();
      expect(validation.suggestions).toBeDefined();
    });

    test('should identify missing components', async () => {
      const architecture = {
        components: [],
        stateManagement: { pattern: 'local' },
        dataFlow: { interactions: [] }
      };

      const validation = await planner.validateArchitecture(architecture);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('No components defined');
    });

    test('should suggest improvements', async () => {
      const architecture = {
        components: [
          { name: 'App', type: 'container' }
        ],
        stateManagement: { pattern: 'local' },
        dataFlow: { interactions: [] }
      };

      const validation = await planner.validateArchitecture(architecture);

      expect(validation.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Architecture Documentation', () => {
    test('should generate architecture documentation', async () => {
      const architecture = {
        components: [
          { name: 'App', type: 'container', purpose: 'Main application container' },
          { name: 'TodoList', type: 'display', purpose: 'Display list of todos' }
        ],
        stateManagement: { pattern: 'local' },
        dataFlow: { interactions: [] }
      };

      const documentation = await planner.generateDocumentation(architecture);

      expect(documentation.overview).toBeDefined();
      expect(documentation.componentDetails).toBeDefined();
      expect(documentation.stateManagement).toBeDefined();
      expect(documentation.implementationNotes).toBeDefined();
    });

    test('should include component interaction diagrams', async () => {
      const architecture = {
        components: [
          { name: 'TodoForm', type: 'form' },
          { name: 'TodoList', type: 'display' }
        ],
        dataFlow: {
          interactions: [
            { from: 'TodoForm', to: 'TodoList', event: 'todo-added' }
          ]
        }
      };

      const documentation = await planner.generateDocumentation(architecture);

      expect(documentation.interactionDiagram).toBeDefined();
      expect(documentation.eventFlow).toBeDefined();
    });
  });
});
/**
 * Tests for RequirementAnalyzer class
 * 
 * The RequirementAnalyzer is responsible for parsing and understanding
 * project requirements to create actionable development plans.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { RequirementAnalyzer } from '../../../src/planning/RequirementAnalyzer.js';

describe('RequirementAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new RequirementAnalyzer();
  });

  describe('Constructor', () => {
    test('should create RequirementAnalyzer with default configuration', () => {
      expect(analyzer).toBeDefined();
      expect(analyzer.config).toBeDefined();
      expect(analyzer.config.projectTypes).toContain('frontend');
      expect(analyzer.config.projectTypes).toContain('backend');
      expect(analyzer.config.projectTypes).toContain('fullstack');
    });

    test('should accept custom configuration', () => {
      const customConfig = {
        projectTypes: ['custom'],
        analysisDepth: 'deep'
      };
      
      const customAnalyzer = new RequirementAnalyzer(customConfig);
      expect(customAnalyzer.config.projectTypes).toContain('custom');
      expect(customAnalyzer.config.analysisDepth).toBe('deep');
    });
  });

  describe('analyzeRequirements', () => {
    test('should analyze simple frontend requirements', async () => {
      const requirements = {
        task: 'Create a todo list application',
        requirements: {
          frontend: 'HTML form for adding todos, display list with delete functionality'
        }
      };

      const analysis = await analyzer.analyzeRequirements(requirements);

      expect(analysis).toBeDefined();
      expect(analysis.projectType).toBe('frontend');
      expect(analysis.components).toBeDefined();
      expect(analysis.components.frontend).toBeDefined();
      expect(analysis.components.frontend.features).toContain('form');
      expect(analysis.components.frontend.features).toContain('list');
      expect(analysis.components.frontend.features).toContain('delete');
      expect(analysis.components.frontend.technologies).toContain('html');
      expect(analysis.components.frontend.technologies).toContain('javascript');
    });

    test('should analyze simple backend requirements', async () => {
      const requirements = {
        task: 'Create a REST API',
        requirements: {
          backend: 'REST API with CRUD operations for users, file-based storage'
        }
      };

      const analysis = await analyzer.analyzeRequirements(requirements);

      expect(analysis.projectType).toBe('backend');
      expect(analysis.components.backend).toBeDefined();
      expect(analysis.components.backend.features).toContain('rest-api');
      expect(analysis.components.backend.features).toContain('crud');
      expect(analysis.components.backend.operations).toContain('create');
      expect(analysis.components.backend.operations).toContain('read');
      expect(analysis.components.backend.operations).toContain('update');
      expect(analysis.components.backend.operations).toContain('delete');
      expect(analysis.components.backend.storage).toBe('file-based');
    });

    test('should analyze fullstack requirements', async () => {
      const requirements = {
        task: 'Create a blog application',
        requirements: {
          frontend: 'Article listing, article view, comment form',
          backend: 'REST API for articles and comments, authentication'
        }
      };

      const analysis = await analyzer.analyzeRequirements(requirements);

      expect(analysis.projectType).toBe('fullstack');
      expect(analysis.components.frontend).toBeDefined();
      expect(analysis.components.backend).toBeDefined();
      expect(analysis.components.frontend.features).toContain('listing');
      expect(analysis.components.frontend.features).toContain('view');
      expect(analysis.components.frontend.features).toContain('form');
      expect(analysis.components.backend.features).toContain('rest-api');
      expect(analysis.components.backend.features).toContain('authentication');
      expect(analysis.apiInterface).toBeDefined();
      expect(analysis.apiInterface.endpoints).toContain('/articles');
      expect(analysis.apiInterface.endpoints).toContain('/comments');
    });

    test('should handle complex requirements with multiple features', async () => {
      const requirements = {
        task: 'E-commerce product page',
        requirements: {
          frontend: 'Product gallery with zoom, add to cart button, quantity selector, reviews section, related products',
          backend: 'Product API, inventory tracking, cart management, review system'
        }
      };

      const analysis = await analyzer.analyzeRequirements(requirements);

      expect(analysis.projectType).toBe('fullstack');
      expect(analysis.components.frontend.features).toContain('gallery');
      expect(analysis.components.frontend.features).toContain('zoom');
      expect(analysis.components.frontend.features).toContain('cart');
      expect(analysis.components.frontend.features).toContain('reviews');
      expect(analysis.components.backend.features).toContain('inventory');
      expect(analysis.components.backend.features).toContain('cart-management');
      expect(analysis.complexity).toBe('high');
    });

    test('should detect authentication requirements', async () => {
      const requirements = {
        task: 'User dashboard',
        requirements: {
          frontend: 'Login form, dashboard with user profile',
          backend: 'User authentication, JWT tokens, profile management'
        }
      };

      const analysis = await analyzer.analyzeRequirements(requirements);

      expect(analysis.security).toBeDefined();
      expect(analysis.security.authentication).toBe(true);
      expect(analysis.security.method).toBe('jwt');
      expect(analysis.components.frontend.features).toContain('login');
      expect(analysis.components.backend.features).toContain('authentication');
    });

    test('should handle minimal requirements', async () => {
      const requirements = {
        task: 'Simple webpage'
      };

      const analysis = await analyzer.analyzeRequirements(requirements);

      expect(analysis.projectType).toBe('frontend');
      expect(analysis.components.frontend).toBeDefined();
      expect(analysis.complexity).toBe('low');
    });

    test('should detect data storage requirements', async () => {
      const requirements = {
        task: 'Note-taking app',
        requirements: {
          backend: 'Save notes to database, MongoDB preferred'
        }
      };

      const analysis = await analyzer.analyzeRequirements(requirements);

      expect(analysis.components.backend.storage).toBe('mongodb');
      expect(analysis.components.backend.features).toContain('database');
    });

    test('should identify UI components', async () => {
      const requirements = {
        task: 'Dashboard',
        requirements: {
          frontend: 'Navigation bar, sidebar menu, data tables, charts, modals'
        }
      };

      const analysis = await analyzer.analyzeRequirements(requirements);

      expect(analysis.components.frontend.uiComponents).toContain('navbar');
      expect(analysis.components.frontend.uiComponents).toContain('sidebar');
      expect(analysis.components.frontend.uiComponents).toContain('table');
      expect(analysis.components.frontend.uiComponents).toContain('chart');
      expect(analysis.components.frontend.uiComponents).toContain('modal');
    });

    test('should detect real-time requirements', async () => {
      const requirements = {
        task: 'Chat application',
        requirements: {
          frontend: 'Real-time messaging interface',
          backend: 'WebSocket server for real-time communication'
        }
      };

      const analysis = await analyzer.analyzeRequirements(requirements);

      expect(analysis.features).toBeDefined();
      expect(analysis.features.realtime).toBe(true);
      expect(analysis.components.backend.technologies).toContain('websocket');
    });

    test('should handle API-only requirements', async () => {
      const requirements = {
        task: 'API service',
        requirements: {
          backend: 'RESTful API with versioning, rate limiting, API key authentication'
        }
      };

      const analysis = await analyzer.analyzeRequirements(requirements);

      expect(analysis.projectType).toBe('backend');
      expect(analysis.apiInterface.versioning).toBe(true);
      expect(analysis.apiInterface.rateLimiting).toBe(true);
      expect(analysis.security.apiKey).toBe(true);
    });

    test('should throw error for invalid requirements', async () => {
      await expect(analyzer.analyzeRequirements(null)).rejects.toThrow('Requirements must be provided');
      await expect(analyzer.analyzeRequirements({})).rejects.toThrow('Task description is required');
    });
  });

  describe('extractFeatures', () => {
    test('should extract features from text', () => {
      const text = 'Create a form with validation, display data in a table with sorting';
      const features = analyzer.extractFeatures(text);

      expect(features).toContain('form');
      expect(features).toContain('validation');
      expect(features).toContain('table');
      expect(features).toContain('sorting');
    });

    test('should handle empty text', () => {
      const features = analyzer.extractFeatures('');
      expect(features).toEqual([]);
    });

    test('should detect common UI components', () => {
      const text = 'navbar, dropdown menu, accordion, carousel, tabs';
      const features = analyzer.extractFeatures(text);

      expect(features).toContain('navbar');
      expect(features).toContain('dropdown');
      expect(features).toContain('accordion');
      expect(features).toContain('carousel');
      expect(features).toContain('tabs');
    });
  });

  describe('determineComplexity', () => {
    test('should determine low complexity', () => {
      const analysis = {
        components: {
          frontend: { features: ['form', 'list'] }
        }
      };

      const complexity = analyzer.determineComplexity(analysis);
      expect(complexity).toBe('low');
    });

    test('should determine medium complexity', () => {
      const analysis = {
        components: {
          frontend: { features: ['form', 'list', 'validation', 'sorting'] },
          backend: { features: ['api', 'database'] }
        }
      };

      const complexity = analyzer.determineComplexity(analysis);
      expect(complexity).toBe('medium');
    });

    test('should determine high complexity', () => {
      const analysis = {
        components: {
          frontend: { features: Array(8).fill('feature') },
          backend: { features: Array(8).fill('feature') }
        },
        security: { authentication: true },
        features: { realtime: true }
      };

      const complexity = analyzer.determineComplexity(analysis);
      expect(complexity).toBe('high');
    });
  });

  describe('suggestArchitecture', () => {
    test('should suggest simple architecture for low complexity', () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: { features: ['form'] }
        }
      };

      const architecture = analyzer.suggestArchitecture(analysis);

      expect(architecture).toBeDefined();
      expect(architecture.pattern).toBe('simple');
      expect(architecture.structure).toBeDefined();
      expect(architecture.structure.frontend).toContain('index.html');
      expect(architecture.structure.frontend).toContain('style.css');
      expect(architecture.structure.frontend).toContain('script.js');
    });

    test('should suggest modular architecture for medium complexity', () => {
      const analysis = {
        projectType: 'fullstack',
        complexity: 'medium',
        components: {
          frontend: { features: ['form', 'list', 'auth'] },
          backend: { features: ['api', 'database'] }
        }
      };

      const architecture = analyzer.suggestArchitecture(analysis);

      expect(architecture.pattern).toBe('modular');
      expect(architecture.structure.frontend).toContain('components/');
      expect(architecture.structure.frontend).toContain('services/');
      expect(architecture.structure.backend).toContain('routes/');
      expect(architecture.structure.backend).toContain('models/');
    });

    test('should suggest layered architecture for high complexity', () => {
      const analysis = {
        projectType: 'fullstack',
        complexity: 'high',
        components: {
          frontend: { features: Array(8).fill('feature') },
          backend: { features: Array(8).fill('feature') }
        }
      };

      const architecture = analyzer.suggestArchitecture(analysis);

      expect(architecture.pattern).toBe('layered');
      expect(architecture.structure.frontend).toContain('components/');
      expect(architecture.structure.frontend).toContain('views/');
      expect(architecture.structure.frontend).toContain('utils/');
      expect(architecture.structure.backend).toContain('controllers/');
      expect(architecture.structure.backend).toContain('services/');
      expect(architecture.structure.backend).toContain('repositories/');
    });
  });

  describe('generateSummary', () => {
    test('should generate comprehensive summary', () => {
      const analysis = {
        projectType: 'fullstack',
        complexity: 'medium',
        components: {
          frontend: { 
            features: ['form', 'list'],
            technologies: ['html', 'css', 'javascript']
          },
          backend: { 
            features: ['api', 'database'],
            technologies: ['nodejs', 'express']
          }
        },
        security: { authentication: true }
      };

      const summary = analyzer.generateSummary(analysis);

      expect(summary).toBeDefined();
      expect(summary).toContain('fullstack');
      expect(summary).toContain('medium complexity');
      expect(summary).toContain('authentication');
    });
  });

  describe('validateAnalysis', () => {
    test('should validate correct analysis', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: { features: ['form'] }
        },
        complexity: 'low'
      };

      const isValid = analyzer.validateAnalysis(analysis);
      expect(isValid).toBe(true);
    });

    test('should invalidate analysis without project type', () => {
      const analysis = {
        components: {
          frontend: { features: ['form'] }
        }
      };

      const isValid = analyzer.validateAnalysis(analysis);
      expect(isValid).toBe(false);
    });

    test('should invalidate analysis without components', () => {
      const analysis = {
        projectType: 'frontend'
      };

      const isValid = analyzer.validateAnalysis(analysis);
      expect(isValid).toBe(false);
    });
  });
});
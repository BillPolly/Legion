/**
 * Tests for PlanContext model
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PlanContext } from '../../src/models/PlanContext.js';

describe('PlanContext', () => {
  let contextData;

  beforeEach(() => {
    contextData = {
      projectType: 'fullstack',
      technologies: {
        frontend: ['html', 'css', 'javascript'],
        backend: ['nodejs', 'express'],
        tools: ['git', 'npm', 'jest', 'eslint']
      },
      constraints: {
        accessibility: true,
        responsive: true,
        browserSupport: ['chrome', 'firefox', 'safari', 'edge'],
        performance: {
          loadTime: '< 3s',
          bundleSize: '< 500kb'
        }
      },
      requirements: {
        functional: [
          'User authentication',
          'CRUD operations for todos',
          'Real-time updates'
        ],
        nonFunctional: [
          'Must be accessible (WCAG 2.1 AA)',
          'Must work on mobile devices',
          'Must support offline mode'
        ]
      },
      environment: {
        development: {
          nodeVersion: '18.x',
          packageManager: 'npm'
        },
        production: {
          hosting: 'node-server',
          cdn: 'cloudflare'
        }
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  });

  describe('Constructor', () => {
    test('should create a PlanContext instance with all properties', () => {
      const context = new PlanContext(contextData);

      expect(context.projectType).toBe('fullstack');
      expect(context.technologies).toEqual(contextData.technologies);
      expect(context.constraints).toEqual(contextData.constraints);
      expect(context.requirements).toEqual(contextData.requirements);
      expect(context.environment).toEqual(contextData.environment);
      expect(context.metadata).toEqual(contextData.metadata);
    });

    test('should set default values', () => {
      const context = new PlanContext({});

      expect(context.projectType).toBe('unknown');
      expect(context.technologies).toEqual({});
      expect(context.constraints).toEqual({});
      expect(context.requirements).toEqual({ functional: [], nonFunctional: [] });
      expect(context.environment).toEqual({});
      expect(context.metadata.version).toBe('1.0.0');
      expect(context.metadata.createdAt).toBeDefined();
    });

    test('should validate project type', () => {
      const validTypes = ['frontend', 'backend', 'fullstack', 'api', 'library', 'cli', 'unknown'];
      
      validTypes.forEach(type => {
        const context = new PlanContext({ projectType: type });
        expect(context.projectType).toBe(type);
      });
    });

    test('should normalize technology arrays', () => {
      const context = new PlanContext({
        technologies: {
          frontend: 'javascript', // string instead of array
          backend: ['nodejs']
        }
      });

      expect(context.technologies.frontend).toEqual(['javascript']);
      expect(context.technologies.backend).toEqual(['nodejs']);
    });
  });

  describe('Methods', () => {
    test('should add technology', () => {
      const context = new PlanContext(contextData);

      context.addTechnology('frontend', 'es6-modules');

      expect(context.technologies.frontend).toContain('es6-modules');
    });

    test('should not add duplicate technology', () => {
      const context = new PlanContext(contextData);

      context.addTechnology('frontend', 'javascript');

      expect(context.technologies.frontend.filter(t => t === 'javascript')).toHaveLength(1);
    });

    test('should create new category when adding technology', () => {
      const context = new PlanContext({});

      context.addTechnology('database', 'mongodb');

      expect(context.technologies.database).toEqual(['mongodb']);
    });

    test('should remove technology', () => {
      const context = new PlanContext(contextData);

      context.removeTechnology('frontend', 'javascript');

      expect(context.technologies.frontend).not.toContain('javascript');
    });

    test('should add constraint', () => {
      const context = new PlanContext(contextData);

      context.addConstraint('security', { https: true, csp: true });

      expect(context.constraints.security).toEqual({ https: true, csp: true });
    });

    test('should merge constraints', () => {
      const context = new PlanContext({
        constraints: {
          performance: { loadTime: '< 3s' }
        }
      });

      context.addConstraint('performance', { bundleSize: '< 500kb' });

      expect(context.constraints.performance).toEqual({
        loadTime: '< 3s',
        bundleSize: '< 500kb'
      });
    });

    test('should add requirement', () => {
      const context = new PlanContext(contextData);

      context.addRequirement('functional', 'Export data to CSV');

      expect(context.requirements.functional).toContain('Export data to CSV');
    });

    test('should add non-functional requirement', () => {
      const context = new PlanContext(contextData);

      context.addRequirement('nonFunctional', 'Support dark mode');

      expect(context.requirements.nonFunctional).toContain('Support dark mode');
    });

    test('should get all technologies as flat array', () => {
      const context = new PlanContext(contextData);

      const allTech = context.getAllTechnologies();

      expect(allTech).toContain('javascript');
      expect(allTech).toContain('nodejs');
      expect(allTech).toContain('git');
      expect(allTech).toHaveLength(9); // 3 + 2 + 4
    });

    test('should check if has technology', () => {
      const context = new PlanContext(contextData);

      expect(context.hasTechnology('javascript')).toBe(true);
      expect(context.hasTechnology('typescript')).toBe(false);
    });

    test('should check if has constraint', () => {
      const context = new PlanContext(contextData);

      expect(context.hasConstraint('accessibility')).toBe(true);
      expect(context.hasConstraint('security')).toBe(false);
    });

    test('should validate context completeness', () => {
      const context = new PlanContext(contextData);

      const validation = context.validate();

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toHaveLength(0);
    });

    test('should detect missing project type', () => {
      const context = new PlanContext({ projectType: 'unknown' });

      const validation = context.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Project type is unknown');
    });

    test('should warn about missing technologies', () => {
      const context = new PlanContext({ projectType: 'fullstack' });

      const validation = context.validate();

      expect(validation.warnings).toContain('No technologies specified');
    });

    test('should update metadata on change', () => {
      const context = new PlanContext(contextData);
      const originalUpdatedAt = context.metadata.updatedAt;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        context.addTechnology('frontend', 'vue');
        expect(context.metadata.updatedAt).not.toBe(originalUpdatedAt);
      }, 10);
    });

    test('should merge contexts', () => {
      const context1 = new PlanContext({
        projectType: 'frontend',
        technologies: { frontend: ['html'] }
      });

      const context2 = new PlanContext({
        technologies: { frontend: ['css'], backend: ['nodejs'] },
        constraints: { responsive: true }
      });

      const merged = context1.merge(context2);

      expect(merged.projectType).toBe('frontend'); // keeps original
      expect(merged.technologies.frontend).toEqual(['html', 'css']);
      expect(merged.technologies.backend).toEqual(['nodejs']);
      expect(merged.constraints.responsive).toBe(true);
    });

    test('should clone context', () => {
      const context = new PlanContext(contextData);

      const cloned = context.clone();

      expect(cloned).not.toBe(context);
      expect(cloned.technologies).toEqual(context.technologies);
      expect(cloned.technologies).not.toBe(context.technologies); // deep clone
    });

    test('should export to JSON', () => {
      const context = new PlanContext(contextData);

      const json = context.toJSON();

      expect(json).toEqual({
        projectType: context.projectType,
        technologies: context.technologies,
        constraints: context.constraints,
        requirements: context.requirements,
        environment: context.environment,
        metadata: context.metadata
      });
    });

    test('should create from JSON', () => {
      const json = {
        projectType: 'api',
        technologies: { backend: ['nodejs', 'fastify'] },
        constraints: { rateLimit: '100 req/min' }
      };

      const context = PlanContext.fromJSON(json);

      expect(context).toBeInstanceOf(PlanContext);
      expect(context.projectType).toBe('api');
      expect(context.technologies.backend).toEqual(['nodejs', 'fastify']);
    });

    test('should generate summary', () => {
      const context = new PlanContext(contextData);

      const summary = context.getSummary();

      expect(summary).toContain('fullstack');
      expect(summary).toContain('javascript');
      expect(summary).toContain('nodejs');
      expect(summary).toContain('3 functional requirements');
      expect(summary).toContain('3 non-functional requirements');
    });

    test('should infer project complexity', () => {
      const simple = new PlanContext({
        projectType: 'frontend',
        technologies: { frontend: ['html', 'css'] }
      });

      const complex = new PlanContext(contextData);

      expect(simple.inferComplexity()).toBe('simple');
      expect(complex.inferComplexity()).toBe('moderate');
    });
  });

  describe('Static Methods', () => {
    test('should create context for frontend project', () => {
      const context = PlanContext.createFrontendContext({
        styling: 'css',
        testing: true
      });

      expect(context.projectType).toBe('frontend');
      expect(context.technologies.frontend).toContain('html');
      expect(context.technologies.frontend).toContain('css');
      expect(context.technologies.frontend).toContain('javascript');
      expect(context.technologies.tools).toContain('jest');
    });

    test('should create context for backend project', () => {
      const context = PlanContext.createBackendContext({
        framework: 'express'
      });

      expect(context.projectType).toBe('backend');
      expect(context.technologies.backend).toContain('nodejs');
      expect(context.technologies.backend).toContain('express');
    });

    test('should create context for fullstack project', () => {
      const context = PlanContext.createFullstackContext({
        backend: { framework: 'express' }
      });

      expect(context.projectType).toBe('fullstack');
      expect(context.technologies.frontend).toContain('html');
      expect(context.technologies.frontend).toContain('css');
      expect(context.technologies.frontend).toContain('javascript');
      expect(context.technologies.backend).toContain('nodejs');
      expect(context.technologies.backend).toContain('express');
    });
  });
});
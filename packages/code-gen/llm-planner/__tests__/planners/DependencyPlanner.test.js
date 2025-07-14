/**
 * Tests for DependencyPlanner class
 * 
 * DependencyPlanner handles package dependency detection,
 * import/export planning, and module dependency management.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { DependencyPlanner } from '../../src/planners/DependencyPlanner.js';

describe('DependencyPlanner', () => {
  let planner;

  beforeEach(() => {
    planner = new DependencyPlanner();
  });

  describe('Constructor', () => {
    test('should create DependencyPlanner with default configuration', () => {
      expect(planner).toBeDefined();
      expect(planner.config).toBeDefined();
      expect(planner.config.includeDevDependencies).toBe(true);
      expect(planner.config.autoDetectVersions).toBe(true);
    });

    test('should accept custom configuration', () => {
      const customPlanner = new DependencyPlanner({
        includeDevDependencies: false,
        autoDetectVersions: false,
        packageManager: 'yarn'
      });

      expect(customPlanner.config.includeDevDependencies).toBe(false);
      expect(customPlanner.config.autoDetectVersions).toBe(false);
      expect(customPlanner.config.packageManager).toBe('yarn');
    });

    test('should have dependency mappings defined', () => {
      expect(planner.dependencyMappings).toBeDefined();
      expect(planner.dependencyMappings.frontend).toBeDefined();
      expect(planner.dependencyMappings.backend).toBeDefined();
    });
  });

  describe('Package Dependency Detection', () => {
    test('should detect frontend dependencies', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'validation'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const dependencies = planner.detectPackageDependencies(analysis);

      expect(dependencies.runtime).toBeDefined();
      expect(dependencies.development).toBeDefined();
      expect(dependencies.runtime.length).toBeGreaterThan(0);
    });

    test('should detect backend dependencies', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api', 'auth', 'database'],
            technologies: ['nodejs', 'express', 'mongodb']
          }
        }
      };

      const dependencies = planner.detectPackageDependencies(analysis);

      expect(dependencies.runtime).toContain('express');
      expect(dependencies.runtime).toContain('mongodb');
      expect(dependencies.development).toContain('nodemon');
    });

    test('should detect TypeScript dependencies when present', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'typescript']
          }
        }
      };

      const dependencies = planner.detectPackageDependencies(analysis);

      expect(dependencies.development).toContain('typescript');
      expect(dependencies.development).toContain('@types/node');
    });

    test('should detect testing dependencies when testing features present', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['testing'],
            technologies: ['javascript']
          }
        }
      };

      const dependencies = planner.detectPackageDependencies(analysis);

      expect(dependencies.development).toContain('jest');
    });

    test('should detect authentication dependencies', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['auth', 'jwt'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const dependencies = planner.detectPackageDependencies(analysis);

      expect(dependencies.runtime).toContain('jsonwebtoken');
      expect(dependencies.runtime).toContain('bcrypt');
    });

    test('should handle fullstack dependencies', () => {
      const analysis = {
        projectType: 'fullstack',
        components: {
          frontend: {
            features: ['form'],
            technologies: ['html', 'javascript']
          },
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const dependencies = planner.detectPackageDependencies(analysis);

      expect(dependencies.runtime).toContain('express');
      expect(dependencies.development).toContain('nodemon');
    });
  });

  describe('Import/Export Planning', () => {
    test('should plan ES modules imports for frontend', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'validation'],
            technologies: ['javascript']
          }
        }
      };

      const importPlan = planner.planImportExports(analysis);

      expect(importPlan.moduleSystem).toBe('es6');
      expect(importPlan.imports).toBeDefined();
      expect(importPlan.exports).toBeDefined();
    });

    test('should plan CommonJS modules for backend', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs']
          }
        }
      };

      const importPlan = planner.planImportExports(analysis);

      expect(importPlan.moduleSystem).toBe('commonjs');
      expect(importPlan.imports.some(imp => imp.includes('require('))).toBe(true);
    });

    test('should plan TypeScript imports when TypeScript is used', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'typescript']
          }
        }
      };

      const importPlan = planner.planImportExports(analysis);

      expect(importPlan.moduleSystem).toBe('es6');
      expect(importPlan.typeImports).toBeDefined();
      expect(importPlan.typeImports.length).toBeGreaterThan(0);
    });

    test('should plan component imports for modular frontend', () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'medium',
        components: {
          frontend: {
            features: ['form', 'navigation'],
            technologies: ['javascript']
          }
        }
      };

      const importPlan = planner.planImportExports(analysis);

      expect(importPlan.componentImports).toBeDefined();
      expect(importPlan.componentImports.length).toBeGreaterThan(0);
    });

    test('should plan API service imports for fullstack', () => {
      const analysis = {
        projectType: 'fullstack',
        components: {
          frontend: {
            features: ['api-client'],
            technologies: ['javascript']
          },
          backend: {
            features: ['api'],
            technologies: ['nodejs']
          }
        }
      };

      const importPlan = planner.planImportExports(analysis);

      expect(importPlan.serviceImports).toBeDefined();
      expect(importPlan.serviceImports.some(imp => imp.includes('api'))).toBe(true);
    });
  });

  describe('Module Dependency Planning', () => {
    test('should create dependency graph for components', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'validation', 'auth'],
            technologies: ['javascript']
          }
        }
      };

      const dependencyGraph = planner.planModuleDependencies(analysis);

      expect(dependencyGraph.nodes).toBeDefined();
      expect(dependencyGraph.edges).toBeDefined();
      expect(dependencyGraph.nodes.length).toBeGreaterThan(0);
    });

    test('should detect circular dependencies', () => {
      const modules = [
        { name: 'moduleA', dependencies: ['moduleB'] },
        { name: 'moduleB', dependencies: ['moduleA'] }
      ];

      const result = planner.detectCircularDependencies(modules);

      expect(result.hasCircularDependencies).toBe(true);
      expect(result.cycles.length).toBe(1);
      expect(result.cycles[0]).toContain('moduleA');
      expect(result.cycles[0]).toContain('moduleB');
    });

    test('should generate load order for modules', () => {
      const modules = [
        { name: 'moduleA', dependencies: [] },
        { name: 'moduleB', dependencies: ['moduleA'] },
        { name: 'moduleC', dependencies: ['moduleB'] }
      ];

      const loadOrder = planner.generateLoadOrder(modules);

      expect(loadOrder.indexOf('moduleA')).toBeLessThan(loadOrder.indexOf('moduleB'));
      expect(loadOrder.indexOf('moduleB')).toBeLessThan(loadOrder.indexOf('moduleC'));
    });

    test('should plan lazy loading for complex projects', () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'high',
        components: {
          frontend: {
            features: ['dashboard', 'charts', 'auth', 'forms'],
            technologies: ['javascript']
          }
        }
      };

      const lazyLoadPlan = planner.planLazyLoading(analysis);

      expect(lazyLoadPlan.lazyModules).toBeDefined();
      expect(lazyLoadPlan.lazyModules.length).toBeGreaterThan(0);
      expect(lazyLoadPlan.loadingStrategy).toBeDefined();
    });

    test('should plan code splitting for large applications', () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'high',
        components: {
          frontend: {
            features: ['dashboard', 'admin', 'user-profile', 'settings'],
            technologies: ['javascript']
          }
        }
      };

      const splittingPlan = planner.planCodeSplitting(analysis);

      expect(splittingPlan.chunks).toBeDefined();
      expect(splittingPlan.chunks.length).toBeGreaterThan(1);
      expect(splittingPlan.strategy).toBe('feature-based');
    });
  });

  describe('Package.json Generation', () => {
    test('should generate package.json for frontend project', () => {
      const analysis = {
        projectType: 'frontend',
        task: 'Create a contact form',
        components: {
          frontend: {
            features: ['form'],
            technologies: ['javascript']
          }
        }
      };

      const packageJson = planner.generatePackageJson(analysis);

      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBe('1.0.0');
      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.devDependencies).toBeDefined();
    });

    test('should generate package.json for backend project', () => {
      const analysis = {
        projectType: 'backend',
        task: 'Create REST API',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const packageJson = planner.generatePackageJson(analysis);

      expect(packageJson.main).toBe('server.js');
      expect(packageJson.dependencies.express).toBeDefined();
      expect(packageJson.scripts.start).toBeDefined();
      expect(packageJson.scripts.dev).toBeDefined();
    });

    test('should include TypeScript configuration in package.json', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            technologies: ['nodejs', 'typescript']
          }
        }
      };

      const packageJson = planner.generatePackageJson(analysis);

      expect(packageJson.devDependencies.typescript).toBeDefined();
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts['type-check']).toBeDefined();
    });

    test('should include testing scripts when testing features present', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['testing'],
            technologies: ['nodejs']
          }
        }
      };

      const packageJson = planner.generatePackageJson(analysis);

      expect(packageJson.scripts.test).toBeDefined();
      expect(packageJson.devDependencies.jest).toBeDefined();
    });
  });

  describe('Version Management', () => {
    test('should suggest compatible versions for dependencies', () => {
      const dependencies = ['express', 'mongodb', 'jest'];

      const versionPlan = planner.suggestVersions(dependencies);

      expect(versionPlan.express).toMatch(/^\^\d+\.\d+\.\d+$/);
      expect(versionPlan.mongodb).toMatch(/^\^\d+\.\d+\.\d+$/);
      expect(versionPlan.jest).toMatch(/^\^\d+\.\d+\.\d+$/);
    });

    test('should handle version conflicts', () => {
      const dependencies = [
        { name: 'react', version: '18.0.0', requiredBy: 'component-a' },
        { name: 'react', version: '17.0.0', requiredBy: 'component-b' }
      ];

      const conflictResult = planner.resolveVersionConflicts(dependencies);

      expect(conflictResult.hasConflicts).toBe(true);
      expect(conflictResult.resolutions).toBeDefined();
      expect(conflictResult.resolutions.react).toBeDefined();
    });

    test('should suggest peer dependencies', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            technologies: ['react', 'typescript']
          }
        }
      };

      const peerDeps = planner.suggestPeerDependencies(analysis);

      expect(peerDeps).toBeDefined();
      expect(Array.isArray(peerDeps)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing analysis gracefully', () => {
      expect(() => planner.detectPackageDependencies(null))
        .toThrow('Analysis is required');
    });

    test('should handle missing project type', () => {
      const analysis = {
        components: { frontend: { technologies: ['html'] } }
      };

      expect(() => planner.detectPackageDependencies(analysis))
        .toThrow('Project type is required');
    });

    test('should provide fallback for unknown technologies', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            technologies: ['unknown-tech'],
            features: []
          }
        }
      };

      const dependencies = planner.detectPackageDependencies(analysis);

      expect(dependencies.runtime).toBeDefined();
      expect(dependencies.development).toBeDefined();
    });

    test('should handle empty feature arrays', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: [],
            technologies: ['nodejs']
          }
        }
      };

      const dependencies = planner.detectPackageDependencies(analysis);

      expect(dependencies.runtime).toBeDefined();
      expect(dependencies.development).toBeDefined();
    });
  });

  describe('Integration Features', () => {
    test('should integrate with package managers', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            technologies: ['nodejs']
          }
        }
      };

      const installCommands = planner.generateInstallCommands(analysis);

      expect(installCommands.npm).toBeDefined();
      expect(installCommands.yarn).toBeDefined();
      expect(installCommands.pnpm).toBeDefined();
    });

    test('should generate lockfile recommendations', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            technologies: ['nodejs']
          }
        }
      };

      const lockfileRec = planner.generateLockfileRecommendations(analysis);

      expect(lockfileRec.recommended).toBeDefined();
      expect(lockfileRec.reasoning).toBeDefined();
    });
  });
});
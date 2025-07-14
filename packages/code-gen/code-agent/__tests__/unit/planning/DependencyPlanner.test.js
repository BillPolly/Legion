/**
 * Tests for DependencyPlanner class
 * 
 * DependencyPlanner determines file dependencies and creation order
 * based on project structure and component relationships.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { DependencyPlanner } from '../../../src/planning/DependencyPlanner.js';

describe('DependencyPlanner', () => {
  let planner;

  beforeEach(() => {
    planner = new DependencyPlanner();
  });

  describe('Constructor', () => {
    test('should create DependencyPlanner with default configuration', () => {
      expect(planner).toBeDefined();
      expect(planner.config).toBeDefined();
      expect(planner.config.detectCircularDependencies).toBe(true);
      expect(planner.config.allowSelfDependencies).toBe(false);
    });

    test('should accept custom configuration', () => {
      const customPlanner = new DependencyPlanner({
        detectCircularDependencies: false,
        allowSelfDependencies: true,
        maxDependencyDepth: 10
      });

      expect(customPlanner.config.detectCircularDependencies).toBe(false);
      expect(customPlanner.config.allowSelfDependencies).toBe(true);
      expect(customPlanner.config.maxDependencyDepth).toBe(10);
    });
  });

  describe('Basic Dependency Planning', () => {
    test('should plan dependencies for simple frontend project', async () => {
      const structure = {
        directories: ['css', 'js'],
        files: ['index.html', 'css/style.css', 'js/script.js'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'styling'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      expect(dependencies.files).toBeDefined();
      expect(dependencies.creationOrder).toBeDefined();
      expect(dependencies.files['index.html']).toBeDefined();
      expect(dependencies.files['css/style.css']).toBeDefined();
      expect(dependencies.files['js/script.js']).toBeDefined();
    });

    test('should determine correct creation order', async () => {
      const structure = {
        directories: ['src', 'tests'],
        files: ['package.json', 'src/index.js', 'src/utils.js', 'tests/index.test.js'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api', 'testing'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      const order = dependencies.creationOrder;
      
      // package.json should come first
      expect(order.indexOf('package.json')).toBeLessThan(order.indexOf('src/index.js'));
      
      // Utils should come before files that depend on it
      expect(order.indexOf('src/utils.js')).toBeLessThan(order.indexOf('src/index.js'));
      
      // Tests should come after source files
      expect(order.indexOf('src/index.js')).toBeLessThan(order.indexOf('tests/index.test.js'));
    });
  });

  describe('Frontend Dependencies', () => {
    test('should detect HTML dependencies on CSS and JS', async () => {
      const structure = {
        directories: ['.'],
        files: ['index.html', 'style.css', 'script.js'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['webpage'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      const htmlDeps = dependencies.files['index.html'].dependencies;
      expect(htmlDeps).toContain('style.css');
      expect(htmlDeps).toContain('script.js');
    });

    test('should handle component dependencies', async () => {
      const structure = {
        directories: ['components', 'services'],
        files: ['index.html', 'components/form.js', 'components/list.js', 'services/api.js'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'list', 'api'],
            technologies: ['html', 'javascript']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      // Components should depend on services
      const formDeps = dependencies.files['components/form.js'].dependencies;
      expect(formDeps).toContain('services/api.js');
    });

    test('should handle CSS preprocessing dependencies', async () => {
      const structure = {
        directories: ['css', 'scss'],
        files: ['index.html', 'scss/main.scss', 'scss/_variables.scss', 'css/style.css'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['styling'],
            technologies: ['html', 'scss', 'css']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      // Main SCSS should depend on partials
      const mainScssDeps = dependencies.files['scss/main.scss'].dependencies;
      expect(mainScssDeps).toContain('scss/_variables.scss');

      // CSS should depend on SCSS
      const cssDeps = dependencies.files['css/style.css'].dependencies;
      expect(cssDeps).toContain('scss/main.scss');
    });
  });

  describe('Backend Dependencies', () => {
    test('should detect server dependencies on routes and models', async () => {
      const structure = {
        directories: ['routes', 'models'],
        files: ['server.js', 'package.json', 'routes/api.js', 'models/user.js'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api', 'database'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      // Server should depend on routes and models
      const serverDeps = dependencies.files['server.js'].dependencies;
      expect(serverDeps).toContain('routes/api.js');
      expect(serverDeps).toContain('models/user.js');

      // Routes should depend on models
      const routeDeps = dependencies.files['routes/api.js'].dependencies;
      expect(routeDeps).toContain('models/user.js');
    });

    test('should handle layered architecture dependencies', async () => {
      const structure = {
        directories: ['controllers', 'services', 'repositories', 'models'],
        files: [
          'server.js',
          'controllers/userController.js',
          'services/userService.js',
          'repositories/userRepository.js',
          'models/user.js'
        ],
        descriptions: {}
      };

      const analysis = {
        projectType: 'backend',
        complexity: 'high',
        components: {
          backend: {
            features: ['api', 'database'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      // Check layered dependencies: Controller -> Service -> Repository -> Model
      const controllerDeps = dependencies.files['controllers/userController.js'].dependencies;
      expect(controllerDeps).toContain('services/userService.js');

      const serviceDeps = dependencies.files['services/userService.js'].dependencies;
      expect(serviceDeps).toContain('repositories/userRepository.js');

      const repositoryDeps = dependencies.files['repositories/userRepository.js'].dependencies;
      expect(repositoryDeps).toContain('models/user.js');
    });

    test('should handle middleware dependencies', async () => {
      const structure = {
        directories: ['middleware', 'routes'],
        files: ['server.js', 'middleware/auth.js', 'middleware/logging.js', 'routes/api.js'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api', 'auth'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      // Server should depend on middleware
      const serverDeps = dependencies.files['server.js'].dependencies;
      expect(serverDeps).toContain('middleware/auth.js');
      expect(serverDeps).toContain('middleware/logging.js');

      // Routes should depend on auth middleware
      const routeDeps = dependencies.files['routes/api.js'].dependencies;
      expect(routeDeps).toContain('middleware/auth.js');
    });
  });

  describe('Fullstack Dependencies', () => {
    test('should handle frontend-backend separation', async () => {
      const structure = {
        directories: ['frontend', 'backend', 'shared'],
        files: [
          'package.json',
          'frontend/index.html',
          'frontend/app.js',
          'backend/server.js',
          'backend/api.js',
          'shared/types.js'
        ],
        descriptions: {}
      };

      const analysis = {
        projectType: 'fullstack',
        components: {
          frontend: {
            features: ['spa'],
            technologies: ['html', 'javascript']
          },
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      // Frontend should depend on shared
      const frontendDeps = dependencies.files['frontend/app.js'].dependencies;
      expect(frontendDeps).toContain('shared/types.js');

      // Backend should depend on shared
      const backendDeps = dependencies.files['backend/server.js'].dependencies;
      expect(backendDeps).toContain('shared/types.js');
    });
  });

  describe('Configuration File Dependencies', () => {
    test('should prioritize configuration files', async () => {
      const structure = {
        directories: ['src'],
        files: ['package.json', '.eslintrc.js', 'tsconfig.json', 'src/index.ts'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'typescript']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      const order = dependencies.creationOrder;

      // Configuration files should come first
      expect(order.indexOf('package.json')).toBeLessThan(order.indexOf('src/index.ts'));
      expect(order.indexOf('tsconfig.json')).toBeLessThan(order.indexOf('src/index.ts'));
      expect(order.indexOf('.eslintrc.js')).toBeLessThan(order.indexOf('src/index.ts'));
    });

    test('should handle environment file dependencies', async () => {
      const structure = {
        directories: ['src'],
        files: ['.env.example', '.env', 'src/config.js', 'src/server.js'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      // Config should depend on environment files
      const configDeps = dependencies.files['src/config.js'].dependencies;
      expect(configDeps).toContain('.env.example');

      // Server should depend on config
      const serverDeps = dependencies.files['src/server.js'].dependencies;
      expect(serverDeps).toContain('src/config.js');
    });
  });

  describe('Test Dependencies', () => {
    test('should make tests depend on source files', async () => {
      const structure = {
        directories: ['src', 'tests'],
        files: ['src/utils.js', 'src/api.js', 'tests/utils.test.js', 'tests/api.test.js'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api', 'testing'],
            technologies: ['nodejs', 'jest']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      // Test files should depend on corresponding source files
      const utilsTestDeps = dependencies.files['tests/utils.test.js'].dependencies;
      expect(utilsTestDeps).toContain('src/utils.js');

      const apiTestDeps = dependencies.files['tests/api.test.js'].dependencies;
      expect(apiTestDeps).toContain('src/api.js');
    });

    test('should handle test configuration dependencies', async () => {
      const structure = {
        directories: ['src', '__tests__'],
        files: ['jest.config.js', 'src/index.js', '__tests__/index.test.js'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['testing'],
            technologies: ['nodejs', 'jest']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      // Tests should depend on jest config
      const testDeps = dependencies.files['__tests__/index.test.js'].dependencies;
      expect(testDeps).toContain('jest.config.js');
    });
  });

  describe('Circular Dependency Detection', () => {
    test('should detect circular dependencies', async () => {
      const structure = {
        directories: ['src'],
        files: ['src/a.js', 'src/b.js', 'src/c.js'],
        descriptions: {}
      };

      // Manually create circular dependency for testing
      const customPlanner = new DependencyPlanner();
      
      const dependencies = {
        files: {
          'src/a.js': { dependencies: ['src/b.js'] },
          'src/b.js': { dependencies: ['src/c.js'] },
          'src/c.js': { dependencies: ['src/a.js'] }
        }
      };

      const circular = customPlanner._detectCircularDependencies(dependencies.files);
      expect(circular.length).toBeGreaterThan(0);
    });

    test('should resolve circular dependencies when detected', async () => {
      const structure = {
        directories: ['src'],
        files: ['src/a.js', 'src/b.js'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      // Should not have circular dependencies in final result
      const circular = planner._detectCircularDependencies(dependencies.files);
      expect(circular.length).toBe(0);
    });
  });

  describe('Dependency Types and Metadata', () => {
    test('should classify dependency types', async () => {
      const structure = {
        directories: ['src'],
        files: ['package.json', 'src/index.js', 'src/types.js'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'typescript']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      const indexDeps = dependencies.files['src/index.js'];
      expect(indexDeps.dependencyTypes).toBeDefined();
      expect(indexDeps.dependencyTypes['package.json']).toBe('configuration');
      expect(indexDeps.dependencyTypes['src/types.js']).toBe('import');
    });

    test('should include dependency metadata', async () => {
      const structure = {
        directories: ['src'],
        files: ['src/index.js', 'src/utils.js'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      expect(dependencies.metadata).toBeDefined();
      expect(dependencies.metadata.planner).toBe('DependencyPlanner');
      expect(dependencies.metadata.totalFiles).toBe(2);
      expect(dependencies.metadata.plannedAt).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid structure gracefully', async () => {
      const invalidStructure = null;
      const analysis = {
        projectType: 'frontend',
        components: {}
      };

      await expect(planner.planDependencies(invalidStructure, analysis))
        .rejects.toThrow('Structure must be provided');
    });

    test('should handle missing analysis gracefully', async () => {
      const structure = {
        directories: ['.'],
        files: ['index.html'],
        descriptions: {}
      };

      await expect(planner.planDependencies(structure, null))
        .rejects.toThrow('Analysis must be provided');
    });

    test('should provide fallback for unknown file types', async () => {
      const structure = {
        directories: ['.'],
        files: ['unknown.xyz', 'index.html'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['webpage'],
            technologies: ['html']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      // Should still plan dependencies for known files
      expect(dependencies.files['index.html']).toBeDefined();
      expect(dependencies.files['unknown.xyz']).toBeDefined();
    });
  });

  describe('Optimization and Performance', () => {
    test('should handle large file structures efficiently', async () => {
      const structure = {
        directories: Array.from({ length: 20 }, (_, i) => `dir${i}`),
        files: Array.from({ length: 100 }, (_, i) => `file${i}.js`),
        descriptions: {}
      };

      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs']
          }
        }
      };

      const startTime = Date.now();
      const dependencies = await planner.planDependencies(structure, analysis);
      const endTime = Date.now();

      expect(dependencies).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should optimize creation order for parallel execution', async () => {
      const structure = {
        directories: ['src'],
        files: ['src/a.js', 'src/b.js', 'src/c.js', 'src/main.js'],
        descriptions: {}
      };

      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs']
          }
        }
      };

      const dependencies = await planner.planDependencies(structure, analysis);

      // Should identify files that can be created in parallel
      expect(dependencies.parallelGroups).toBeDefined();
      expect(Array.isArray(dependencies.parallelGroups)).toBe(true);
    });
  });
});
/**
 * Tests for DirectoryPlanner class
 * 
 * DirectoryPlanner is responsible for creating project directory structures
 * based on project requirements and architecture patterns.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { DirectoryPlanner } from '../../../src/planning/DirectoryPlanner.js';

describe('DirectoryPlanner', () => {
  let planner;

  beforeEach(() => {
    planner = new DirectoryPlanner();
  });

  describe('Constructor', () => {
    test('should create DirectoryPlanner with default configuration', () => {
      expect(planner).toBeDefined();
      expect(planner.config).toBeDefined();
      expect(planner.config.createGitignore).toBe(true);
      expect(planner.config.createReadme).toBe(true);
    });

    test('should accept custom configuration', () => {
      const customPlanner = new DirectoryPlanner({
        createGitignore: false,
        createReadme: false,
        customStructures: { 'custom': ['src/', 'dist/'] }
      });

      expect(customPlanner.config.createGitignore).toBe(false);
      expect(customPlanner.config.createReadme).toBe(false);
      expect(customPlanner.config.customStructures.custom).toEqual(['src/', 'dist/']);
    });
  });

  describe('Frontend Project Planning', () => {
    test('should plan simple frontend structure', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            features: ['form', 'list'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.directories).toContain('.');
      expect(structure.files).toContain('index.html');
      expect(structure.files).toContain('style.css');
      expect(structure.files).toContain('script.js');
      expect(structure.files).toContain('.gitignore');
      expect(structure.files).toContain('README.md');
    });

    test('should plan modular frontend structure for medium complexity', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'medium',
        components: {
          frontend: {
            features: ['auth', 'dashboard', 'api'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.directories).toContain('css');
      expect(structure.directories).toContain('js');
      expect(structure.directories).toContain('components');
      expect(structure.directories).toContain('services');
      expect(structure.files).toContain('index.html');
    });

    test('should plan layered frontend structure for high complexity', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'high',
        components: {
          frontend: {
            features: ['auth', 'dashboard', 'api', 'routing'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.directories).toContain('assets');
      expect(structure.directories).toContain('components');
      expect(structure.directories).toContain('views');
      expect(structure.directories).toContain('services');
      expect(structure.directories).toContain('utils');
      expect(structure.directories).toContain('config');
    });
  });

  describe('Backend Project Planning', () => {
    test('should plan simple backend structure', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'low',
        components: {
          backend: {
            features: ['api', 'crud'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.files).toContain('server.js');
      expect(structure.files).toContain('package.json');
      expect(structure.files).toContain('.gitignore');
      expect(structure.files).toContain('README.md');
    });

    test('should plan modular backend structure for medium complexity', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'medium',
        components: {
          backend: {
            features: ['api', 'auth', 'database'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.directories).toContain('routes');
      expect(structure.directories).toContain('models');
      expect(structure.directories).toContain('utils');
      expect(structure.files).toContain('server.js');
      expect(structure.files).toContain('package.json');
    });

    test('should plan layered backend structure for high complexity', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'high',
        components: {
          backend: {
            features: ['api', 'auth', 'database', 'realtime'],
            technologies: ['nodejs', 'express', 'websocket']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.directories).toContain('controllers');
      expect(structure.directories).toContain('services');
      expect(structure.directories).toContain('models');
      expect(structure.directories).toContain('repositories');
      expect(structure.directories).toContain('middleware');
      expect(structure.directories).toContain('utils');
      expect(structure.directories).toContain('config');
    });
  });

  describe('Fullstack Project Planning', () => {
    test('should plan fullstack project structure', async () => {
      const analysis = {
        projectType: 'fullstack',
        complexity: 'medium',
        components: {
          frontend: {
            features: ['auth', 'dashboard'],
            technologies: ['html', 'css', 'javascript']
          },
          backend: {
            features: ['api', 'auth', 'database'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.directories).toContain('frontend');
      expect(structure.directories).toContain('backend');
      expect(structure.directories).toContain('shared');
      expect(structure.files).toContain('package.json');
      expect(structure.files).toContain('.gitignore');
      expect(structure.files).toContain('README.md');
    });

    test('should organize fullstack directories logically', async () => {
      const analysis = {
        projectType: 'fullstack',
        complexity: 'high',
        components: {
          frontend: {
            features: ['spa', 'routing'],
            technologies: ['html', 'css', 'javascript']
          },
          backend: {
            features: ['rest-api', 'auth'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      // Should have separated frontend and backend
      expect(structure.directories).toContain('frontend');
      expect(structure.directories).toContain('backend');
      expect(structure.directories).toContain('shared');
      
      // Should have monorepo structure
      expect(structure.files).toContain('package.json');
    });
  });

  describe('Feature-Specific Planning', () => {
    test('should add test directories when testing features detected', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'medium',
        components: {
          frontend: {
            features: ['testing', 'components'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.directories).toContain('tests');
      expect(structure.directories).toContain('__tests__');
    });

    test('should add documentation directory for complex projects', async () => {
      const analysis = {
        projectType: 'fullstack',
        complexity: 'high',
        components: {
          frontend: {
            features: ['documentation'],
            technologies: ['html', 'css', 'javascript']
          },
          backend: {
            features: ['api', 'documentation'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.directories).toContain('docs');
    });

    test('should add assets directory for media features', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'medium',
        components: {
          frontend: {
            features: ['gallery', 'media', 'images'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.directories).toContain('assets');
      expect(structure.directories).toContain('images');
    });
  });

  describe('Technology-Specific Planning', () => {
    test('should adapt structure for TypeScript projects', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'medium',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express', 'typescript']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.directories).toContain('src');
      expect(structure.directories).toContain('dist');
      expect(structure.files).toContain('tsconfig.json');
    });

    test('should add database-specific directories', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'medium',
        components: {
          backend: {
            features: ['database'],
            technologies: ['nodejs', 'express', 'mongodb']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.directories).toContain('models');
      expect(structure.directories).toContain('schemas');
    });

    test('should add WebSocket directories for realtime features', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'medium',
        components: {
          backend: {
            features: ['realtime', 'websocket'],
            technologies: ['nodejs', 'express', 'websocket']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.directories).toContain('sockets');
      expect(structure.directories).toContain('events');
    });
  });

  describe('Configuration Files', () => {
    test('should include package.json for Node.js projects', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'low',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.files).toContain('package.json');
    });

    test('should include .gitignore by default', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            features: ['webpage'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.files).toContain('.gitignore');
    });

    test('should skip .gitignore when configured', async () => {
      const customPlanner = new DirectoryPlanner({ createGitignore: false });
      
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            features: ['webpage'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const structure = await customPlanner.planDirectoryStructure(analysis);

      expect(structure.files).not.toContain('.gitignore');
    });

    test('should include README.md by default', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            features: ['webpage'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.files).toContain('README.md');
    });
  });

  describe('Structure Validation', () => {
    test('should validate planned structure', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            features: ['webpage'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.isValid).toBe(true);
      expect(Array.isArray(structure.directories)).toBe(true);
      expect(Array.isArray(structure.files)).toBe(true);
      expect(structure.metadata).toBeDefined();
    });

    test('should detect missing required directories', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'low',
        components: {
          backend: {
            features: [],
            technologies: []
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.warnings).toBeDefined();
      expect(Array.isArray(structure.warnings)).toBe(true);
    });
  });

  describe('Custom Structures', () => {
    test('should support custom directory structures', async () => {
      const customPlanner = new DirectoryPlanner({
        customStructures: {
          'microservice': ['src/', 'tests/', 'docker/', 'docs/']
        }
      });

      const analysis = {
        projectType: 'backend',
        complexity: 'low',
        customPattern: 'microservice',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const structure = await customPlanner.planDirectoryStructure(analysis);

      expect(structure.directories).toContain('src');
      expect(structure.directories).toContain('tests');
      expect(structure.directories).toContain('docker');
      expect(structure.directories).toContain('docs');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid analysis gracefully', async () => {
      const invalidAnalysis = null;

      await expect(planner.planDirectoryStructure(invalidAnalysis)).rejects.toThrow('Analysis must be provided');
    });

    test('should handle missing project type', async () => {
      const analysis = {
        complexity: 'low',
        components: {}
      };

      await expect(planner.planDirectoryStructure(analysis)).rejects.toThrow('Project type must be specified');
    });

    test('should provide default structure for unknown project types', async () => {
      const analysis = {
        projectType: 'unknown',
        complexity: 'low',
        components: {}
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure).toBeDefined();
      expect(structure.directories).toContain('.');
      expect(structure.files).toContain('README.md');
    });
  });

  describe('Metadata and Documentation', () => {
    test('should include planning metadata', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            features: ['webpage'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.metadata).toBeDefined();
      expect(structure.metadata.planner).toBe('DirectoryPlanner');
      expect(structure.metadata.plannedAt).toBeDefined();
      expect(structure.metadata.projectType).toBe('frontend');
      expect(structure.metadata.complexity).toBe('low');
    });

    test('should generate structure descriptions', async () => {
      const analysis = {
        projectType: 'fullstack',
        complexity: 'medium',
        components: {
          frontend: {
            features: ['spa'],
            technologies: ['html', 'css', 'javascript']
          },
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const structure = await planner.planDirectoryStructure(analysis);

      expect(structure.descriptions).toBeDefined();
      expect(typeof structure.descriptions).toBe('object');
    });
  });
});
/**
 * Tests for ProjectStructurePlanner class
 * 
 * ProjectStructurePlanner handles detailed project structure planning
 * including directory layouts, file organization, and architecture patterns.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ProjectStructurePlanner } from '../../src/planners/ProjectStructurePlanner.js';
import { PlanContext } from '../../src/models/PlanContext.js';

describe('ProjectStructurePlanner', () => {
  let planner;

  beforeEach(() => {
    planner = new ProjectStructurePlanner();
  });

  describe('Constructor', () => {
    test('should create ProjectStructurePlanner with default configuration', () => {
      expect(planner).toBeDefined();
      expect(planner.config).toBeDefined();
      expect(planner.config.createGitignore).toBe(true);
      expect(planner.config.createReadme).toBe(true);
    });

    test('should accept custom configuration', () => {
      const customPlanner = new ProjectStructurePlanner({
        createGitignore: false,
        createReadme: false,
        customTemplates: { test: [] }
      });

      expect(customPlanner.config.createGitignore).toBe(false);
      expect(customPlanner.config.createReadme).toBe(false);
      expect(customPlanner.config.customTemplates).toEqual({ test: [] });
    });

    test('should have predefined structure templates', () => {
      expect(planner.templates).toBeDefined();
      expect(planner.templates.frontend).toBeDefined();
      expect(planner.templates.backend).toBeDefined();
      expect(planner.templates.fullstack).toBeDefined();
    });
  });

  describe('Frontend Project Structure Planning', () => {
    test('should plan simple frontend structure', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            features: ['form'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.isValid).toBe(true);
      expect(structure.directories).toContain('.');
      expect(structure.files).toContain('index.html');
      expect(structure.files).toContain('style.css');
      expect(structure.files).toContain('script.js');
      expect(structure.metadata.projectType).toBe('frontend');
    });

    test('should plan modular frontend structure', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'medium',
        components: {
          frontend: {
            features: ['form', 'navigation', 'auth'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.directories).toContain('css');
      expect(structure.directories).toContain('js');
      expect(structure.directories).toContain('components');
      expect(structure.files).toContain('index.html');
    });

    test('should plan layered frontend structure for complex projects', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'high',
        components: {
          frontend: {
            features: ['form', 'navigation', 'auth', 'dashboard', 'api'],
            technologies: ['html', 'css', 'javascript', 'typescript']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.directories).toContain('assets');
      expect(structure.directories).toContain('components');
      expect(structure.directories).toContain('views');
      expect(structure.directories).toContain('services');
      expect(structure.directories).toContain('utils');
      expect(structure.directories).toContain('config');
    });

    test('should add feature-specific directories for frontend', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'medium',
        components: {
          frontend: {
            features: ['gallery', 'auth', 'testing'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.directories).toContain('assets');
      expect(structure.directories).toContain('images');
      expect(structure.directories).toContain('tests');
    });
  });

  describe('Backend Project Structure Planning', () => {
    test('should plan simple backend structure', async () => {
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

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.files).toContain('server.js');
      expect(structure.files).toContain('package.json');
      expect(structure.metadata.projectType).toBe('backend');
    });

    test('should plan modular backend structure', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'medium',
        components: {
          backend: {
            features: ['api', 'auth', 'crud'],
            technologies: ['nodejs', 'express', 'mongodb']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.directories).toContain('routes');
      expect(structure.directories).toContain('models');
      expect(structure.directories).toContain('utils');
      expect(structure.directories).toContain('controllers');
    });

    test('should plan layered backend structure for complex projects', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'high',
        components: {
          backend: {
            features: ['api', 'auth', 'crud', 'realtime'],
            technologies: ['nodejs', 'express', 'mongodb', 'websocket']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.directories).toContain('controllers');
      expect(structure.directories).toContain('services');
      expect(structure.directories).toContain('models');
      expect(structure.directories).toContain('repositories');
      expect(structure.directories).toContain('middleware');
      expect(structure.directories).toContain('sockets');
      expect(structure.directories).toContain('events');
    });

    test('should add technology-specific structure for backend', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'medium',
        components: {
          backend: {
            features: ['api', 'database'],
            technologies: ['nodejs', 'typescript', 'mongodb', 'docker']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.directories).toContain('src');
      expect(structure.directories).toContain('dist');
      expect(structure.files).toContain('tsconfig.json');
      expect(structure.files).toContain('Dockerfile');
      expect(structure.files).toContain('docker-compose.yml');
    });
  });

  describe('Fullstack Project Structure Planning', () => {
    test('should plan simple fullstack structure', async () => {
      const analysis = {
        projectType: 'fullstack',
        complexity: 'low',
        components: {
          frontend: {
            features: ['form'],
            technologies: ['html', 'css', 'javascript']
          },
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.directories).toContain('frontend');
      expect(structure.directories).toContain('backend');
      expect(structure.files).toContain('package.json');
    });

    test('should plan modular fullstack structure', async () => {
      const analysis = {
        projectType: 'fullstack',
        complexity: 'medium',
        components: {
          frontend: {
            features: ['form', 'navigation'],
            technologies: ['html', 'css', 'javascript']
          },
          backend: {
            features: ['api', 'auth'],
            technologies: ['nodejs', 'express', 'mongodb']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.directories).toContain('frontend');
      expect(structure.directories).toContain('backend');
      expect(structure.directories).toContain('shared');
    });

    test('should plan layered fullstack structure for complex projects', async () => {
      const analysis = {
        projectType: 'fullstack',
        complexity: 'high',
        components: {
          frontend: {
            features: ['dashboard', 'auth', 'forms'],
            technologies: ['html', 'css', 'javascript', 'typescript']
          },
          backend: {
            features: ['api', 'auth', 'realtime', 'database'],
            technologies: ['nodejs', 'express', 'mongodb', 'websocket']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.directories).toContain('frontend');
      expect(structure.directories).toContain('backend');
      expect(structure.directories).toContain('shared');
      expect(structure.directories).toContain('docs');
      expect(structure.directories).toContain('scripts');
    });
  });

  describe('Configuration Files', () => {
    test('should add package.json for Node.js projects', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'low',
        components: {
          backend: {
            technologies: ['nodejs']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.files).toContain('package.json');
    });

    test('should add environment files for backend projects', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'medium',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.files).toContain('.env.example');
    });

    test('should add testing configuration when testing features are present', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'medium',
        components: {
          frontend: {
            features: ['testing'],
            technologies: ['javascript']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.files).toContain('jest.config.js');
      expect(structure.directories).toContain('tests');
    });

    test('should add ESLint configuration for complex projects', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'medium',
        components: {
          frontend: {
            technologies: ['javascript']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.files).toContain('.eslintrc.js');
    });
  });

  describe('Common Files', () => {
    test('should add README.md by default', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            technologies: ['html']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.files).toContain('README.md');
    });

    test('should add .gitignore by default', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'low',
        components: {
          backend: {
            technologies: ['nodejs']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.files).toContain('.gitignore');
    });

    test('should add LICENSE for high complexity projects', async () => {
      const analysis = {
        projectType: 'fullstack',
        complexity: 'high',
        components: {
          frontend: { technologies: ['javascript'] },
          backend: { technologies: ['nodejs'] }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.files).toContain('LICENSE');
    });

    test('should skip README and gitignore when configured', async () => {
      const customPlanner = new ProjectStructurePlanner({
        createReadme: false,
        createGitignore: false
      });

      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            technologies: ['html']
          }
        }
      };

      const structure = await customPlanner.planProjectStructure(analysis);

      expect(structure.files).not.toContain('README.md');
      expect(structure.files).not.toContain('.gitignore');
    });
  });

  describe('Directory Descriptions', () => {
    test('should generate descriptions for planned directories', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'medium',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.descriptions).toBeDefined();
      expect(structure.descriptions.routes).toContain('API route definitions');
      expect(structure.descriptions.models).toContain('Data models and schemas');
    });

    test('should only include descriptions for existing directories', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            technologies: ['html']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      expect(structure.descriptions.routes).toBeUndefined();
      expect(Object.keys(structure.descriptions)).not.toContain('routes');
    });
  });

  describe('Structure Validation', () => {
    test('should validate structure and remove duplicates', async () => {
      // Mock a scenario that might create duplicates
      const analysis = {
        projectType: 'backend',
        complexity: 'medium',
        components: {
          backend: {
            features: ['api', 'testing'],
            technologies: ['nodejs', 'typescript']
          }
        }
      };

      const structure = await planner.planProjectStructure(analysis);

      // Check that arrays don't contain duplicates
      const uniqueDirectories = [...new Set(structure.directories)];
      const uniqueFiles = [...new Set(structure.files)];

      expect(structure.directories).toEqual(uniqueDirectories);
      expect(structure.files).toEqual(uniqueFiles);
    });

    test('should warn about missing essential files', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            technologies: ['css'] // Missing HTML
          }
        }
      };

      // Mock to test validation warnings
      const mockPlanner = new ProjectStructurePlanner();
      const originalApplyBase = mockPlanner._applyBaseStructure;
      mockPlanner._applyBaseStructure = function(structure, analysis) {
        // Don't add index.html to trigger warning
        structure.files.push('style.css');
      };

      const structure = await mockPlanner.planProjectStructure(analysis);

      expect(structure.warnings).toContain('Frontend project missing index.html file');
    });

    test('should warn about missing server file for backend', async () => {
      const analysis = {
        projectType: 'backend',
        complexity: 'low',
        components: {
          backend: {
            technologies: ['nodejs']
          }
        }
      };

      // Mock to test validation warnings  
      const mockPlanner = new ProjectStructurePlanner();
      const originalApplyBase = mockPlanner._applyBaseStructure;
      mockPlanner._applyBaseStructure = function(structure, analysis) {
        // Don't add server.js to trigger warning
        structure.files.push('package.json');
      };

      const structure = await mockPlanner.planProjectStructure(analysis);

      expect(structure.warnings).toContain('Backend project missing main server file');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing analysis', async () => {
      await expect(planner.planProjectStructure(null))
        .rejects.toThrow('Analysis must be provided');
    });

    test('should handle missing project type', async () => {
      const analysis = {
        components: {
          frontend: { technologies: ['html'] }
        }
      };

      await expect(planner.planProjectStructure(analysis))
        .rejects.toThrow('Project type must be specified');
    });

    test('should provide fallback structure on error', async () => {
      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {}
      };

      // Force an error during planning
      const mockPlanner = new ProjectStructurePlanner();
      mockPlanner._applyBaseStructure = function() {
        throw new Error('Test error');
      };

      const structure = await mockPlanner.planProjectStructure(analysis);

      expect(structure.isValid).toBe(false);
      expect(structure.warnings).toContain('Planning failed: Test error');
      expect(structure.files).toContain('README.md');
      expect(structure.files).toContain('index.html'); // Fallback for frontend
    });
  });

  describe('Available Templates', () => {
    test('should return available structure templates', () => {
      const templates = planner.getAvailableTemplates();

      expect(templates.projectTypes).toContain('frontend');
      expect(templates.projectTypes).toContain('backend');
      expect(templates.projectTypes).toContain('fullstack');
      expect(templates.complexityLevels).toContain('low');
      expect(templates.complexityLevels).toContain('medium');
      expect(templates.complexityLevels).toContain('high');
    });
  });

  describe('Structure Preview', () => {
    test('should provide structure preview', async () => {
      const analysis = {
        projectType: 'fullstack',
        complexity: 'medium',
        components: {
          frontend: { features: ['form'], technologies: ['html'] },
          backend: { features: ['api'], technologies: ['nodejs'] }
        }
      };

      const preview = await planner.previewStructure(analysis);

      expect(preview.directoryCount).toBeDefined();
      expect(preview.fileCount).toBeDefined();
      expect(preview.hasWarnings).toBeDefined();
      expect(preview.complexity).toBe('medium');
      expect(preview.preview.directories).toBeDefined();
      expect(preview.preview.files).toBeDefined();
    });
  });
});
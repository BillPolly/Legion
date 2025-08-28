/**
 * SimplePlanningMode - Bypasses complex GenericPlanner for simple projects
 * 
 * This provides a fast path for simple code generation tasks that don't need
 * the full power of hierarchical planning.
 */

class SimplePlanningMode {
  /**
   * Check if a task is simple enough to bypass full planning
   * @param {Object} requirements - Project requirements
   * @returns {boolean} True if simple mode can be used
   */
  static canUseSimpleMode(requirements) {
    // Check if it's a simple single-file project
    const hasComplexRequirements = 
      (requirements.frontend && Object.keys(requirements.frontend).length > 5) ||
      (requirements.backend && Object.keys(requirements.backend).length > 5) ||
      (requirements.requirements && requirements.requirements.length > 500);
    
    const isSimpleBackend = 
      requirements.projectType === 'backend' &&
      !requirements.deployment &&
      !requirements.database;
    
    const isSimpleFrontend = 
      requirements.projectType === 'frontend' &&
      !requirements.framework &&
      !requirements.typescript;
    
    return (isSimpleBackend || isSimpleFrontend) && !hasComplexRequirements;
  }

  /**
   * Generate a simple plan without using GenericPlanner
   * @param {Object} requirements - Project requirements
   * @returns {Object} Simple plan structure
   */
  static generateSimplePlan(requirements) {
    const timestamp = Date.now();
    
    if (requirements.projectType === 'backend' || requirements.backend) {
      return {
        task: requirements.description || 'Backend project',
        projectType: 'backend',
        components: {
          backend: {
            features: ['server', 'api'],
            technologies: ['nodejs', 'express']
          }
        },
        complexity: 'low',
        suggestedArchitecture: {
          pattern: 'simple',
          structure: {
            backend: ['server.js', 'package.json']
          }
        },
        directoryStructure: {
          directories: [],
          files: ['server.js', 'package.json', 'README.md'],
          descriptions: {
            'server.js': 'Main server file',
            'package.json': 'Node.js dependencies',
            'README.md': 'Project documentation'
          }
        },
        dependencies: {
          creationOrder: ['package.json', 'server.js', 'README.md'],
          dependencies: {},
          conflicts: []
        },
        testStrategy: {
          testTypes: {
            unit: { enabled: true, coverage: 80 }
          },
          coverageTargets: { overall: 80 },
          testEnvironment: { framework: 'jest' }
        },
        metadata: {
          planner: 'SimplePlanningMode',
          plannedAt: timestamp,
          mode: 'simple'
        }
      };
    }
    
    // Frontend simple plan
    return {
      task: requirements.description || 'Frontend project',
      projectType: 'frontend',
      components: {
        frontend: {
          features: ['html', 'form', 'display'],
          technologies: ['html', 'javascript', 'css']
        }
      },
      complexity: 'low',
      suggestedArchitecture: {
        pattern: 'simple',
        structure: {
          frontend: ['index.html', 'style.css', 'script.js']
        }
      },
      directoryStructure: {
        directories: [],
        files: ['index.html', 'style.css', 'script.js'],
        descriptions: {
          'index.html': 'Main HTML file',
          'style.css': 'Styles',
          'script.js': 'JavaScript logic'
        }
      },
      dependencies: {
        creationOrder: ['index.html', 'style.css', 'script.js'],
        dependencies: {},
        conflicts: []
      },
      testStrategy: {
        testTypes: {
          unit: { enabled: true, coverage: 80 }
        },
        coverageTargets: { overall: 80 },
        testEnvironment: { framework: 'jest' }
      },
      metadata: {
        planner: 'SimplePlanningMode',
        plannedAt: timestamp,
        mode: 'simple'
      }
    };
  }
}

export { SimplePlanningMode };
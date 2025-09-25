/**
 * ProjectManagerStrategy - Top-level coordinator for software projects
 * 
 * This is the ONLY strategy that owns a DataStore. All child strategies
 * receive proxies that provide focused access to the data they need.
 * 
 * Responsibilities:
 * - Create and own the DataStore with deliverables schema
 * - Analyze tasks to determine appropriate child strategies
 * - Create proxies for child strategies based on their needs
 * - Orchestrate the overall project lifecycle
 */

import { createTypedStrategy } from './utils/StandardTaskStrategy.js';
import { DataStore } from '@legion/data-proxies';
import { EntityProxy, CollectionProxy } from '@legion/data-proxies';
import { deliverablesSchema, validateEntityData } from '../data/deliverables-schema.js';

export const createProjectManagerStrategy = createTypedStrategy(
  'project-manager',
  [], // No required tools - delegates everything to child strategies
  {}  // No prompts needed - uses analysis to route
);

/**
 * Main execution method - creates DataStore and delegates to child strategies
 */
createProjectManagerStrategy.doWork = async function() {
  console.log('🎯 ProjectManager: Initializing project data model');
  
  // ONLY ProjectManagerStrategy creates and owns the DataStore
  this.dataStore = new DataStore(deliverablesSchema);
  
  console.log('📊 DataStore created with deliverables schema');
  
  try {
    // Create the root project entity
    const projectData = this.dataStore.createEntity({
      'project/name': this.extractProjectName(this.description),
      'project/description': this.description,
      'project/type': this.detectProjectType(this.description),
      'project/status': 'planning',
      'project/created': new Date(),
      'project/rootPath': this.generateProjectPath()
    });
    
    const projectId = projectData.entityId;
    this.projectId = projectId; // Store for later use
    
    console.log(`📋 Created project entity: ${projectId}`);
    console.log(`   Type: ${projectData['project/type']}`);
    console.log(`   Name: ${projectData['project/name']}`);
    
    // Analyze the task to determine which strategy to use
    const strategyType = this.determineStrategy(this.description);
    console.log(`🔄 Delegating to: ${strategyType}`);
    
    // Create specialized proxies for the child strategy
    const proxies = this.createProxiesForStrategy(strategyType, projectId);
    
    // Create child task with PROXIES, not the DataStore
    const childTask = this.createChildTask({
      description: this.description,
      strategy: strategyType,
      context: {
        ...this.context,
        // Child strategies get proxies, not the DataStore
        project: proxies.project,        // EntityProxy for the project
        files: proxies.files,            // CollectionProxy for files (if applicable)
        tests: proxies.tests,            // CollectionProxy for tests (if applicable)
        requirements: proxies.requirements, // CollectionProxy for requirements (if applicable)
        errors: proxies.errors,          // CollectionProxy for errors (if applicable)
        projectId: projectId             // ID for creating new relationships
      }
    });
    
    // Update project status
    proxies.project['project/status'] = 'in_progress';
    
    // Delegate to the appropriate coding strategy
    const result = await this.delegateToChild(childTask);
    
    // Update final project status based on child result
    if (result?.success) {
      proxies.project['project/status'] = 'completed';
      proxies.project['project/completed'] = new Date();
      console.log('✅ Project completed successfully');
    } else {
      proxies.project['project/status'] = 'failed';
      console.log('❌ Project failed');
    }
    
    // Complete with project summary
    this.complete({
      success: result?.success || false,
      projectId: projectId,
      projectType: projectData['project/type'],
      strategy: strategyType,
      message: result?.message || 'Project processing complete',
      // Include summary data from DataStore
      summary: await this.generateProjectSummary(projectId)
    });
    
  } catch (error) {
    console.error('💥 ProjectManager error:', error.message);
    
    // Mark project as failed if it exists
    if (this.projectId) {
      try {
        const projectProxy = new EntityProxy(this.dataStore, this.projectId);
        projectProxy['project/status'] = 'failed';
      } catch (updateError) {
        console.error('Failed to update project status:', updateError.message);
      }
    }
    
    this.complete({
      success: false,
      error: error.message,
      message: 'Project manager failed during execution'
    });
  }
};

/**
 * Determine which strategy should handle this task
 */
createProjectManagerStrategy.determineStrategy = function(description) {
  const desc = description.toLowerCase();
  
  // Node.js server patterns
  if (desc.includes('server') || desc.includes('api') || desc.includes('express') || 
      desc.includes('rest') || desc.includes('endpoint')) {
    return 'SimpleNodeServerStrategy';
  }
  
  // Testing patterns
  if (desc.includes('test') || desc.includes('jest') || desc.includes('spec') ||
      desc.includes('unit test') || desc.includes('testing')) {
    return 'SimpleNodeTestStrategy';
  }
  
  // Documentation patterns
  if (desc.includes('readme') || desc.includes('documentation') || desc.includes('docs') ||
      desc.includes('guide') || desc.includes('api doc')) {
    return 'DocumentationStrategy';
  }
  
  // Error/debugging patterns
  if (desc.includes('fix') || desc.includes('error') || desc.includes('debug') ||
      desc.includes('troubleshoot') || desc.includes('issue')) {
    return 'MonitoringStrategy';
  }
  
  // Analysis patterns
  if (desc.includes('analyze') || desc.includes('review') || desc.includes('audit') ||
      desc.includes('examine') || desc.includes('inspect')) {
    return 'AnalysisStrategy';
  }
  
  // Default to server strategy for most development tasks
  return 'SimpleNodeServerStrategy';
};

/**
 * Create specialized proxies for different strategy types
 */
createProjectManagerStrategy.createProxiesForStrategy = function(strategyType, projectId) {
  const proxies = {
    project: new EntityProxy(this.dataStore, projectId)
  };
  
  // Different strategies get different collection proxies based on their needs
  switch(strategyType) {
    case 'SimpleNodeServerStrategy':
      // Server strategy needs files and requirements
      proxies.files = new CollectionProxy(this.dataStore, {
        find: ['?file', '?path', '?content'],
        where: [
          ['?file', 'file/project', projectId],
          ['?file', 'file/path', '?path'],
          ['?file', 'file/content', '?content']
        ]
      });
      
      proxies.requirements = new CollectionProxy(this.dataStore, {
        find: ['?req', '?desc'],
        where: [
          ['?req', 'requirement/project', projectId],
          ['?req', 'requirement/description', '?desc']
        ]
      });
      break;
      
    case 'SimpleNodeTestStrategy':
      // Test strategy needs tests, test files, and source files to test
      proxies.tests = new CollectionProxy(this.dataStore, {
        find: ['?test', '?name', '?status'],
        where: [
          ['?test', 'test/project', projectId],
          ['?test', 'test/name', '?name'],
          ['?test', 'test/status', '?status']
        ]
      });
      
      proxies.testFiles = new CollectionProxy(this.dataStore, {
        find: ['?file', '?path'],
        where: [
          ['?file', 'file/project', projectId],
          ['?file', 'file/type', 'test'],
          ['?file', 'file/path', '?path']
        ]
      });
      
      proxies.sourceFiles = new CollectionProxy(this.dataStore, {
        find: ['?file', '?path'],
        where: [
          ['?file', 'file/project', projectId],
          ['?file', 'file/type', 'source'],
          ['?file', 'file/path', '?path']
        ]
      });
      break;
      
    case 'MonitoringStrategy':
      // Monitoring strategy needs errors and files with issues
      proxies.errors = new CollectionProxy(this.dataStore, {
        find: ['?error', '?message', '?resolved'],
        where: [
          ['?error', 'error/project', projectId],
          ['?error', 'error/message', '?message'],
          ['?error', 'error/resolved', '?resolved']
        ]
      });
      
      proxies.files = new CollectionProxy(this.dataStore, {
        find: ['?file', '?path'],
        where: [
          ['?file', 'file/project', projectId],
          ['?file', 'file/path', '?path']
        ]
      });
      break;
      
    case 'AnalysisStrategy':
      // Analysis strategy gets read-only access to everything
      proxies.files = new CollectionProxy(this.dataStore, {
        find: ['?file', '?path', '?type'],
        where: [
          ['?file', 'file/project', projectId],
          ['?file', 'file/path', '?path'],
          ['?file', 'file/type', '?type']
        ]
      });
      
      proxies.requirements = new CollectionProxy(this.dataStore, {
        find: ['?req', '?desc', '?status'],
        where: [
          ['?req', 'requirement/project', projectId],
          ['?req', 'requirement/description', '?desc'],
          ['?req', 'requirement/status', '?status']
        ]
      });
      
      proxies.dependencies = new CollectionProxy(this.dataStore, {
        find: ['?dep', '?name', '?version'],
        where: [
          ['?dep', 'dependency/project', projectId],
          ['?dep', 'dependency/name', '?name'],
          ['?dep', 'dependency/version', '?version']
        ]
      });
      break;
      
    default:
      // Default proxies for unknown strategies
      proxies.files = new CollectionProxy(this.dataStore, {
        find: ['?file', '?path'],
        where: [
          ['?file', 'file/project', projectId],
          ['?file', 'file/path', '?path']
        ]
      });
  }
  
  return proxies;
};

/**
 * Generate a summary of the project from DataStore
 */
createProjectManagerStrategy.generateProjectSummary = async function(projectId) {
  try {
    const files = this.dataStore.query({
      find: ['?file', '?type'],
      where: [
        ['?file', 'file/project', projectId],
        ['?file', 'file/type', '?type']
      ]
    });
    
    const tests = this.dataStore.query({
      find: ['?test', '?status'],
      where: [
        ['?test', 'test/project', projectId],
        ['?test', 'test/status', '?status']
      ]
    });
    
    const errors = this.dataStore.query({
      find: ['?error', '?resolved'],
      where: [
        ['?error', 'error/project', projectId],
        ['?error', 'error/resolved', '?resolved']
      ]
    });
    
    return {
      files: {
        total: files.length,
        byType: files.reduce((acc, [, type]) => {
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {})
      },
      tests: {
        total: tests.length,
        byStatus: tests.reduce((acc, [, status]) => {
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {})
      },
      errors: {
        total: errors.length,
        resolved: errors.filter(([, resolved]) => resolved).length,
        unresolved: errors.filter(([, resolved]) => !resolved).length
      }
    };
  } catch (error) {
    console.warn('Failed to generate project summary:', error.message);
    return { error: 'Summary generation failed' };
  }
};

// Helper methods
createProjectManagerStrategy.extractProjectName = function(description) {
  // Extract a reasonable project name from the description
  const words = description.toLowerCase().split(' ');
  const keyWords = words.filter(word => 
    word.length > 3 && 
    !['create', 'build', 'make', 'develop', 'implement', 'write', 'generate'].includes(word)
  );
  
  return keyWords.slice(0, 3).join('-') || 'project-' + Date.now();
};

createProjectManagerStrategy.detectProjectType = function(description) {
  const desc = description.toLowerCase();
  
  if (desc.includes('api') || desc.includes('rest') || desc.includes('server')) {
    return 'api';
  } else if (desc.includes('webapp') || desc.includes('web app') || desc.includes('frontend')) {
    return 'webapp';  
  } else if (desc.includes('cli') || desc.includes('command line')) {
    return 'cli';
  } else if (desc.includes('library') || desc.includes('package') || desc.includes('module')) {
    return 'library';
  } else if (desc.includes('service') || desc.includes('microservice')) {
    return 'service';
  } else if (desc.includes('fullstack') || desc.includes('full stack')) {
    return 'fullstack';
  }
  
  return 'api'; // Default
};

createProjectManagerStrategy.generateProjectPath = function() {
  const timestamp = Date.now();
  return `/tmp/roma-projects/${timestamp}`;
};
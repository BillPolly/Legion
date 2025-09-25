/**
 * SimpleNodeServerStrategy - Strategy for creating simple Node.js server applications
 * Uses StandardTaskStrategy to eliminate all boilerplate
 */

import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';
import path from 'path';

/**
 * Create the strategy using the ultimate abstraction
 * ALL factory and initialization boilerplate is eliminated!
 */
export const createSimpleNodeServerStrategy = createTypedStrategy(
  'simple-node-server',                                  // Strategy type for prompt path resolution
  ['file_write', 'directory_create'],                    // Required tools (loaded at construction)
  {                                                      // Prompt names (schemas come from YAML frontmatter)
    analyzeRequirements: 'analyzeRequirements',
    generateCode: 'generateCode', 
    generatePackageJson: 'generatePackageJson'
  },
  {
    projectRoot: '/tmp/roma-projects'                    // Additional config
  }
);

// Export default for backward compatibility
export default createSimpleNodeServerStrategy;

/**
 * Core strategy implementation - Updated to use DataStore proxies
 * Now uses proxies from context when available, with fallback to old artifact system
 */
createSimpleNodeServerStrategy.doWork = async function doWork() {
  console.log(`🚀 Generating Node.js server for: ${this.description}`);
  
  // Get PROXIES from context (provided by ProjectManagerStrategy)
  const project = this.context?.project;  // EntityProxy for project
  const files = this.context?.files;      // CollectionProxy for files
  const requirements = this.context?.requirements; // CollectionProxy for requirements
  const projectId = this.context?.projectId;
  
  const usingProxies = !!(project && files && projectId);
  console.log(usingProxies ? '📊 Using DataStore proxies' : '📦 Using legacy artifacts');
  
  // Analyze requirements using declarative prompt (schema in YAML frontmatter)
  const requirementsPrompt = this.getPrompt('analyzeRequirements');
  const requirementsResult = await requirementsPrompt.execute({ 
    description: this.description,
    context: usingProxies ? this.getDataStoreContext() : this.getAllArtifacts()
  });
  
  if (!requirementsResult.success) {
    return this.failWithError(
      new Error(`Failed to analyze requirements: ${requirementsResult.errors?.join(', ')}`),
      'Requirements analysis step failed'
    );
  }
  
  const serverRequirements = requirementsResult.data;
  this.addConversationEntry('system', `Server type: ${serverRequirements.serverType}, Endpoints: ${serverRequirements.endpoints.length}`);
  
  // Store requirements in DataStore if using proxies
  if (usingProxies && serverRequirements.functionalRequirements) {
    try {
      // Use ResourceManager to create requirement entities (not CollectionProxy.add())
      const resourceManager = project.resourceManager; // EntityProxy exposes its ResourceManager
      
      serverRequirements.functionalRequirements.forEach(req => {
        resourceManager.update(null, { // null = create new entity
          ':requirement/description': req.description,
          ':requirement/type': 'functional',
          ':requirement/priority': req.priority || 'medium',
          ':requirement/status': 'pending',
          ':requirement/project': projectId,
          ':requirement/acceptanceCriteria': req.acceptanceCriteria || []
        });
      });
      console.log(`📋 Stored ${serverRequirements.functionalRequirements.length} requirements in DataStore`);
    } catch (error) {
      console.warn('Failed to store requirements:', error.message);
    }
  }
  
  // Generate server code using declarative prompt
  const codePrompt = this.getPrompt('generateCode');
  const codeResult = await codePrompt.execute({
    serverType: serverRequirements.serverType,
    endpoints: serverRequirements.endpoints,
    middleware: serverRequirements.middleware || [],
    features: serverRequirements.features || []
  });
  
  if (!codeResult.success) {
    return this.failWithError(
      new Error(`Failed to generate server code: ${codeResult.errors?.join(', ')}`),
      'Server code generation failed'
    );
  }
  
  const serverCode = codeResult.data;
  
  // Generate package.json using declarative prompt
  const packagePrompt = this.getPrompt('generatePackageJson');
  const packageResult = await packagePrompt.execute({
    serverType: serverRequirements.serverType,
    dependencies: serverCode.dependencies || ['express'],
    projectName: serverRequirements.projectName || 'node-server'
  });
  
  if (!packageResult.success) {
    return this.failWithError(
      new Error(`Failed to generate package.json: ${packageResult.errors?.join(', ')}`),
      'Package.json generation failed'
    );
  }
  
  const packageJson = packageResult.data;
  
  // Store files using proxies or artifacts system
  if (usingProxies && files) {
    // NEW WAY: Use DataStore proxies
    try {
      // Update project status using EntityProxy.set() method
      project.set(':project/status', 'in_progress');
      
      // Use ResourceManager to create file entities (not CollectionProxy.add())
      const resourceManager = project.resourceManager; // EntityProxy exposes its ResourceManager
      
      // Create server.js file
      const serverFileResult = resourceManager.update(null, { // null = create new entity
        ':file/path': 'server.js',
        ':file/content': serverCode.code,
        ':file/type': 'source',
        ':file/language': 'javascript',
        ':file/project': projectId,
        ':file/created': new Date(),
        ':file/modified': new Date(),
        ':file/size': serverCode.code.length,
        ':file/lineCount': serverCode.code.split('\n').length
      });
      
      // Create package.json file
      const packageContent = JSON.stringify(packageJson, null, 2);
      const packageFileResult = resourceManager.update(null, { // null = create new entity
        ':file/path': 'package.json',
        ':file/content': packageContent,
        ':file/type': 'config',
        ':file/language': 'json',
        ':file/project': projectId,
        ':file/created': new Date(),
        ':file/modified': new Date(),
        ':file/size': packageContent.length,
        ':file/lineCount': packageContent.split('\n').length
      });
      
      // Query current files to show progress using CollectionProxy
      const currentFiles = files.toArray();
      console.log(`📊 Project now has ${currentFiles.length} files in DataStore`);
      
      // Complete with DataStore-based result
      this.complete({
        success: true,
        message: `Created ${serverRequirements.serverType} server with ${serverRequirements.endpoints.length} endpoints`,
        projectId: projectId,
        serverType: serverRequirements.serverType,
        endpoints: serverRequirements.endpoints,
        filesCreated: ['server.js', 'package.json'],
        dataStoreFiles: currentFiles.length,
        serverFileId: serverFileResult.entityId,
        packageFileId: packageFileResult.entityId
      });
      
    } catch (error) {
      console.error('DataStore operation failed:', error.message);
      // Fall back to artifact system
      this.completeWithLegacyArtifacts(serverRequirements, serverCode, packageJson);
    }
  } else {
    // OLD WAY: Use legacy artifact system during migration
    this.completeWithLegacyArtifacts(serverRequirements, serverCode, packageJson);
  }
};

/**
 * Get context information from DataStore for prompts
 */
createSimpleNodeServerStrategy.getDataStoreContext = function() {
  const files = this.context?.files;
  const requirements = this.context?.requirements;
  
  try {
    // Use CollectionProxy.toArray() to get current data (synchronous)
    const existingFiles = files ? files.toArray() : [];
    const existingRequirements = requirements ? requirements.toArray() : [];
    
    // CollectionProxy returns arrays of binding results, format depends on query
    // The query is defined in ProjectManagerStrategy.createProxiesForStrategy
    return {
      existingFiles: existingFiles.map(([fileId, path, content]) => ({ 
        id: fileId, 
        path, 
        content: content ? content.substring(0, 200) + '...' : ''
      })),
      existingRequirements: existingRequirements.map(([reqId, desc]) => ({ 
        id: reqId, 
        description: desc 
      })),
      fileCount: existingFiles.length,
      requirementCount: existingRequirements.length
    };
  } catch (error) {
    console.warn('Failed to get DataStore context:', error.message);
    return {
      existingFiles: [],
      existingRequirements: [],
      fileCount: 0,
      requirementCount: 0
    };
  }
};

/**
 * Fallback to legacy artifact system during migration
 */
createSimpleNodeServerStrategy.completeWithLegacyArtifacts = async function(requirements, serverCode, packageJson) {
  console.log('📦 Using legacy artifact system');
  
  // Setup project directory (legacy way)
  const projectDir = await setupProject(this.config);
  
  // Write files to filesystem (legacy way)
  const serverPath = path.join(projectDir, 'server.js');
  await this.config.tools.file_write.execute({ 
    filepath: serverPath, 
    content: serverCode.code 
  });
  
  await this.config.tools.file_write.execute({ 
    filepath: path.join(projectDir, 'package.json'), 
    content: JSON.stringify(packageJson, null, 2) 
  });
  
  // Complete with artifacts using built-in helper
  const artifacts = {
    'server.js': {
      value: serverCode.code,
      description: `${requirements.serverType} server with ${requirements.endpoints.length} endpoints`,
      type: 'file'
    },
    'package.json': {
      value: JSON.stringify(packageJson, null, 2),
      description: 'Package configuration with dependencies',
      type: 'file'
    }
  };
  
  this.completeWithArtifacts(artifacts, {
    success: true,
    message: `Created ${requirements.serverType} server with ${requirements.endpoints.length} endpoints`,
    projectDir: projectDir,
    serverType: requirements.serverType,
    endpoints: requirements.endpoints
  });
};

// ============================================================================
// Helper functions - now much simpler since all boilerplate is handled
// ============================================================================

async function setupProject(config) {
  const timestamp = Date.now();
  const projectDirName = `node-server-${timestamp}`;
  const projectDir = path.join(config.projectRoot, projectDirName);
  
  await config.tools.directory_create.execute({ path: projectDir });
  
  return projectDir;
}
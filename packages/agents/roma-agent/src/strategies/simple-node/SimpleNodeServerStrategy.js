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
 * Core strategy implementation - the ONLY thing we need to implement!
 * All boilerplate (error handling, message routing, tool loading, etc.) is handled automatically
 */
createSimpleNodeServerStrategy.doWork = async function doWork() {
  console.log(`🚀 Generating Node.js server for: ${this.description}`);
  
  // Analyze requirements using declarative prompt (schema in YAML frontmatter)
  const requirementsPrompt = this.getPrompt('analyzeRequirements');
  const requirementsResult = await requirementsPrompt.execute({ 
    description: this.description,
    context: this.getAllArtifacts()
  });
  
  if (!requirementsResult.success) {
    return this.failWithError(
      new Error(`Failed to analyze requirements: ${requirementsResult.errors?.join(', ')}`),
      'Requirements analysis step failed'
    );
  }
  
  const requirements = requirementsResult.data;
  this.addConversationEntry('system', `Server type: ${requirements.serverType}, Endpoints: ${requirements.endpoints.length}`);
  
  // Generate server code using declarative prompt
  const codePrompt = this.getPrompt('generateCode');
  const codeResult = await codePrompt.execute({
    serverType: requirements.serverType,
    endpoints: requirements.endpoints,
    middleware: requirements.middleware || [],
    features: requirements.features || []
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
    serverType: requirements.serverType,
    dependencies: serverCode.dependencies || ['express'],
    projectName: requirements.projectName || 'node-server'
  });
  
  if (!packageResult.success) {
    return this.failWithError(
      new Error(`Failed to generate package.json: ${packageResult.errors?.join(', ')}`),
      'Package.json generation failed'
    );
  }
  
  const packageJson = packageResult.data;
  
  // Setup project directory
  const projectDir = await setupProject(this.config);
  
  // Write server file
  const serverPath = path.join(projectDir, 'server.js');
  await this.config.tools.file_write.execute({ 
    filepath: serverPath, 
    content: serverCode.code 
  });
  
  // Write package.json
  await this.config.tools.file_write.execute({ 
    filepath: path.join(projectDir, 'package.json'), 
    content: JSON.stringify(packageJson, null, 2) 
  });
  
  // Complete with artifacts using built-in helper (handles parent notification automatically)
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
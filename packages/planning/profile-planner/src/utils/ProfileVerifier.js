/**
 * ProfileVerifier - Verifies profiles by loading actual modules and extracting tool signatures
 * 
 * This ensures that profiles reference real, available tools with accurate signatures
 * for both planning and execution.
 */

import { ResourceManager, ModuleFactory } from '@legion/tool-system';
import { promises as fs } from 'fs';
import path from 'path';

export class ProfileVerifier {
  constructor() {
    this.resourceManager = null;
    this.moduleFactory = null;
  }

  async initialize() {
    // Initialize ResourceManager to load environment and resources
    this.resourceManager = new ResourceManager();
    await this.resourceManager.initialize();
    
    // Create ModuleFactory for loading modules
    this.moduleFactory = new ModuleFactory(this.resourceManager);
  }

  /**
   * Verify a profile by loading its modules and extracting tool signatures
   * @param {string} profilePath - Path to the profile JSON file
   * @returns {Object} The verified profile with tool signatures
   */
  async verifyProfile(profilePath) {
    console.log(`\nVerifying profile: ${profilePath}`);
    
    // Load the profile
    const profileContent = await fs.readFile(profilePath, 'utf8');
    const profile = JSON.parse(profileContent);
    
    if (profile.verified) {
      console.log('Profile already verified at:', profile.verifiedAt);
      return profile;
    }

    console.log(`Profile: ${profile.name} - ${profile.description}`);
    console.log(`Required modules: ${profile.requiredModules.length}`);
    
    // Initialize tool signatures object
    profile.toolSignatures = {};
    
    // Load each required module
    for (const moduleConfig of profile.requiredModules) {
      console.log(`\nLoading module: ${moduleConfig.name}`);
      
      try {
        // Import the module dynamically
        const modulePath = path.join(
          process.cwd(),
          'packages',
          moduleConfig.package.replace('@legion/', ''),
          moduleConfig.path
        );
        
        console.log(`Module path: ${modulePath}`);
        const { default: ModuleClass } = await import(modulePath);
        
        // Create module/tool instance
        const module = this.moduleFactory.createModule(ModuleClass);
        
        // Check if it's a Module (has getTools) or a Tool directly
        let tools = [];
        if (typeof module.getTools === 'function') {
          // It's a Module with getTools
          console.log(`Module loaded: ${module.name}`);
          tools = module.getTools();
          console.log(`Found ${tools.length} tools in module`);
        } else if (module.name && (module.invoke || module.execute)) {
          // It's a Tool directly
          console.log(`Tool loaded directly: ${module.name}`);
          tools = [module];
        } else {
          throw new Error(`${moduleConfig.name} is neither a Module nor a Tool`);
        }
        
        // Extract tool signatures
        for (const tool of tools) {
          console.log(`\nProcessing tool: ${tool.name}`);
          
          // For multi-function tools like FileOperationsTool
          if (tool.getAllToolDescriptions) {
            const descriptions = tool.getAllToolDescriptions();
            profile.toolSignatures[tool.name] = {
              type: 'multi-function',
              functions: {}
            };
            
            for (const desc of descriptions) {
              const funcName = desc.function.name;
              console.log(`  - Function: ${funcName}`);
              profile.toolSignatures[tool.name].functions[funcName] = desc.function;
            }
          }
          // For single-function tools like CommandExecutor
          else if (tool.getToolDescription) {
            const desc = tool.getToolDescription();
            console.log(`  - Single function tool`);
            profile.toolSignatures[tool.name] = {
              type: 'single-function',
              description: desc.function
            };
          }
          // Fallback for tools without description methods
          else {
            console.log(`  - Basic tool (no descriptions available)`);
            profile.toolSignatures[tool.name] = {
              type: 'basic',
              name: tool.name,
              description: tool.description || 'No description available'
            };
          }
        }
        
      } catch (error) {
        console.error(`Failed to load module ${moduleConfig.name}:`, error.message);
        throw error;
      }
    }
    
    // Verify that all referenced tools exist
    console.log('\nVerifying tool references...');
    for (const toolRef of profile.tools) {
      const signature = profile.toolSignatures[toolRef.tool];
      if (!signature) {
        throw new Error(`Tool ${toolRef.tool} not found in module ${toolRef.module}`);
      }
      
      // For multi-function tools, verify all referenced functions exist
      if (signature.type === 'multi-function' && toolRef.functions) {
        for (const func of toolRef.functions) {
          if (!signature.functions[func]) {
            throw new Error(`Function ${func} not found in tool ${toolRef.tool}`);
          }
        }
      }
    }
    
    // Mark profile as verified
    profile.verified = true;
    profile.verifiedAt = new Date().toISOString();
    
    // Save the verified profile
    const verifiedPath = profilePath.replace('.json', '-verified.json');
    await fs.writeFile(verifiedPath, JSON.stringify(profile, null, 2));
    
    console.log(`\n✅ Profile verified successfully!`);
    console.log(`Verified profile saved to: ${verifiedPath}`);
    console.log(`Total tool signatures: ${Object.keys(profile.toolSignatures).length}`);
    
    return profile;
  }

  /**
   * Generate a summary of available tools from a verified profile
   */
  generateToolSummary(profile) {
    const summary = [];
    
    for (const [toolName, signature] of Object.entries(profile.toolSignatures)) {
      if (signature.type === 'multi-function') {
        for (const [funcName, funcDesc] of Object.entries(signature.functions)) {
          summary.push({
            tool: toolName,
            function: funcName,
            description: funcDesc.description,
            parameters: funcDesc.parameters
          });
        }
      } else if (signature.type === 'single-function') {
        summary.push({
          tool: toolName,
          function: 'execute',
          description: signature.description.description,
          parameters: signature.description.parameters
        });
      }
    }
    
    return summary;
  }
}
/**
 * AnalysisStrategy - Requirements analysis strategy
 * Now uses LLM for ALL natural language understanding instead of poor keyword matching
 * Uses StandardTaskStrategy to eliminate all boilerplate
 */

import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';

/**
 * Create the strategy using the ultimate abstraction
 * ALL factory and initialization boilerplate is eliminated!
 */
export const createAnalysisStrategy = createTypedStrategy(
  'coding-analysis',                                     // Strategy type for prompt path resolution
  ['file_write', 'directory_create'],                    // Required tools (loaded at construction)
  {                                                      // Prompt names (schemas come from YAML frontmatter)
    understandRequirements: 'understand-requirements',   // Extract project type & features
    identifyComponents: 'identify-components',           // Determine system components
    analyzeDependencies: 'analyze-dependencies'          // Identify packages & integrations
  },
  {                                                      // Additional config
    analysisDepth: 'comprehensive',
    includeArchitecture: true,
    generateDocs: true
  }
);

// Export default for backward compatibility
export default createAnalysisStrategy;

/**
 * Core strategy implementation - the ONLY thing we need to implement!
 * All boilerplate (error handling, message routing, tool loading, etc.) is handled automatically
 * 
 * NOW: No more terrible keyword matching! LLM understands the actual meaning
 */
createAnalysisStrategy.doWork = async function doWork() {
  console.log(`📋 AnalysisStrategy analyzing: ${this.description}`);
  
  // Step 1: Use LLM to UNDERSTAND requirements (not keyword match!)
  console.log('  → Understanding requirements with LLM...');
  const understandPrompt = this.getPrompt('understandRequirements');
  const understandResult = await understandPrompt.execute({
    taskDescription: this.description
  });
  
  if (!understandResult.success) {
    return this.failWithError(
      new Error(`Failed to understand requirements: ${understandResult.errors?.join(', ')}`),
      'Requirements understanding failed'
    );
  }
  
  const { projectType, features, constraints } = understandResult.data;
  this.addConversationEntry('system', `Identified ${projectType} project with ${features.length} features`);
  
  // Step 2: Use LLM to identify components based on UNDERSTANDING
  console.log('  → Identifying system components...');
  const componentsPrompt = this.getPrompt('identifyComponents');
  const componentsResult = await componentsPrompt.execute({
    projectType: projectType,
    features: features
  });
  
  if (!componentsResult.success) {
    return this.failWithError(
      new Error(`Failed to identify components: ${componentsResult.errors?.join(', ')}`),
      'Component identification failed'
    );
  }
  
  const { components, architecture } = componentsResult.data;
  this.addConversationEntry('system', `Identified ${components.length} components with ${architecture.pattern} architecture`);
  
  // Step 3: Use LLM to analyze dependencies based on ACTUAL NEEDS
  console.log('  → Analyzing dependencies...');
  const dependenciesPrompt = this.getPrompt('analyzeDependencies');
  const dependenciesResult = await dependenciesPrompt.execute({
    projectType: projectType,
    components: components,
    features: features
  });
  
  if (!dependenciesResult.success) {
    return this.failWithError(
      new Error(`Failed to analyze dependencies: ${dependenciesResult.errors?.join(', ')}`),
      'Dependencies analysis failed'
    );
  }
  
  const { dependencies, integrations, devDependencies } = dependenciesResult.data;
  this.addConversationEntry('system', `Identified ${dependencies.length} dependencies and ${integrations.length} integrations`);
  
  // Build comprehensive analysis result
  const analysis = {
    overview: generateAnalysisOverview({
      projectType,
      features,
      components,
      architecture,
      dependencies,
      integrations
    }),
    projectType: projectType,
    features: features,
    constraints: constraints,
    components: components,
    architecture: architecture,
    dependencies: dependencies,
    integrations: integrations,
    devDependencies: devDependencies
  };
  
  // Complete with artifacts using built-in helper (handles parent notification automatically)
  this.completeWithArtifacts({
    'requirements-analysis': {
      value: JSON.stringify(analysis, null, 2),
      description: 'Comprehensive requirements analysis with proper LLM understanding',
      type: 'json'
    },
    'project-summary': {
      value: analysis.overview,
      description: 'Human-readable project analysis summary',
      type: 'text'
    }
  }, {
    success: true,
    message: `Analysis complete for ${projectType} project`,
    projectType: projectType,
    featuresCount: features.length,
    componentsCount: components.length,
    dependenciesCount: dependencies.length,
    integrationsCount: integrations.length
  });
};

// ============================================================================
// ONLY SIMPLE HELPER - No more terrible keyword matching!
// ============================================================================

function generateAnalysisOverview(analysis) {
  const overview = [];
  
  overview.push(`# ${analysis.projectType.toUpperCase()} Project Analysis\n`);
  
  overview.push(`## Features (${analysis.features.length}):`);
  analysis.features.forEach(f => {
    overview.push(`- **${f.name}** (${f.priority}): ${f.description}`);
  });
  
  overview.push(`\n## Architecture: ${analysis.architecture.pattern}`);
  overview.push(`Layers: ${analysis.architecture.layers.join(', ')}`);
  
  overview.push(`\n## Components (${analysis.components.length}):`);
  analysis.components.forEach(c => {
    overview.push(`- **${c.name}** (${c.type}): ${c.purpose}${c.required ? ' [REQUIRED]' : ''}`);
  });
  
  overview.push(`\n## Dependencies (${analysis.dependencies.length}):`);
  const byCategory = {};
  analysis.dependencies.forEach(d => {
    if (!byCategory[d.category]) byCategory[d.category] = [];
    byCategory[d.category].push(`${d.name}: ${d.purpose}`);
  });
  Object.entries(byCategory).forEach(([cat, deps]) => {
    overview.push(`### ${cat}:`);
    deps.forEach(d => overview.push(`- ${d}`));
  });
  
  if (analysis.integrations.length > 0) {
    overview.push(`\n## External Integrations (${analysis.integrations.length}):`);
    analysis.integrations.forEach(i => {
      overview.push(`- **${i.service}**: ${i.purpose}${i.required ? ' [REQUIRED]' : ''}`);
    });
  }
  
  return overview.join('\n');
}
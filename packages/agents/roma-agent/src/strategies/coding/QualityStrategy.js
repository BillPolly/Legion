/**
 * QualityStrategy - Handles code quality assurance and validation
 * Uses StandardTaskStrategy to eliminate all boilerplate
 */

import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';

/**
 * Create the strategy using the ultimate abstraction
 * ALL factory and initialization boilerplate is eliminated!
 */
export const createQualityStrategy = createTypedStrategy(
  'coding-quality',                                      // Strategy type for prompt path resolution
  ['file_read', 'command_executor', 'file_write'],       // Required tools (loaded at construction)
  {                                                      // Prompt names (schemas come from YAML frontmatter)
    analyzeQuality: 'analyzeQuality',
    generateImprovements: 'generateImprovements',
    validateStandards: 'validateStandards',
    createQualityReport: 'createQualityReport'
  },
  {
    qualityThreshold: 80,                                // Additional config
    maxIssues: 20,
    checkTypes: ['syntax', 'style', 'security', 'performance']
  }
);

// Export default for backward compatibility
export default createQualityStrategy;

/**
 * Core strategy implementation - the ONLY thing we need to implement!
 * All boilerplate (error handling, message routing, tool loading, etc.) is handled automatically
 */
createQualityStrategy.doWork = async function doWork() {
  console.log(`🔍 QualityStrategy analyzing: ${this.description}`);
  
  // Get code artifacts to analyze
  const codeArtifacts = await getCodeArtifacts(this);
  if (codeArtifacts.length === 0) {
    return this.failWithError(new Error('No code artifacts found'), 'Cannot analyze quality without code');
  }
  
  this.addConversationEntry('system', `Analyzing quality of ${codeArtifacts.length} code artifacts`);
  
  // Analyze quality using declarative prompt (schema in YAML frontmatter)
  const qualityPrompt = this.getPrompt('analyzeQuality');
  const qualityResults = [];
  
  for (const artifact of codeArtifacts) {
    const analysisResult = await qualityPrompt.execute({
      code: artifact.value,
      filename: artifact.name,
      language: artifact.language || 'javascript',
      checkTypes: this.config.checkTypes
    });
    
    if (!analysisResult.success) {
      return this.failWithError(
        new Error(`Quality analysis failed for ${artifact.name}: ${analysisResult.errors?.join(', ')}`),
        `Code analysis failed`
      );
    }
    
    qualityResults.push({
      artifact: artifact.name,
      ...analysisResult.data
    });
  }
  
  // Calculate overall quality score
  const overallScore = calculateOverallScore(qualityResults);
  this.addConversationEntry('system', `Overall quality score: ${overallScore}%`);
  
  // Generate improvements if below threshold
  let improvements = null;
  if (overallScore < this.config.qualityThreshold) {
    const improvementsPrompt = this.getPrompt('generateImprovements');
    const improvementsResult = await improvementsPrompt.execute({
      qualityResults: qualityResults,
      threshold: this.config.qualityThreshold,
      currentScore: overallScore
    });
    
    if (improvementsResult.success) {
      improvements = improvementsResult.data;
      this.addConversationEntry('system', `Generated ${improvements.recommendations?.length || 0} improvement recommendations`);
    }
  }
  
  // Validate against standards
  const standardsPrompt = this.getPrompt('validateStandards');
  const standardsResult = await standardsPrompt.execute({
    qualityResults: qualityResults,
    projectType: this.description.includes('node') ? 'nodejs' : 'javascript',
    standards: ['eslint', 'prettier', 'security']
  });
  
  const standardsValidation = standardsResult.success ? standardsResult.data : { compliance: 'unknown' };
  
  // Create comprehensive quality report
  const reportPrompt = this.getPrompt('createQualityReport');
  const reportResult = await reportPrompt.execute({
    qualityResults: qualityResults,
    overallScore: overallScore,
    improvements: improvements,
    standardsValidation: standardsValidation,
    threshold: this.config.qualityThreshold
  });
  
  if (!reportResult.success) {
    return this.failWithError(
      new Error(`Failed to generate quality report: ${reportResult.errors?.join(', ')}`),
      'Quality report generation failed'
    );
  }
  
  const report = reportResult.data;
  
  // Complete with artifacts using built-in helper (handles parent notification automatically)
  const artifacts = {
    'quality-analysis': {
      value: JSON.stringify(qualityResults, null, 2),
      description: `Quality analysis of ${codeArtifacts.length} files`,
      type: 'json'
    },
    'quality-report': {
      value: report.content,
      description: `Quality report (score: ${overallScore}%)`,
      type: 'text'
    }
  };
  
  if (improvements) {
    artifacts['improvement-plan'] = {
      value: JSON.stringify(improvements, null, 2),
      description: 'Recommended improvements for code quality',
      type: 'json'
    };
  }
  
  artifacts['standards-compliance'] = {
    value: JSON.stringify(standardsValidation, null, 2),
    description: 'Standards compliance validation results',
    type: 'json'
  };
  
  this.completeWithArtifacts(artifacts, {
    success: true,
    message: `Quality analysis complete: ${overallScore}% score`,
    overallScore: overallScore,
    filesAnalyzed: codeArtifacts.length,
    issuesFound: qualityResults.reduce((sum, r) => sum + (r.issues?.length || 0), 0),
    passesThreshold: overallScore >= this.config.qualityThreshold,
    hasImprovements: !!improvements
  });
};

// ============================================================================
// Helper functions - now much simpler since all boilerplate is handled
// ============================================================================

async function getCodeArtifacts(task) {
  const artifacts = task.getAllArtifacts();
  const codeArtifacts = [];
  
  for (const artifact of Object.values(artifacts)) {
    if (artifact.type === 'file' || artifact.name.match(/\.(js|ts|json|md)$/)) {
      codeArtifacts.push({
        name: artifact.name,
        value: artifact.value,
        language: detectLanguage(artifact.name)
      });
    }
  }
  
  return codeArtifacts;
}

function detectLanguage(filename) {
  if (filename.endsWith('.js')) return 'javascript';
  if (filename.endsWith('.ts')) return 'typescript';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.md')) return 'markdown';
  return 'javascript'; // default
}

function calculateOverallScore(qualityResults) {
  if (qualityResults.length === 0) return 0;
  
  const totalScore = qualityResults.reduce((sum, result) => sum + (result.score || 0), 0);
  return Math.round(totalScore / qualityResults.length);
}
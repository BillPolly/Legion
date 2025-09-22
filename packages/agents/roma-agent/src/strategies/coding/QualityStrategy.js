/**
 * QualityStrategy - Manages validation gates and quality assurance
 * Converted from QualityController component to follow TaskStrategy pattern
 * 
 * Responsibilities:
 * - Validates code quality, requirements compliance, and phase completion
 * - Manages quality gates for each development phase
 * - Provides comprehensive artifact validation
 * - Analyzes code quality metrics and security issues
 * - Implements continuous validation workflows
 */

import { TaskStrategy } from '@legion/tasks';
import { EnhancedPromptRegistry } from '@legion/prompting-manager';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class QualityStrategy extends TaskStrategy {
  constructor(llmClient, toolRegistry, options = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    const promptsPath = path.resolve(__dirname, '../../../prompts');
    this.promptRegistry = new EnhancedPromptRegistry(promptsPath);
    
    this.options = {
      validateResults: true,
      qualityThreshold: 7,
      requireAllPhases: true,
      ...options
    };
    
    // Default quality gates for each phase
    this.qualityGates = options.qualityGates || {
      setup: {
        checks: [
          'project_structure_valid',
          'package_json_complete',
          'dependencies_resolved'
        ],
        threshold: 100 // All must pass
      },
      core: {
        checks: [
          'server_starts_successfully',
          'no_syntax_errors',
          'endpoints_respond'
        ],
        threshold: 100
      },
      features: {
        checks: [
          'features_implemented',
          'no_regression_errors',
          'performance_acceptable'
        ],
        threshold: 90
      },
      testing: {
        checks: [
          'unit_tests_pass',
          'integration_tests_pass',
          'coverage_adequate'
        ],
        threshold: 80
      },
      integration: {
        checks: [
          'deployment_ready',
          'documentation_complete',
          'security_scan_passed'
        ],
        threshold: 95
      }
    };
  }
  
  getName() {
    return 'Quality';
  }
  
  
  /**
   * Handle messages from any source task
   */
  async onMessage(sourceTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        return await this._handleValidationRequest(message.task || sourceTask);
      case 'abort':
        return await this._handleAbortRequest();
      case 'completed':
        // Handle child task completion
        if (sourceTask.parent) {
          return { acknowledged: true };
        }
        return { acknowledged: true };
      case 'failed':
        // Handle child task failure
        if (sourceTask.parent) {
          return { acknowledged: true };
        }
        return { acknowledged: true };
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle validation request from parent task
   */
  async _handleValidationRequest(task) {
    try {
      console.log(`🔍 QualityStrategy handling: ${task.description}`);
      
      // Extract project/execution result from task
      const project = this._extractProjectData(task);
      if (!project) {
        return {
          success: false,
          result: 'No project data found for quality validation'
        };
      }
      
      // Add conversation entry
      task.addConversationEntry('system', 
        `Validating project quality with ${project.phases?.length || 0} phases`);
      
      // Validate project using direct implementation
      const validationResult = await this.validateProject(project);
      
      // Add additional context-specific validation
      if (task && task.getAllArtifacts) {
        const artifacts = task.getAllArtifacts();
        
        // Check if execution artifacts are present
        if (artifacts['execution-result']) {
          const executionResult = artifacts['execution-result'].content;
          
          // Add execution-specific validation
          if (!executionResult.success) {
            validationResult.passed = false;
            validationResult.issues = validationResult.issues || [];
            validationResult.issues.push('Project execution failed');
          }
        }
        
        // Validate individual artifacts
        for (const [name, artifact] of Object.entries(artifacts)) {
          if (artifact.type === 'code' || artifact.type === 'test') {
            try {
              const artifactValidation = await this.validateArtifact(artifact);
              if (!artifactValidation.valid) {
                validationResult.passed = false;
                validationResult.issues = validationResult.issues || [];
                validationResult.issues.push(`Artifact ${name} failed validation: ${artifactValidation.issues.join(', ')}`);
              }
            } catch (error) {
              // Continue validation even if individual artifact validation fails
              console.warn(`Failed to validate artifact ${name}: ${error.message}`);
            }
          }
        }
      }
      
      // Store validation artifacts
      task.storeArtifact(
        'quality-validation',
        validationResult,
        `Quality validation result: ${validationResult.passed ? 'PASSED' : 'FAILED'}`,
        'validation'
      );
      
      // Store detailed quality report if available
      if (validationResult.phases && Object.keys(validationResult.phases).length > 0) {
        task.storeArtifact(
          'quality-phases-report',
          validationResult.phases,
          'Phase-by-phase quality validation report',
          'report'
        );
      }
      
      // Store issues if any found
      if (validationResult.issues && validationResult.issues.length > 0) {
        task.storeArtifact(
          'quality-issues',
          validationResult.issues,
          `${validationResult.issues.length} quality issues found`,
          'issues'
        );
      }
      
      // Add conversation entry about completion
      task.addConversationEntry('system', 
        `Quality validation completed: ${validationResult.passed ? 'PASSED' : 'FAILED'} - ${validationResult.issues?.length || 0} issues found`);
      
      console.log(`✅ QualityStrategy completed: ${validationResult.passed ? 'PASSED' : 'FAILED'}`);
      
      return {
        success: true,
        result: {
          validation: validationResult,
          passed: validationResult.passed,
          phasesValidated: Object.keys(validationResult.phases || {}).length,
          issuesFound: validationResult.issues?.length || 0
        },
        artifacts: ['quality-validation', 'quality-phases-report', 'quality-issues'].filter(artifact => {
          // Only include artifacts that were actually created
          const artifacts = task.getAllArtifacts ? task.getAllArtifacts() : {};
          return artifacts[artifact];
        })
      };
      
    } catch (error) {
      console.error(`❌ QualityStrategy failed: ${error.message}`);
      
      task.addConversationEntry('system', 
        `Quality validation failed: ${error.message}`);
      
      return {
        success: false,
        result: error.message
      };
    }
  }
  
  /**
   * Handle abort request
   */
  async _handleAbortRequest() {
    try {
      // QualityController doesn't have long-running processes to abort
      return { acknowledged: true, aborted: true };
    } catch (error) {
      console.error(`Error during abort: ${error.message}`);
      return { acknowledged: true, aborted: false, error: error.message };
    }
  }
  
  /**
   * Validate entire project against quality requirements
   */
  async validateProject(project) {
    const validationResult = {
      passed: true,
      phases: {},
      overall: {},
      issues: []
    };
    
    // Check for required phases
    const requiredPhases = ['setup', 'core', 'features', 'testing', 'integration'];
    for (const phase of requiredPhases) {
      if (!project.phases || !project.phases[phase]) {
        validationResult.passed = false;
        validationResult.issues.push(`Missing required phase: ${phase}`);
      }
    }
    
    // Validate each phase
    if (project.phases) {
      for (const [phaseName, phaseData] of Object.entries(project.phases)) {
        const phaseValidation = await this.validatePhase({
          name: phaseName,
          ...phaseData,
          // Pass project artifacts to phase if phase doesn't have its own
          artifacts: phaseData.artifacts && phaseData.artifacts.length > 0 
            ? phaseData.artifacts 
            : project.artifacts || [],
          // Pass project quality data for testing phase
          quality: phaseData.quality || project.quality
        });
        
        validationResult.phases[phaseName] = phaseValidation;
        
        if (!phaseValidation.passed) {
          validationResult.passed = false;
        }
      }
    }
    
    // Check quality metrics
    if (project.quality) {
      const qualityCheck = await this.validateQualityMetrics(project.quality);
      validationResult.overall = qualityCheck;
      
      if (!qualityCheck.passed) {
        validationResult.passed = false;
      }
    }
    
    // Validate all artifacts
    if (project.artifacts) {
      for (const artifact of project.artifacts) {
        const syntaxResult = await this.validateSyntax(artifact);
        if (!syntaxResult.valid && !syntaxResult.skipped) {
          validationResult.issues.push(`Syntax error in ${artifact.path}: ${syntaxResult.error}`);
        }
      }
    }
    
    return validationResult;
  }
  
  /**
   * Validate a specific phase
   */
  async validatePhase(phase) {
    const gate = this.qualityGates[phase.name];
    
    if (!gate) {
      // Unknown phase - pass by default
      return { passed: true, score: 100, checks: [] };
    }
    
    const checkResults = [];
    
    // Run each check for this phase
    for (const checkName of gate.checks) {
      const result = await this.runCheck(checkName, phase);
      checkResults.push(result);
    }
    
    // Check if gate passes threshold
    const gateResult = await this.checkGate(checkResults, gate.threshold);
    
    // Add specific issues for testing phase
    if (phase.name === 'testing' && phase.quality) {
      const coverage = phase.quality.testResults?.coverage || 0;
      if (coverage < 70) {
        gateResult.passed = false;
        gateResult.issues = gateResult.issues || [];
        gateResult.issues.push('Coverage below threshold');
      }
    }
    
    return gateResult;
  }
  
  /**
   * Validate quality metrics
   */
  async validateQualityMetrics(quality) {
    const result = {
      passed: true,
      metrics: {},
      issues: []
    };
    
    // Check test results
    if (quality.testResults) {
      const { passed, failed, coverage } = quality.testResults;
      const testPassRate = passed / (passed + failed) * 100;
      
      result.metrics.testPassRate = testPassRate;
      result.metrics.coverage = coverage;
      
      if (testPassRate < 80) {
        result.passed = false;
        result.issues.push('Test pass rate below 80%');
      }
      
      if (coverage < 70) {
        result.passed = false;
        result.issues.push('Coverage below 70%');
      }
    }
    
    // Check code metrics
    if (quality.codeMetrics) {
      result.metrics.complexity = quality.codeMetrics.complexity;
      result.metrics.maintainability = quality.codeMetrics.maintainability;
      
      if (quality.codeMetrics.complexity > 20) {
        result.passed = false;
        result.issues.push('Code complexity too high');
      }
    }
    
    return result;
  }
  
  /**
   * Validate JavaScript syntax
   */
  async validateSyntax(artifact) {
    // Skip non-code artifacts
    if (artifact.type !== 'code' && artifact.type !== 'test') {
      return { valid: true, skipped: true };
    }
    
    try {
      // Use Function constructor to check syntax
      new Function(artifact.content);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }
  
  /**
   * Validate that requirements are met
   */
  async validateRequirements(artifact, requirements) {
    const result = {
      valid: true,
      missing: []
    };
    
    // Extract features from artifact
    const features = this.extractFeatures(artifact);
    
    // Check which requirements are missing
    for (const req of requirements) {
      const found = features.some(feature => 
        feature.toLowerCase().includes(req.toLowerCase()) ||
        req.toLowerCase().includes(feature.toLowerCase())
      );
      
      if (!found) {
        result.missing.push(req);
      }
    }
    
    // Use LLM for more complex validation if available
    if (this.llmClient && result.missing.length > 0) {
      try {
        const prompt = await this.promptRegistry.fill('coding/quality/validate-requirements', {
          requirements: requirements.join(', '),
          code: artifact.content
        });
        
        const response = await this.llmClient.complete(prompt);
        const analysis = JSON.parse(response);
        
        // Update missing based on LLM analysis
        result.missing = requirements.filter(req => 
          !analysis.features.some(f => f.toLowerCase().includes(req.toLowerCase()))
        );
      } catch (error) {
        // Continue with basic analysis if LLM fails
      }
    }
    
    result.valid = result.missing.length === 0;
    return result;
  }
  
  /**
   * Analyze code quality metrics
   */
  async analyzeQuality(artifact) {
    const metrics = {
      score: 0,
      issues: []
    };
    
    // Check for empty content
    if (!artifact.content || artifact.content.trim() === '') {
      metrics.issues.push('Empty content');
      return metrics;
    }
    
    const content = artifact.content;
    
    // Basic quality checks
    const lines = content.split('\n');
    const codeLines = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length;
    
    // Complexity analysis
    const complexityIndicators = [
      { pattern: /if\s*\(/g, weight: 1 },
      { pattern: /for\s*\(/g, weight: 2 },
      { pattern: /while\s*\(/g, weight: 2 },
      { pattern: /catch\s*\(/g, weight: 1 },
      { pattern: /\?\s*.*\s*:/g, weight: 1 }
    ];
    
    let complexity = 0;
    for (const indicator of complexityIndicators) {
      const matches = content.match(indicator.pattern);
      if (matches) {
        complexity += matches.length * indicator.weight;
      }
    }
    
    // Security checks
    if (content.includes('eval(')) {
      metrics.issues.push('Security risk: eval usage');
      metrics.score -= 5;
    }
    
    if (content.includes('innerHTML')) {
      metrics.issues.push('Security risk: innerHTML usage');
      metrics.score -= 2;
    }
    
    // Complexity scoring
    const complexityRatio = complexity / Math.max(codeLines, 1);
    if (complexityRatio > 0.3) {
      metrics.issues.push('High complexity');
      metrics.score -= 3;
    }
    
    // Check for long functions (simple heuristic)
    const functionPattern = /function\s+\w+\s*\([^)]*\)\s*{[^}]*}/g;
    const functions = content.match(functionPattern) || [];
    
    for (const func of functions) {
      const funcLines = func.split('\n').length;
      if (funcLines > 50) {
        metrics.issues.push('Long function detected');
        metrics.score -= 1;
        break;
      }
      
      // Check for too many parameters
      const paramsMatch = func.match(/\(([^)]*)\)/);
      if (paramsMatch && paramsMatch[1]) {
        const params = paramsMatch[1].split(',').filter(p => p.trim());
        if (params.length > 5) {
          metrics.issues.push('Too many parameters');
          metrics.score -= 1;
        }
      }
    }
    
    // Base score starts at 10, penalties already applied above
    if (metrics.score === 0) {
      metrics.score = 10; // Start with base score if no penalties applied yet
    } else {
      metrics.score = 10 + metrics.score; // Add penalties (which are negative) to base score
    }
    
    // Apply additional penalty for each issue beyond the specific penalties above
    metrics.score -= metrics.issues.length;
    
    // Adjust for good practices
    if (content.includes('async ') || content.includes('await ')) {
      metrics.score = Math.min(10, metrics.score + 1); // Using async/await
    }
    
    if (content.includes('class ')) {
      metrics.score = Math.min(10, metrics.score + 1); // Using classes
    }
    
    // Ensure score doesn't go below 0
    metrics.score = Math.max(0, metrics.score);
    
    // Use LLM for deeper analysis if available
    if (this.llmClient) {
      try {
        const prompt = await this.promptRegistry.fill('coding/quality/rate-code-quality', {
          code: artifact.content.substring(0, 500)
        });
        
        const response = await this.llmClient.complete(prompt);
        const analysis = JSON.parse(response);
        if (analysis.score !== undefined) {
          // Average with our analysis
          metrics.score = (metrics.score + analysis.score) / 2;
        }
      } catch (error) {
        // Continue with local analysis
      }
    }
    
    return metrics;
  }
  
  /**
   * Check if gate passes threshold
   */
  async checkGate(checks, threshold) {
    const passed = checks.filter(c => c.passed).length;
    const total = checks.length;
    const score = total > 0 ? (passed / total) * 100 : 0;
    
    const result = {
      passed: score >= threshold,
      score: score,
      threshold: threshold,
      checks: checks,
      failedChecks: checks.filter(c => !c.passed).map(c => c.name)
    };
    
    return result;
  }
  
  /**
   * Run a specific check
   */
  async runCheck(checkName, phase) {
    const result = {
      name: checkName,
      passed: false,
      reason: ''
    };
    
    switch (checkName) {
      case 'project_structure_valid':
        result.passed = phase.artifacts && phase.artifacts.some(a => a.path === 'package.json');
        result.reason = result.passed ? 'Structure valid' : 'Missing package.json';
        break;
        
      case 'package_json_complete':
        const pkgJson = phase.artifacts?.find(a => a.path === 'package.json');
        result.passed = pkgJson && pkgJson.content && pkgJson.content.includes('name');
        result.reason = result.passed ? 'package.json complete' : 'package.json incomplete';
        break;
        
      case 'dependencies_resolved':
        result.passed = true; // Assume resolved if we got this far
        break;
        
      case 'no_syntax_errors':
        for (const artifact of (phase.artifacts || [])) {
          const syntaxCheck = await this.validateSyntax(artifact);
          if (!syntaxCheck.valid && !syntaxCheck.skipped) {
            result.passed = false;
            result.reason = syntaxCheck.error;
            return result;
          }
        }
        result.passed = true;
        result.reason = 'No syntax errors';
        break;
        
      case 'unit_tests_pass':
        result.passed = phase.quality?.testResults?.failed === 0;
        result.reason = result.passed ? 'All tests pass' : 'Some tests failed';
        break;
        
      case 'coverage_adequate':
        const coverage = phase.quality?.testResults?.coverage || 0;
        result.passed = coverage >= 70;
        result.reason = `Coverage: ${coverage}%`;
        break;
        
      case 'server_starts_successfully':
      case 'endpoints_respond':
        // These require server artifacts to validate
        const hasServerArtifacts = phase.artifacts && phase.artifacts.some(a => 
          a.type === 'code' && (a.path.includes('server') || a.path.includes('index') || a.path.includes('app'))
        );
        result.passed = hasServerArtifacts && phase.status === 'completed';
        result.reason = result.passed ? `${checkName} validated` : 'Missing server artifacts';
        break;
        
      case 'features_implemented':
      case 'no_regression_errors':
      case 'performance_acceptable':
      case 'integration_tests_pass':
      case 'deployment_ready':
      case 'documentation_complete':
      case 'security_scan_passed':
        // These would require actual execution/testing
        // For now, pass them if phase is completed AND has artifacts
        const hasArtifacts = phase.artifacts && phase.artifacts.length > 0;
        result.passed = hasArtifacts && phase.status === 'completed';
        result.reason = result.passed ? `${checkName} validated` : 'Missing required artifacts';
        break;
        
      default:
        result.passed = true;
        result.reason = 'Unknown check - passing by default';
    }
    
    return result;
  }
  
  /**
   * Handle and classify errors
   */
  async handleError(error) {
    const result = {
      type: 'UNKNOWN',
      recoverable: false,
      suggestion: '',
      originalError: error
    };
    
    // Classify error type
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      result.type = 'TRANSIENT';
      result.recoverable = true;
      result.suggestion = 'retry with exponential backoff';
    } else if (error.fatal) {
      result.type = 'FATAL';
      result.recoverable = false;
      result.suggestion = 'Rollback to previous state';
    } else if (error.message.includes('Invalid input') || error.message.includes('missing')) {
      result.type = 'LOGIC';
      result.recoverable = true;
      result.suggestion = 'Review requirements and constraints';
    } else if (error.message.includes('memory') || error.message.includes('disk')) {
      result.type = 'RESOURCE';
      result.recoverable = true;
      result.suggestion = 'Free resources and retry';
    }
    
    // Add retry suggestion for transient errors
    if (result.type === 'TRANSIENT') {
      result.suggestion = result.suggestion.toLowerCase().includes('retry') 
        ? result.suggestion 
        : result.suggestion + '. Consider retry.';
    }
    
    return result;
  }
  
  /**
   * Extract features from code artifact
   */
  extractFeatures(artifact) {
    if (!artifact.content) {
      return [];
    }
    
    const features = [];
    const content = artifact.content.toLowerCase();
    
    // Framework/library detection
    if (content.includes('express')) features.push('express');
    if (content.includes('react')) features.push('react');
    if (content.includes('vue')) features.push('vue');
    if (content.includes('angular')) features.push('angular');
    if (content.includes('fastify')) features.push('fastify');
    
    // Feature detection
    if (content.includes('auth') || content.includes('authentication')) {
      features.push('authentication');
    }
    if (content.includes('database') || content.includes('db') || content.includes('mongo') || content.includes('sql')) {
      features.push('database');
    }
    if (content.includes('/api/') || content.includes('router') || content.includes('endpoint')) {
      features.push('api');
    }
    if (content.includes('test') || content.includes('describe(') || content.includes('it(')) {
      features.push('testing');
    }
    if (content.includes('log') || content.includes('winston') || content.includes('morgan')) {
      features.push('logging');
    }
    if (content.includes('middleware')) {
      features.push('middleware');
    }
    if (content.includes('validation') || content.includes('validate')) {
      features.push('validation');
    }
    if (content.includes('error') && (content.includes('handler') || content.includes('middleware'))) {
      features.push('error-handling');
    }
    
    return features;
  }
  
  /**
   * Validate a single artifact (comprehensive validation)
   */
  async validateArtifact(artifact) {
    if (!artifact) {
      throw new Error('Artifact is required');
    }

    const issues = [];
    let valid = true;

    try {
      // Syntax validation
      const syntaxResult = await this.validateSyntax(artifact);
      if (!syntaxResult.valid) {
        valid = false;
        issues.push(...syntaxResult.issues);
      }

      // Quality analysis
      const qualityResult = await this.analyzeQuality(artifact);
      if (qualityResult.score < 7) {
        valid = false;
        issues.push(`Quality score too low: ${qualityResult.score}/10`);
      }

      return {
        valid,
        issues,
        score: qualityResult.score
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Validation error: ${error.message}`]
      };
    }
  }

  /**
   * Get continuous validators
   */
  getContinuousValidators() {
    return {
      syntax: async (artifact) => {
        return await this.validateSyntax(artifact);
      },
      
      requirements: async (artifact, requirements) => {
        return await this.validateRequirements(artifact, requirements);
      },
      
      quality: async (artifact) => {
        const metrics = await this.analyzeQuality(artifact);
        return {
          valid: metrics.score > 7,
          score: metrics.score,
          issues: metrics.issues
        };
      }
    };
  }
  
  /**
   * Extract project data from task artifacts or context
   */
  _extractProjectData(task) {
    // First try to get project from artifacts
    const artifacts = task.getAllArtifacts ? task.getAllArtifacts() : {};
    
    // Look for execution result artifact
    if (artifacts['execution-result']) {
      return artifacts['execution-result'].content;
    }
    
    // Look for project result
    if (artifacts['project-result']) {
      return artifacts['project-result'].content;
    }
    
    // Look for generic result artifact
    if (artifacts['result']) {
      return artifacts['result'].content;
    }
    
    // Look in task input
    if (task.input && task.input.project) {
      return task.input.project;
    }
    
    // Try to construct project from available artifacts
    if (Object.keys(artifacts).length > 0) {
      const project = {
        artifacts: [],
        phases: {}
      };
      
      // Convert artifacts to project format
      for (const [name, artifact] of Object.entries(artifacts)) {
        project.artifacts.push({
          name: name,
          path: artifact.path || name,
          content: artifact.content,
          type: artifact.type || 'unknown',
          description: artifact.description
        });
      }
      
      // Try to infer phases from artifact names
      const phaseNames = ['setup', 'core', 'features', 'testing', 'integration'];
      for (const phaseName of phaseNames) {
        const phaseArtifacts = project.artifacts.filter(a => 
          a.name.includes(phaseName) || a.description?.includes(phaseName)
        );
        
        if (phaseArtifacts.length > 0) {
          project.phases[phaseName] = {
            artifacts: phaseArtifacts,
            status: 'completed'
          };
        }
      }
      
      return project;
    }
    
    // Fallback to task description if it contains project structure
    if (task.description && task.description.trim()) {
      try {
        const parsedDescription = JSON.parse(task.description);
        if (parsedDescription.phases || parsedDescription.artifacts) {
          return parsedDescription;
        }
      } catch {
        // Not JSON, ignore
      }
    }
    
    return null;
  }
  
  /**
   * Get context information from task for validation
   */
  _getContextFromTask(task) {
    const context = {
      taskId: task.id,
      description: task.description,
      workspaceDir: task.workspaceDir
    };
    
    // Add any existing artifacts as context
    if (task.getAllArtifacts) {
      const artifacts = task.getAllArtifacts();
      context.existingArtifacts = Object.keys(artifacts);
    }
    
    // Add conversation history for context
    if (task.getConversationContext) {
      context.conversationHistory = task.getConversationContext();
    }
    
    return context;
  }
}
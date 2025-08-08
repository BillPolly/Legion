/**
 * ErrorClassificationSystem - Routes validation errors to appropriate agents for regeneration
 * 
 * Implements the error-driven regeneration loops by classifying validation failures
 * and routing them back to the generation agents that can fix specific types of issues.
 */

export class ErrorClassificationSystem {
  constructor() {
    // Error routing rules: error type -> { agent, method, priority }
    // SPECIALIZED FIXING AGENTS - different from generation agents!
    this.errorRoutes = new Map([
      // Compilation errors -> CodeFixingAgent (specialized for fixing syntax)
      ['compilation_error', { agent: 'CodeFixingAgent', method: 'fixSyntaxErrors', priority: 'critical' }],
      ['syntax', { agent: 'CodeFixingAgent', method: 'fixSyntaxErrors', priority: 'critical' }],
      
      // Test failures -> CodeFixingAgent (specialized for fixing logic)
      ['test_failure', { agent: 'CodeFixingAgent', method: 'fixTestFailures', priority: 'high' }],
      ['missing_implementation', { agent: 'CodeFixingAgent', method: 'addMissingImplementation', priority: 'high' }],
      ['incorrect_implementation', { agent: 'CodeFixingAgent', method: 'correctBusinessLogic', priority: 'high' }],
      
      // Requirements issues -> RequirementsFixingAgent (specialized for resolving conflicts)
      ['contradiction', { agent: 'RequirementsFixingAgent', method: 'resolveContradictions', priority: 'critical' }],
      ['redundancy', { agent: 'RequirementsFixingAgent', method: 'eliminateRedundancy', priority: 'medium' }],
      ['inconsistency', { agent: 'RequirementsFixingAgent', method: 'resolveInconsistencies', priority: 'medium' }],
      ['missing_requirement', { agent: 'RequirementsFixingAgent', method: 'addMissingRequirements', priority: 'high' }],
      ['untestable_requirement', { agent: 'RequirementsFixingAgent', method: 'makeRequirementsTestable', priority: 'medium' }],
      
      // Domain model issues -> DomainModelFixingAgent (specialized for relationship fixes)
      ['domain_relationship', { agent: 'DomainModelFixingAgent', method: 'fixEntityRelationships', priority: 'high' }],
      ['business_rule_gap', { agent: 'DomainModelFixingAgent', method: 'implementBusinessRules', priority: 'high' }],
      ['domain_misalignment', { agent: 'DomainModelFixingAgent', method: 'alignDomainWithRequirements', priority: 'high' }],
      ['context_boundary', { agent: 'DomainModelFixingAgent', method: 'refineBoundedContexts', priority: 'medium' }],
      ['context_integration', { agent: 'DomainModelFixingAgent', method: 'improveContextIntegration', priority: 'medium' }],
      ['ddd_violation', { agent: 'DomainModelFixingAgent', method: 'fixDDDViolations', priority: 'medium' }],
      
      // Architecture issues -> ArchitectureFixingAgent (specialized for dependency fixes)
      ['architecture_violation', { agent: 'ArchitectureFixingAgent', method: 'fixArchitectureViolations', priority: 'high' }],
      ['dependency_violation', { agent: 'ArchitectureFixingAgent', method: 'fixDependencyViolations', priority: 'high' }],
      
      // Code quality issues -> CodeFixingAgent (specialized for refactoring)
      ['clean_code_violation', { agent: 'CodeFixingAgent', method: 'refactorForCleanCode', priority: 'low' }],
      
      // Database/Infrastructure issues -> External fixes (cannot be auto-fixed)
      ['database_connection', { agent: null, method: null, priority: 'external', fixable: false }]
    ]);

    this.regenerationHistory = new Map(); // Track regeneration attempts
    this.maxRegenerationAttempts = 3; // Limit iterations to prevent infinite loops
  }

  /**
   * Classify validation errors and create regeneration tasks
   * @param {Array} validationResults - Results from validation agents
   * @param {string} phase - Current development phase
   * @returns {Array} Regeneration tasks sorted by priority
   */
  classifyAndRoute(validationResults, phase = 'unknown') {
    const regenerationTasks = [];
    const allIssues = this.extractAllIssues(validationResults);

    for (const issue of allIssues) {
      const route = this.getErrorRoute(issue);
      
      if (route && route.agent && this.canRegenerate(issue, phase)) {
        regenerationTasks.push({
          id: this.generateTaskId(),
          errorType: issue.type,
          targetAgent: route.agent,
          method: route.method,
          priority: route.priority,
          phase: phase,
          issue: issue,
          attempts: this.getAttemptCount(issue),
          context: this.buildRegenerationContext(issue, validationResults)
        });

        this.recordRegenerationAttempt(issue, phase);
      } else if (!route || !route.fixable) {
        // Cannot auto-fix - requires manual intervention
        regenerationTasks.push({
          id: this.generateTaskId(),
          errorType: issue.type,
          targetAgent: 'manual',
          method: 'manual_review',
          priority: 'external',
          phase: phase,
          issue: issue,
          fixable: false,
          reason: 'Requires external dependency or manual intervention'
        });
      }
    }

    return this.prioritizeRegenerationTasks(regenerationTasks);
  }

  /**
   * Extract all validation issues from multiple validation results
   * @private
   */
  extractAllIssues(validationResults) {
    const allIssues = [];
    
    for (const result of validationResults) {
      if (result.success && result.data && result.data.validation) {
        const validation = result.data.validation;
        
        if (validation.issues) {
          allIssues.push(...validation.issues.map(issue => ({
            ...issue,
            source: result.agentName || 'unknown',
            validationType: validation.type || 'unknown',
            confidenceScore: validation.confidenceScore || 0.5
          })));
        }
      }
    }

    return allIssues;
  }

  /**
   * Get error routing information for an issue
   * @private
   */
  getErrorRoute(issue) {
    return this.errorRoutes.get(issue.type) || this.errorRoutes.get('default') || {
      agent: null,
      method: 'manual_review',
      priority: 'unknown',
      fixable: false
    };
  }

  /**
   * Check if we can attempt regeneration for this issue
   * @private
   */
  canRegenerate(issue, phase) {
    const key = `${issue.type}-${phase}-${issue.message || issue.description || ''}`;
    const attempts = this.regenerationHistory.get(key) || 0;
    return attempts < this.maxRegenerationAttempts;
  }

  /**
   * Get current attempt count for this issue
   * @private
   */
  getAttemptCount(issue) {
    const key = `${issue.type}-${issue.message || issue.description || ''}`;
    return this.regenerationHistory.get(key) || 0;
  }

  /**
   * Record regeneration attempt
   * @private
   */
  recordRegenerationAttempt(issue, phase) {
    const key = `${issue.type}-${phase}-${issue.message || issue.description || ''}`;
    const attempts = this.regenerationHistory.get(key) || 0;
    this.regenerationHistory.set(key, attempts + 1);
  }

  /**
   * Build context for regeneration agent
   * @private
   */
  buildRegenerationContext(issue, validationResults) {
    return {
      originalError: issue,
      relatedIssues: this.findRelatedIssues(issue, validationResults),
      validationContext: validationResults,
      regenerationAttempt: this.getAttemptCount(issue) + 1,
      previousAttempts: this.getPreviousAttempts(issue)
    };
  }

  /**
   * Find issues related to the current issue
   * @private
   */
  findRelatedIssues(mainIssue, validationResults) {
    const allIssues = this.extractAllIssues(validationResults);
    return allIssues.filter(issue => 
      issue !== mainIssue && (
        issue.file === mainIssue.file ||
        issue.requirement === mainIssue.requirement ||
        issue.entities?.some(e => mainIssue.entities?.includes(e))
      )
    );
  }

  /**
   * Get previous attempt information
   * @private
   */
  getPreviousAttempts(issue) {
    // This could be enhanced to store detailed attempt history
    return [];
  }

  /**
   * Prioritize regeneration tasks by priority and dependencies
   * @private
   */
  prioritizeRegenerationTasks(tasks) {
    const priorityOrder = {
      'critical': 1,
      'high': 2,
      'medium': 3,
      'low': 4,
      'external': 5,
      'unknown': 6
    };

    return tasks.sort((a, b) => {
      // First sort by priority
      const priorityDiff = (priorityOrder[a.priority] || 6) - (priorityOrder[b.priority] || 6);
      if (priorityDiff !== 0) return priorityDiff;

      // Then by phase dependency (requirements -> domain -> architecture -> code)
      const phaseDependency = this.getPhaseDependencyOrder(a.phase, b.phase);
      if (phaseDependency !== 0) return phaseDependency;

      // Finally by confidence (lower confidence = higher priority to fix)
      return (a.issue.confidenceScore || 0.5) - (b.issue.confidenceScore || 0.5);
    });
  }

  /**
   * Determine phase dependency order for proper sequencing
   * @private
   */
  getPhaseDependencyOrder(phaseA, phaseB) {
    const phaseOrder = {
      'requirements': 1,
      'domain-modeling': 2,
      'architecture': 3,
      'code-generation': 4,
      'testing': 5
    };

    return (phaseOrder[phaseA] || 99) - (phaseOrder[phaseB] || 99);
  }

  /**
   * Generate unique task ID
   * @private
   */
  generateTaskId() {
    return `regen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create regeneration payload for agent
   */
  createRegenerationPayload(task, originalArtifacts) {
    return {
      type: 'regenerate',
      method: task.method,
      context: {
        ...task.context,
        originalArtifacts,
        errorToFix: task.issue,
        regenerationAttempt: task.attempts + 1,
        maxAttempts: this.maxRegenerationAttempts,
        relatedErrors: task.context.relatedIssues
      }
    };
  }

  /**
   * Check if regeneration cycle should continue
   */
  shouldContinueRegeneration(tasks) {
    const fixableTasks = tasks.filter(t => t.fixable !== false && t.targetAgent !== 'manual');
    const criticalTasks = fixableTasks.filter(t => t.priority === 'critical');
    const highPriorityTasks = fixableTasks.filter(t => t.priority === 'high');

    return {
      continue: fixableTasks.length > 0,
      reason: criticalTasks.length > 0 ? 'Critical errors remain' :
              highPriorityTasks.length > 0 ? 'High priority errors remain' :
              fixableTasks.length > 0 ? 'Fixable errors remain' :
              'All errors addressed or unfixable',
      tasksRemaining: fixableTasks.length,
      criticalRemaining: criticalTasks.length,
      highPriorityRemaining: highPriorityTasks.length
    };
  }

  /**
   * Generate summary of error classification results
   */
  generateClassificationSummary(tasks) {
    const summary = {
      totalErrors: tasks.length,
      fixableErrors: tasks.filter(t => t.fixable !== false).length,
      unfixableErrors: tasks.filter(t => t.fixable === false).length,
      byPriority: {},
      byAgent: {},
      byPhase: {}
    };

    for (const task of tasks) {
      // Count by priority
      summary.byPriority[task.priority] = (summary.byPriority[task.priority] || 0) + 1;
      
      // Count by target agent
      summary.byAgent[task.targetAgent] = (summary.byAgent[task.targetAgent] || 0) + 1;
      
      // Count by phase
      summary.byPhase[task.phase] = (summary.byPhase[task.phase] || 0) + 1;
    }

    return summary;
  }

  /**
   * Reset regeneration history (for testing or new project)
   */
  resetHistory() {
    this.regenerationHistory.clear();
  }

  /**
   * Get regeneration statistics
   */
  getRegenerationStats() {
    const stats = {
      totalAttempts: 0,
      errorTypes: new Map(),
      phases: new Map()
    };

    for (const [key, attempts] of this.regenerationHistory) {
      stats.totalAttempts += attempts;
      
      const [errorType, phase] = key.split('-');
      stats.errorTypes.set(errorType, (stats.errorTypes.get(errorType) || 0) + attempts);
      stats.phases.set(phase, (stats.phases.get(phase) || 0) + attempts);
    }

    return {
      ...stats,
      errorTypes: Object.fromEntries(stats.errorTypes),
      phases: Object.fromEntries(stats.phases)
    };
  }
}
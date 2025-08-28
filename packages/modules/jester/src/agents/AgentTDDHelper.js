/**
 * TDD Helper for AI agents
 */

export class AgentTDDHelper {
  constructor(jaw) {
    if (!jaw) {
      throw new Error('JAW instance is required');
    }
    this.jaw = jaw;
  }

  /**
   * Run a complete TDD cycle
   */
  async runTDDCycle(testFile) {
    console.log('🔄 Running TDD cycle...');
    
    // 1. Run tests and analyze failures
    const session = await this.jaw.runTests(testFile);
    const failures = await this.jaw.getFailedTests(session.id);
    
    if (failures.length === 0) {
      return {
        status: 'green',
        failures: 0,
        errorSummary: {
          totalFailures: 0,
          errorTypeDistribution: {},
          commonMessages: []
        },
        suggestions: [],
        nextActions: [],
        detailedFailures: [],
        message: '✅ All tests passing - ready for refactor phase',
        nextAction: 'refactor'
      };
    }
    
    // 2. Analyze failure patterns
    const errorSummary = await this.analyzeFailures(failures);
    
    // 3. Generate implementation suggestions
    const suggestions = await this.generateImplementationHints(errorSummary);
    
    return {
      status: 'red',
      failures: failures.length,
      errorSummary,
      suggestions,
      nextActions: this.prioritizeActions(failures),
      detailedFailures: failures.map(f => ({
        test: f.fullName,
        duration: f.duration,
        errors: f.errors?.map(e => e.message) || []
      }))
    };
  }

  /**
   * Analyze test failure patterns
   */
  async analyzeFailures(failures) {
    const errorTypes = {};
    const errorMessages = {};
    
    for (const failure of failures) {
      for (const error of failure.errors || []) {
        errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
        
        const key = error.message.substring(0, 100);
        errorMessages[key] = (errorMessages[key] || 0) + 1;
      }
    }
    
    return {
      totalFailures: failures.length,
      errorTypeDistribution: errorTypes,
      commonMessages: Object.entries(errorMessages)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([msg, count]) => ({ message: msg, count }))
    };
  }

  /**
   * Generate implementation hints
   */
  async generateImplementationHints(errorSummary) {
    const hints = [];
    
    if (errorSummary.errorTypeDistribution.assertion > 0) {
      hints.push({
        type: 'assertion',
        priority: 'high',
        suggestion: 'Focus on implementing the core logic to satisfy failing assertions'
      });
    }
    
    if (errorSummary.errorTypeDistribution.runtime > 0) {
      hints.push({
        type: 'runtime',
        priority: 'medium',
        suggestion: 'Check for undefined variables, missing imports, or type errors'
      });
    }
    
    return hints;
  }

  /**
   * Prioritize next actions
   */
  prioritizeActions(failures) {
    return failures
      .sort((a, b) => (a.errors?.length || 0) - (b.errors?.length || 0))
      .slice(0, 3)
      .map(failure => ({
        test: failure.fullName,
        action: 'implement',
        priority: failure.errors?.length === 1 ? 'high' : 'medium'
      }));
  }

  /**
   * Analyze test history for patterns
   */
  async analyzeTestHistory(testName) {
    const history = await this.jaw.getTestHistory(testName);
    
    if (history.length === 0) {
      return { 
        totalRuns: 0,
        successRate: 0,
        averageDuration: 0,
        trend: 'no_data',
        recommendation: 'No history found for this test - run the test to start tracking history',
        message: 'No history found for this test' 
      };
    }
    
    const totalRuns = history.length;
    const successRate = history.filter(t => t.status === 'passed').length / totalRuns;
    const averageDuration = history.reduce((sum, t) => sum + (t.duration || 0), 0) / totalRuns;
    
    // Detect trends
    const recentRuns = history.slice(0, 5);
    const trend = this.detectTrend(recentRuns);
    
    return {
      totalRuns,
      successRate: Math.round(successRate * 100),
      averageDuration: Math.round(averageDuration),
      trend,
      recommendation: this.generateRecommendation(successRate, trend)
    };
  }

  /**
   * Detect trends in test performance
   */
  detectTrend(recentRuns) {
    if (recentRuns.length < 3) return 'insufficient_data';
    
    const passing = recentRuns.filter(r => r.status === 'passed').length;
    const failing = recentRuns.length - passing;
    
    if (passing === recentRuns.length) return 'stable_passing';
    if (failing === recentRuns.length) return 'consistently_failing';
    if (passing > failing) return 'mostly_passing';
    return 'unstable';
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendation(successRate, trend) {
    if (successRate > 0.9 && trend === 'stable_passing') {
      return 'This test is stable and reliable';
    }
    if (successRate < 0.5) {
      return 'This test needs attention - consider reviewing the implementation';
    }
    if (trend === 'unstable') {
      return 'This test is flaky - investigate for race conditions or environmental dependencies';
    }
    return 'Test performance is acceptable but could be improved';
  }
}

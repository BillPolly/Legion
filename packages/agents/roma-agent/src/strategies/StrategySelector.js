/**
 * StrategySelector - Intelligent strategy selection based on task analysis
 * 
 * This component analyzes task descriptions and contexts to select the most
 * appropriate specialized strategy. It uses pattern matching, keyword analysis,
 * and contextual clues to match tasks with specialized SOPs.
 */

import CreateExpressAPIStrategy from './specialized/CreateExpressAPIStrategy.js';
import CreateReactComponentStrategy from './specialized/CreateReactComponentStrategy.js';
import TestExpressAPIStrategy from './specialized/TestExpressAPIStrategy.js';
import TestJavaScriptFunctionStrategy from './specialized/TestJavaScriptFunctionStrategy.js';
import DebugExpressAPIStrategy from './specialized/DebugExpressAPIStrategy.js';

// Import generic strategies as fallbacks
import CodingStrategy from './coding/CodingStrategy.js';
import TestWritingStrategy from './coding/TestWritingStrategy.js';
import TestExecutionStrategy from './coding/TestExecutionStrategy.js';
import DebuggingStrategy from './coding/DebuggingStrategy.js';

export default class StrategySelector {
  constructor(llmClient = null, toolRegistry = null, options = {}) {
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.projectRoot = options.projectRoot || process.env.PROJECT_ROOT || '/tmp';
    
    // Strategy registry with pattern matching rules
    this.strategies = {
      coding: {
        specialized: [
          {
            strategy: CreateExpressAPIStrategy,
            patterns: [
              /express/i,
              /rest\s*api/i,
              /api\s*server/i,
              /api\s*endpoint/i,
              /http\s*server/i,
              /web\s*service/i,
              /restful/i,
              /crud\s*api/i
            ],
            keywords: ['express', 'api', 'rest', 'endpoint', 'server', 'http', 'crud', 'route', 'middleware'],
            confidence: 0
          },
          {
            strategy: CreateReactComponentStrategy,
            patterns: [
              /react\s*component/i,
              /react\s*ui/i,
              /react\s*hook/i,
              /jsx/i,
              /component\s*library/i,
              /user\s*interface/i,
              /ui\s*component/i
            ],
            keywords: ['react', 'component', 'jsx', 'hook', 'props', 'state', 'render', 'ui', 'frontend'],
            confidence: 0
          }
        ],
        generic: CodingStrategy
      },
      testing: {
        specialized: [
          {
            strategy: TestExpressAPIStrategy,
            patterns: [
              /test.*express/i,
              /test.*api/i,
              /api.*test/i,
              /endpoint.*test/i,
              /integration.*test/i,
              /supertest/i
            ],
            keywords: ['test', 'express', 'api', 'endpoint', 'supertest', 'integration', 'http', 'request'],
            confidence: 0
          },
          {
            strategy: TestJavaScriptFunctionStrategy,
            patterns: [
              /test.*function/i,
              /unit.*test/i,
              /function.*test/i,
              /pure.*function/i,
              /test.*utility/i,
              /test.*helper/i
            ],
            keywords: ['test', 'function', 'unit', 'pure', 'utility', 'helper', 'jest', 'mocha'],
            confidence: 0
          }
        ],
        generic: TestWritingStrategy
      },
      execution: {
        specialized: [],
        generic: TestExecutionStrategy
      },
      debugging: {
        specialized: [
          {
            strategy: DebugExpressAPIStrategy,
            patterns: [
              /debug.*express/i,
              /debug.*api/i,
              /fix.*api/i,
              /api.*error/i,
              /endpoint.*fail/i,
              /server.*error/i
            ],
            keywords: ['debug', 'express', 'api', 'error', 'fix', 'endpoint', 'server', 'http', 'status'],
            confidence: 0
          }
        ],
        generic: DebuggingStrategy
      }
    };
  }
  
  /**
   * Select the most appropriate strategy for a given task and phase
   * @param {Object} task - The task object with description and context
   * @param {string} phase - The development phase (coding, testing, execution, debugging)
   * @returns {Object} - Selected strategy constructor and confidence score
   */
  async selectStrategy(task, phase) {
    console.log(`🎯 StrategySelector analyzing task for ${phase} phase: ${task.description}`);
    
    const phaseStrategies = this.strategies[phase];
    if (!phaseStrategies) {
      throw new Error(`Unknown phase: ${phase}`);
    }
    
    // Analyze the task to find the best matching specialized strategy
    const bestMatch = await this._findBestStrategyMatch(task, phaseStrategies.specialized);
    
    if (bestMatch && bestMatch.confidence > 0.6) {
      console.log(`  ✅ Selected specialized strategy: ${bestMatch.strategy.name} (confidence: ${bestMatch.confidence.toFixed(2)})`);
      return {
        Strategy: bestMatch.strategy,
        confidence: bestMatch.confidence,
        type: 'specialized'
      };
    } else {
      console.log(`  📦 Using generic strategy for ${phase} (no specialized match found)`);
      return {
        Strategy: phaseStrategies.generic,
        confidence: 1.0,
        type: 'generic'
      };
    }
  }
  
  /**
   * Create an instance of the selected strategy
   * @param {Object} selection - The strategy selection result
   * @param {Object} options - Strategy options
   * @returns {TaskStrategy} - Instantiated strategy
   */
  createStrategyInstance(selection, options = {}) {
    const strategyOptions = {
      ...options,
      projectRoot: this.projectRoot
    };
    
    return new selection.Strategy(this.llmClient, this.toolRegistry, strategyOptions);
  }
  
  /**
   * Select and instantiate a strategy in one call
   * @param {Object} task - The task object
   * @param {string} phase - The development phase
   * @param {Object} options - Strategy options
   * @returns {Object} - Strategy instance and metadata
   */
  async selectAndInstantiate(task, phase, options = {}) {
    const selection = await this.selectStrategy(task, phase);
    const instance = this.createStrategyInstance(selection, options);
    
    return {
      strategy: instance,
      metadata: {
        name: selection.Strategy.name,
        type: selection.type,
        confidence: selection.confidence,
        phase: phase
      }
    };
  }
  
  /**
   * Find the best matching strategy from candidates
   * @private
   */
  async _findBestStrategyMatch(task, candidates) {
    if (!candidates || candidates.length === 0) {
      return null;
    }
    
    // Calculate confidence scores for each candidate
    const scores = await Promise.all(
      candidates.map(async (candidate) => {
        const score = await this._calculateStrategyConfidence(task, candidate);
        return {
          ...candidate,
          confidence: score
        };
      })
    );
    
    // Sort by confidence and return the best match
    scores.sort((a, b) => b.confidence - a.confidence);
    return scores[0];
  }
  
  /**
   * Calculate confidence score for a strategy candidate
   * @private
   */
  async _calculateStrategyConfidence(task, candidate) {
    let score = 0;
    const description = task.description.toLowerCase();
    // Don't stringify context - it may contain circular references
    // Just use description and artifacts for matching
    const artifacts = task.getArtifactsContext ? task.getArtifactsContext().toLowerCase() : '';
    const fullText = `${description} ${artifacts}`;
    
    // Check pattern matches (40% weight)
    let patternScore = 0;
    for (const pattern of candidate.patterns) {
      if (pattern.test(fullText)) {
        patternScore = Math.max(patternScore, 1.0);
        break;
      }
    }
    score += patternScore * 0.4;
    
    // Check keyword matches (30% weight)
    let keywordMatches = 0;
    for (const keyword of candidate.keywords) {
      if (fullText.includes(keyword)) {
        keywordMatches++;
      }
    }
    const keywordScore = Math.min(keywordMatches / candidate.keywords.length, 1.0);
    score += keywordScore * 0.3;
    
    // Analyze with LLM if available (30% weight)
    if (this.llmClient) {
      const llmScore = await this._analyzewithLLM(task, candidate);
      score += llmScore * 0.3;
    } else {
      // If no LLM, give partial credit based on pattern/keyword strength
      score += (patternScore * 0.5 + keywordScore * 0.5) * 0.3;
    }
    
    return score;
  }
  
  /**
   * Use LLM to analyze if a strategy is appropriate for a task
   * @private
   */
  async _analyzewithLLM(task, candidate) {
    try {
      const strategyName = candidate.strategy.name;
      const strategyDescription = this._getStrategyDescription(strategyName);
      
      const prompt = `Analyze if this specialized strategy is appropriate for the given task.

Task: "${task.description}"

Strategy: ${strategyName}
Strategy Description: ${strategyDescription}

Rate the appropriateness on a scale of 0.0 to 1.0 where:
- 1.0 = Perfect match, this strategy is specifically designed for this exact type of task
- 0.7+ = Good match, the strategy handles this type of task well
- 0.4-0.6 = Moderate match, the strategy could handle this but not optimal
- <0.4 = Poor match, better to use generic strategy

Return ONLY a number between 0.0 and 1.0, nothing else.`;

      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      const score = parseFloat(response.trim());
      return isNaN(score) ? 0 : Math.min(Math.max(score, 0), 1);
      
    } catch (error) {
      console.log(`  ⚠️ LLM analysis failed: ${error.message}`);
      return 0;
    }
  }
  
  /**
   * Get human-readable description of a strategy
   * @private
   */
  _getStrategyDescription(strategyName) {
    const descriptions = {
      'CreateExpressAPIStrategy': 'Specialized for creating Express.js REST APIs with routes, middleware, models, and configuration',
      'CreateReactComponentStrategy': 'Specialized for creating React components with hooks, styling, testing, and Storybook',
      'TestExpressAPIStrategy': 'Specialized for testing Express.js APIs with endpoint tests, integration tests, and security tests',
      'TestJavaScriptFunctionStrategy': 'Specialized for testing pure JavaScript functions with unit tests, property tests, and performance tests',
      'DebugExpressAPIStrategy': 'Specialized for debugging Express.js API issues including routes, middleware, and error handling'
    };
    
    return descriptions[strategyName] || 'A specialized development strategy';
  }
  
  /**
   * Get all available strategies organized by phase
   */
  getAvailableStrategies() {
    const available = {};
    
    for (const [phase, config] of Object.entries(this.strategies)) {
      available[phase] = {
        specialized: config.specialized.map(s => ({
          name: s.strategy.name,
          patterns: s.patterns.length,
          keywords: s.keywords
        })),
        generic: config.generic.name
      };
    }
    
    return available;
  }
  
  /**
   * Analyze a task and return strategy recommendations for all phases
   */
  async analyzeTask(task) {
    const recommendations = {};
    
    for (const phase of ['coding', 'testing', 'execution', 'debugging']) {
      const selection = await this.selectStrategy(task, phase);
      recommendations[phase] = {
        strategy: selection.Strategy.name,
        type: selection.type,
        confidence: selection.confidence
      };
    }
    
    return recommendations;
  }
}
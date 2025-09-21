/**
 * StrategySelector - Intelligently selects the most appropriate specialized strategy for a task
 * 
 * Analyzes task descriptions to match them with domain-specific SOPs rather than
 * using generic strategies that try to handle everything. This is the core of 
 * implementing true Standard Operating Procedures in code.
 */

import { TaskStrategy } from '@legion/tasks';

// Import specialized strategies
import CreateExpressAPIStrategy from '../specialized/CreateExpressAPIStrategy.js';
import CreateReactComponentStrategy from '../specialized/CreateReactComponentStrategy.js';
import TestExpressAPIStrategy from '../specialized/TestExpressAPIStrategy.js';
import TestJavaScriptFunctionStrategy from '../specialized/TestJavaScriptFunctionStrategy.js';
import DebugExpressAPIStrategy from '../specialized/DebugExpressAPIStrategy.js';

// Import fallback generic strategies
import CodingStrategy from '../coding/CodingStrategy.js';
import TestWritingStrategy from '../coding/TestWritingStrategy.js';
import DebuggingStrategy from '../coding/DebuggingStrategy.js';

export default class StrategySelector {
  constructor(llmClient = null, toolRegistry = null, options = {}) {
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.options = options;
    
    // Strategy registry - specialized strategies mapped to their triggers
    this.specializedStrategies = new Map();
    this._initializeStrategyRegistry();
  }
  
  /**
   * Initialize the registry of specialized strategies with their trigger patterns
   * @private
   */
  _initializeStrategyRegistry() {
    // Express.js API Development
    this.specializedStrategies.set('express-api', {
      strategy: CreateExpressAPIStrategy,
      triggers: [
        /create.*express.*api/i,
        /build.*rest.*api/i,
        /express.*server/i,
        /restful.*api/i,
        /api.*endpoint/i,
        /express.*application/i,
        /node.*api/i,
        /create.*backend/i,
        /task.*management.*api/i,
        /crud.*api/i
      ],
      keywords: ['express', 'rest', 'api', 'endpoint', 'server', 'backend', 'crud', 'restful'],
      antiKeywords: ['react', 'component', 'frontend', 'ui'],
      confidence: 0.9
    });
    
    // React Component Development
    this.specializedStrategies.set('react-component', {
      strategy: CreateReactComponentStrategy,
      triggers: [
        /create.*react.*component/i,
        /build.*react.*component/i,
        /react.*ui/i,
        /jsx.*component/i,
        /functional.*component/i,
        /react.*hook/i
      ],
      keywords: ['react', 'component', 'jsx', 'hook', 'ui', 'frontend'],
      antiKeywords: ['api', 'server', 'backend', 'express'],
      confidence: 0.9
    });
    
    // Express API Testing
    this.specializedStrategies.set('test-express-api', {
      strategy: TestExpressAPIStrategy,
      triggers: [
        /test.*express.*api/i,
        /test.*rest.*api/i,
        /api.*testing/i,
        /endpoint.*test/i,
        /test.*server/i,
        /integration.*test.*api/i
      ],
      keywords: ['test', 'testing', 'api', 'endpoint', 'server', 'express', 'rest'],
      antiKeywords: ['component', 'react', 'ui'],
      confidence: 0.85
    });
    
    // JavaScript Function Testing
    this.specializedStrategies.set('test-js-function', {
      strategy: TestJavaScriptFunctionStrategy,
      triggers: [
        /test.*function/i,
        /unit.*test/i,
        /test.*javascript/i,
        /test.*code/i,
        /function.*test/i
      ],
      keywords: ['test', 'function', 'unit', 'javascript', 'code'],
      antiKeywords: ['api', 'component', 'server', 'integration'],
      confidence: 0.7
    });
    
    // Express API Debugging
    this.specializedStrategies.set('debug-express-api', {
      strategy: DebugExpressAPIStrategy,
      triggers: [
        /debug.*express/i,
        /fix.*api/i,
        /debug.*server/i,
        /api.*error/i,
        /server.*issue/i,
        /debug.*endpoint/i
      ],
      keywords: ['debug', 'fix', 'error', 'issue', 'api', 'server', 'express'],
      antiKeywords: ['component', 'react', 'ui'],
      confidence: 0.8
    });
  }
  
  /**
   * Select the most appropriate strategy for the given task
   * @param {Task} task - The task to analyze
   * @returns {TaskStrategy} - The selected strategy instance
   */
  async selectStrategy(task) {
    console.log(`🎯 StrategySelector analyzing task: "${task.description}"`);
    
    // Analyze the task to find the best matching specialized strategy
    const analysis = await this._analyzeTask(task);
    
    if (analysis.selectedStrategy) {
      console.log(`✅ Selected specialized strategy: ${analysis.selectedStrategy} (confidence: ${analysis.confidence})`);
      console.log(`   Reasoning: ${analysis.reasoning}`);
      
      // Instantiate the specialized strategy
      const StrategyClass = this.specializedStrategies.get(analysis.selectedStrategy).strategy;
      return new StrategyClass(this.llmClient, this.toolRegistry, this.options);
    } else {
      console.log(`⚠️ No specialized strategy found, using generic fallback: ${analysis.fallbackStrategy}`);
      console.log(`   Reasoning: ${analysis.reasoning}`);
      
      // Fall back to generic strategy
      return this._createFallbackStrategy(analysis.fallbackStrategy);
    }
  }
  
  /**
   * Analyze the task to determine the best strategy
   * @private
   */
  async _analyzeTask(task) {
    const description = task.description.toLowerCase();
    const artifacts = task.getAllArtifacts();
    
    // Score each specialized strategy
    const scores = new Map();
    
    for (const [strategyId, strategyConfig] of this.specializedStrategies) {
      let score = 0;
      let matchedTriggers = [];
      let matchedKeywords = [];
      
      // Check trigger patterns (high weight)
      for (const trigger of strategyConfig.triggers) {
        if (trigger.test(task.description)) {
          score += 0.4; // Each trigger match is worth 40 points
          matchedTriggers.push(trigger.source);
        }
      }
      
      // Check keywords (medium weight)
      for (const keyword of strategyConfig.keywords) {
        if (description.includes(keyword)) {
          score += 0.1; // Each keyword match is worth 10 points
          matchedKeywords.push(keyword);
        }
      }
      
      // Check anti-keywords (negative weight)
      for (const antiKeyword of strategyConfig.antiKeywords) {
        if (description.includes(antiKeyword)) {
          score -= 0.15; // Each anti-keyword match loses 15 points
        }
      }
      
      // Artifact context bonus (if artifacts suggest this strategy)
      const artifactBonus = this._calculateArtifactBonus(artifacts, strategyConfig);
      score += artifactBonus;
      
      scores.set(strategyId, {
        score,
        matchedTriggers,
        matchedKeywords,
        config: strategyConfig
      });
    }
    
    // Find the highest scoring strategy
    let bestStrategy = null;
    let bestScore = 0;
    let bestMatch = null;
    
    for (const [strategyId, matchData] of scores) {
      if (matchData.score > bestScore) {
        bestScore = matchData.score;
        bestStrategy = strategyId;
        bestMatch = matchData;
      }
    }
    
    // Determine if we have a confident match
    const confidenceThreshold = 0.3; // Minimum score to use specialized strategy
    
    if (bestScore >= confidenceThreshold && bestMatch) {
      return {
        selectedStrategy: bestStrategy,
        confidence: Math.min(bestScore, 1.0),
        reasoning: `Matched triggers: [${bestMatch.matchedTriggers.join(', ')}], keywords: [${bestMatch.matchedKeywords.join(', ')}], score: ${bestScore.toFixed(2)}`,
        analysis: {
          allScores: Object.fromEntries(scores.entries()),
          topChoice: bestStrategy,
          score: bestScore
        }
      };
    } else {
      // Fall back to generic strategy
      const fallbackStrategy = this._determineFallbackStrategy(task);
      return {
        selectedStrategy: null,
        fallbackStrategy: fallbackStrategy,
        confidence: 0,
        reasoning: `No specialized strategy scored above threshold (${confidenceThreshold}). Best score: ${bestScore.toFixed(2)} for ${bestStrategy || 'none'}`
      };
    }
  }
  
  /**
   * Calculate bonus score based on existing artifacts
   * @private
   */
  _calculateArtifactBonus(artifacts, strategyConfig) {
    let bonus = 0;
    
    for (const [name, artifact] of Object.entries(artifacts)) {
      const content = artifact.value?.toLowerCase() || '';
      
      // Check if artifact content suggests this strategy
      for (const keyword of strategyConfig.keywords) {
        if (content.includes(keyword)) {
          bonus += 0.05; // Small bonus for relevant artifact content
        }
      }
    }
    
    return Math.min(bonus, 0.2); // Cap artifact bonus at 20 points
  }
  
  /**
   * Determine which generic strategy to fall back to
   * @private
   */
  _determineFallbackStrategy(task) {
    const description = task.description.toLowerCase();
    
    if (description.includes('test') || description.includes('testing')) {
      return 'testing';
    } else if (description.includes('debug') || description.includes('fix') || description.includes('error')) {
      return 'debugging';
    } else {
      return 'coding';
    }
  }
  
  /**
   * Create a fallback generic strategy
   * @private
   */
  _createFallbackStrategy(strategyType) {
    switch (strategyType) {
      case 'testing':
        return new TestWritingStrategy(this.llmClient, this.toolRegistry, this.options);
      case 'debugging':
        return new DebuggingStrategy(this.llmClient, this.toolRegistry, this.options);
      case 'coding':
      default:
        return new CodingStrategy(this.llmClient, this.toolRegistry, this.options);
    }
  }
  
  /**
   * Get information about all available specialized strategies
   * @returns {Array} Strategy information
   */
  getAvailableStrategies() {
    const strategies = [];
    
    for (const [id, config] of this.specializedStrategies) {
      strategies.push({
        id,
        name: config.strategy.name,
        keywords: config.keywords,
        confidence: config.confidence,
        description: `Specialized strategy for ${config.keywords.join(', ')} tasks`
      });
    }
    
    return strategies;
  }
  
  /**
   * Add or update a specialized strategy
   * @param {string} id - Strategy identifier
   * @param {Object} config - Strategy configuration
   */
  registerStrategy(id, config) {
    this.specializedStrategies.set(id, config);
    console.log(`📝 Registered specialized strategy: ${id}`);
  }
  
  /**
   * Remove a specialized strategy
   * @param {string} id - Strategy identifier
   */
  unregisterStrategy(id) {
    this.specializedStrategies.delete(id);
    console.log(`🗑️ Unregistered specialized strategy: ${id}`);
  }
}
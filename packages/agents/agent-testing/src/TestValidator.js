/**
 * TestValidator - Validates agent test results and behaviors
 * Provides comprehensive validation and verification capabilities
 */

export class TestValidator {
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    this.resourceManager = resourceManager;
    this.validationRules = new Map();
    this.customValidators = new Map();
    this.setupDefaultRules();
  }

  setupDefaultRules() {
    // Response format rules
    this.addRule('response_format', {
      name: 'Response Format',
      validate: (response) => {
        return response && 
               typeof response === 'object' &&
               'content' in response;
      },
      message: 'Response must be an object with content property'
    });

    // Content length rules
    this.addRule('min_length', {
      name: 'Minimum Length',
      validate: (response, params) => {
        const minLength = params.minLength || 1;
        return response.content && response.content.length >= minLength;
      },
      message: 'Response content must meet minimum length requirement'
    });

    this.addRule('max_length', {
      name: 'Maximum Length',
      validate: (response, params) => {
        const maxLength = params.maxLength || Infinity;
        return response.content && response.content.length <= maxLength;
      },
      message: 'Response content must not exceed maximum length'
    });

    // Content quality rules
    this.addRule('no_empty', {
      name: 'Non-Empty Response',
      validate: (response) => {
        return response.content && 
               response.content.trim().length > 0;
      },
      message: 'Response must not be empty'
    });

    this.addRule('complete_sentences', {
      name: 'Complete Sentences',
      validate: (response) => {
        const content = response.content || '';
        // Check for basic sentence structure
        return /[.!?]$/.test(content.trim());
      },
      message: 'Response should end with proper punctuation'
    });

    // Safety rules
    this.addRule('no_harmful_content', {
      name: 'Safe Content',
      validate: (response) => {
        const content = (response.content || '').toLowerCase();
        const harmfulPatterns = [
          'explosive', 'weapon', 'illegal', 
          'harmful', 'dangerous substance'
        ];
        return !harmfulPatterns.some(pattern => content.includes(pattern));
      },
      message: 'Response must not contain potentially harmful content'
    });

    // Consistency rules
    this.addRule('consistent_tone', {
      name: 'Consistent Tone',
      validate: (responses, params) => {
        if (!Array.isArray(responses) || responses.length < 2) {
          return true;
        }
        
        const expectedTone = params.tone || 'professional';
        const toneMarkers = this.getToneMarkers(expectedTone);
        
        return responses.every(response => {
          const content = (response.content || '').toLowerCase();
          return toneMarkers.some(marker => content.includes(marker));
        });
      },
      message: 'Responses must maintain consistent tone'
    });
  }

  getToneMarkers(tone) {
    const markers = {
      professional: ['would', 'please', 'thank you', 'certainly'],
      casual: ['hey', 'cool', 'awesome', 'sure'],
      formal: ['furthermore', 'therefore', 'regarding', 'pursuant'],
      friendly: ['happy', 'glad', 'pleasure', 'enjoy']
    };
    
    return markers[tone] || markers.professional;
  }

  // Rule Management
  addRule(name, rule) {
    this.validationRules.set(name, rule);
  }

  removeRule(name) {
    this.validationRules.delete(name);
  }

  addCustomValidator(name, validator) {
    this.customValidators.set(name, validator);
  }

  // Validation Methods
  async validate(response, rules = [], params = {}) {
    const results = {
      valid: true,
      passed: [],
      failed: [],
      warnings: []
    };

    // If no specific rules provided, use all default rules
    const rulesToApply = rules.length > 0 ? 
      rules : Array.from(this.validationRules.keys());

    for (const ruleName of rulesToApply) {
      const rule = this.validationRules.get(ruleName);
      
      if (!rule) {
        results.warnings.push(`Unknown rule: ${ruleName}`);
        continue;
      }

      try {
        const isValid = await rule.validate(response, params);
        
        if (isValid) {
          results.passed.push({
            rule: ruleName,
            name: rule.name
          });
        } else {
          results.valid = false;
          results.failed.push({
            rule: ruleName,
            name: rule.name,
            message: rule.message
          });
        }
      } catch (error) {
        results.warnings.push({
          rule: ruleName,
          error: error.message
        });
      }
    }

    return results;
  }

  async validateBatch(responses, rules = [], params = {}) {
    const batchResults = {
      totalResponses: responses.length,
      allValid: true,
      results: [],
      summary: null
    };

    for (const response of responses) {
      const result = await this.validate(response, rules, params);
      batchResults.results.push(result);
      
      if (!result.valid) {
        batchResults.allValid = false;
      }
    }

    batchResults.summary = this.generateValidationSummary(batchResults.results);
    return batchResults;
  }

  generateValidationSummary(results) {
    const summary = {
      total: results.length,
      valid: results.filter(r => r.valid).length,
      invalid: results.filter(r => !r.valid).length,
      commonFailures: {},
      commonWarnings: {}
    };

    // Analyze common failures
    for (const result of results) {
      for (const failure of result.failed) {
        if (!summary.commonFailures[failure.rule]) {
          summary.commonFailures[failure.rule] = 0;
        }
        summary.commonFailures[failure.rule]++;
      }
      
      for (const warning of result.warnings) {
        const key = warning.rule || warning;
        if (!summary.commonWarnings[key]) {
          summary.commonWarnings[key] = 0;
        }
        summary.commonWarnings[key]++;
      }
    }

    return summary;
  }

  // Specific Validation Methods
  async validateAgentResponse(agent, input, expectedBehavior) {
    const message = {
      type: 'message',
      content: input,
      sessionId: `validation-${Date.now()}`
    };

    const response = await agent.receive(message);
    
    const validationResult = await this.validate(response);
    
    // Check expected behavior
    if (expectedBehavior) {
      const behaviorValid = await this.validateBehavior(
        response, 
        expectedBehavior
      );
      
      if (!behaviorValid) {
        validationResult.valid = false;
        validationResult.failed.push({
          rule: 'expected_behavior',
          name: 'Expected Behavior',
          message: `Response does not match expected behavior: ${expectedBehavior}`
        });
      } else {
        validationResult.passed.push({
          rule: 'expected_behavior',
          name: 'Expected Behavior'
        });
      }
    }

    return validationResult;
  }

  async validateBehavior(response, expectedBehavior) {
    const content = (response.content || '').toLowerCase();

    switch (expectedBehavior) {
      case 'greeting':
        return ['hello', 'hi', 'greetings', 'welcome'].some(word => 
          content.includes(word)
        );
      
      case 'acknowledgment':
        return ['understood', 'got it', 'sure', 'okay', 'yes'].some(word =>
          content.includes(word)
        );
      
      case 'question':
        return content.includes('?');
      
      case 'explanation':
        return content.length > 50 && 
               ['because', 'therefore', 'thus', 'so'].some(word =>
                 content.includes(word)
               );
      
      case 'refusal':
        return ['cannot', "can't", 'unable', 'not possible'].some(phrase =>
          content.includes(phrase)
        );
      
      default:
        // Check if it's a custom validator
        const customValidator = this.customValidators.get(expectedBehavior);
        if (customValidator) {
          return await customValidator(response);
        }
        return true;
    }
  }

  // Pattern Matching Validation
  validatePattern(response, pattern) {
    const content = response.content || '';
    
    if (typeof pattern === 'string') {
      return content.includes(pattern);
    } else if (pattern instanceof RegExp) {
      return pattern.test(content);
    } else if (Array.isArray(pattern)) {
      return pattern.every(p => this.validatePattern(response, p));
    }
    
    return false;
  }

  validatePatterns(response, patterns, mode = 'all') {
    if (mode === 'all') {
      return patterns.every(pattern => this.validatePattern(response, pattern));
    } else if (mode === 'any') {
      return patterns.some(pattern => this.validatePattern(response, pattern));
    } else if (mode === 'none') {
      return !patterns.some(pattern => this.validatePattern(response, pattern));
    }
    
    throw new Error(`Invalid pattern validation mode: ${mode}`);
  }

  // Semantic Validation
  async validateSemanticSimilarity(response, expectedResponse, threshold = 0.7) {
    // Simple word overlap similarity for now
    const responseWords = new Set(
      response.content.toLowerCase().split(/\s+/)
    );
    const expectedWords = new Set(
      expectedResponse.toLowerCase().split(/\s+/)
    );
    
    const intersection = new Set(
      [...responseWords].filter(x => expectedWords.has(x))
    );
    const union = new Set([...responseWords, ...expectedWords]);
    
    const similarity = intersection.size / union.size;
    
    return {
      similar: similarity >= threshold,
      score: similarity
    };
  }

  // State Validation
  validateState(state, expectedState) {
    for (const [key, expectedValue] of Object.entries(expectedState)) {
      if (!(key in state)) {
        return {
          valid: false,
          error: `Missing state key: ${key}`
        };
      }
      
      if (typeof expectedValue === 'function') {
        if (!expectedValue(state[key])) {
          return {
            valid: false,
            error: `State validation failed for key: ${key}`
          };
        }
      } else if (state[key] !== expectedValue) {
        return {
          valid: false,
          error: `State mismatch for key ${key}: expected ${expectedValue}, got ${state[key]}`
        };
      }
    }
    
    return { valid: true };
  }

  // Performance Validation
  validatePerformance(metrics, requirements) {
    const results = {
      valid: true,
      passed: [],
      failed: []
    };

    if (requirements.maxResponseTime && 
        metrics.avgResponseTime > requirements.maxResponseTime) {
      results.valid = false;
      results.failed.push({
        metric: 'responseTime',
        expected: requirements.maxResponseTime,
        actual: metrics.avgResponseTime
      });
    } else if (requirements.maxResponseTime) {
      results.passed.push('responseTime');
    }

    if (requirements.minThroughput && 
        metrics.throughput < requirements.minThroughput) {
      results.valid = false;
      results.failed.push({
        metric: 'throughput',
        expected: requirements.minThroughput,
        actual: metrics.throughput
      });
    } else if (requirements.minThroughput) {
      results.passed.push('throughput');
    }

    if (requirements.maxErrorRate && 
        metrics.errorRate > requirements.maxErrorRate) {
      results.valid = false;
      results.failed.push({
        metric: 'errorRate',
        expected: requirements.maxErrorRate,
        actual: metrics.errorRate
      });
    } else if (requirements.maxErrorRate) {
      results.passed.push('errorRate');
    }

    if (requirements.maxMemoryUsage && 
        metrics.memoryDelta > requirements.maxMemoryUsage) {
      results.valid = false;
      results.failed.push({
        metric: 'memoryUsage',
        expected: requirements.maxMemoryUsage,
        actual: metrics.memoryDelta
      });
    } else if (requirements.maxMemoryUsage) {
      results.passed.push('memoryUsage');
    }

    return results;
  }

  // Comparison Validation
  compareResponses(response1, response2, criteria) {
    const comparison = {
      similar: false,
      differences: [],
      similarities: []
    };

    // Compare length
    const lengthDiff = Math.abs(
      response1.content.length - response2.content.length
    );
    
    if (lengthDiff < 50) {
      comparison.similarities.push('similar length');
    } else {
      comparison.differences.push('different lengths');
    }

    // Compare tone
    const tone1 = this.detectTone(response1.content);
    const tone2 = this.detectTone(response2.content);
    
    if (tone1 === tone2) {
      comparison.similarities.push('same tone');
    } else {
      comparison.differences.push('different tones');
    }

    // Compare key terms
    const words1 = new Set(response1.content.toLowerCase().split(/\s+/));
    const words2 = new Set(response2.content.toLowerCase().split(/\s+/));
    const commonWords = new Set([...words1].filter(x => words2.has(x)));
    
    const similarity = commonWords.size / Math.max(words1.size, words2.size);
    
    if (similarity > 0.5) {
      comparison.similarities.push('high word overlap');
      comparison.similar = true;
    } else {
      comparison.differences.push('low word overlap');
    }

    return comparison;
  }

  detectTone(text) {
    const content = text.toLowerCase();
    
    if (['please', 'thank you', 'would', 'could'].some(w => content.includes(w))) {
      return 'polite';
    }
    if (['furthermore', 'therefore', 'regarding'].some(w => content.includes(w))) {
      return 'formal';
    }
    if (['hey', 'cool', 'awesome'].some(w => content.includes(w))) {
      return 'casual';
    }
    
    return 'neutral';
  }
}
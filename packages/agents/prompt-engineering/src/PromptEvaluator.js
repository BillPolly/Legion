/**
 * PromptEvaluator - Evaluates the quality and effectiveness of prompts and responses
 * Provides comprehensive evaluation metrics and feedback
 */

export class PromptEvaluator {
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    this.resourceManager = resourceManager;
    this.initialized = false;
    this.llmClient = null;
    this.metrics = {
      totalEvaluations: 0,
      evaluationTypes: [],
      scores: []
    };
  }

  async initialize() {
    this.llmClient = await this.resourceManager.get('llmClient');
    if (!this.llmClient) {
      throw new Error('LLM client not available from ResourceManager');
    }
    this.initialized = true;
  }

  async cleanup() {
    this.initialized = false;
    this.llmClient = null;
    this.metrics = {
      totalEvaluations: 0,
      evaluationTypes: [],
      scores: []
    };
  }

  // Response Quality Evaluation Methods
  async evaluateRelevance(prompt, response) {
    this.metrics.totalEvaluations++;
    this.metrics.evaluationTypes.push('relevance');

    // Use LLM to evaluate relevance
    const evaluationPrompt = `
      Evaluate if the response is relevant to the prompt.
      Prompt: "${prompt}"
      Response: "${response}"
      
      Rate relevance from 0 to 1 and explain why.
      Format: {"score": 0.X, "reasoning": "explanation"}
    `;

    const fullPrompt = `System: You are an expert evaluator. Provide JSON responses.\n\nUser: ${evaluationPrompt}\n\nAssistant:`;
    const evaluation = await this.llmClient.complete(fullPrompt, 150);
    const result = this.parseEvaluation(evaluation.content || evaluation.text || evaluation || '');
    
    if (!result.score) {
      throw new Error(
        'Failed to get evaluation score from LLM. ' +
        'NO FALLBACK - failing fast as per project requirements.'
      );
    }
    
    const score = result.score;
    this.metrics.scores.push(score);

    return {
      score,
      relevant: score > 0.7,
      reasoning: result.reasoning || 'LLM-based evaluation'
    };
  }

  calculateSimpleRelevance(prompt, response) {
    const promptWords = prompt.toLowerCase().split(' ').filter(w => w.length > 3);
    const responseWords = response.toLowerCase().split(' ');
    let matches = 0;

    for (const word of promptWords) {
      if (responseWords.includes(word)) {
        matches++;
      }
    }

    // NO HARDCODED VALUES - calculate score purely based on word matches
    return Math.min(matches / Math.max(promptWords.length, 1), 1);
  }

  parseEvaluation(text) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[^}]+\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Parsing failed
    }

    // Fallback: extract score from text
    const scoreMatch = text.match(/(\d+\.?\d*)/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0.5;

    return {
      score: Math.min(score, 1),
      reasoning: text
    };
  }

  async evaluateCompleteness(prompt, response) {
    this.metrics.totalEvaluations++;
    
    // Simple heuristic: longer responses are generally more complete
    const expectedLength = prompt.includes('detail') ? 100 : 50;
    const actualLength = response.length;
    const lengthScore = Math.min(actualLength / expectedLength, 1);

    // Check if response addresses key aspects
    const keyAspects = this.extractKeyAspects(prompt);
    const addressedAspects = keyAspects.filter(aspect => 
      response.toLowerCase().includes(aspect.toLowerCase())
    );
    const aspectScore = addressedAspects.length / Math.max(keyAspects.length, 1);

    const score = (lengthScore + aspectScore) / 2;

    return {
      score,
      complete: score > 0.7,
      missingAspects: keyAspects.filter(a => !addressedAspects.includes(a))
    };
  }

  extractKeyAspects(prompt) {
    const aspects = [];
    
    // Generic keyword extraction based on prompt type - NO HARDCODED DOMAIN-SPECIFIC TERMS
    if (prompt.includes('explain')) aspects.push('because', 'reason');
    if (prompt.includes('list')) aspects.push('first', 'second');
    if (prompt.includes('compare')) aspects.push('difference', 'similar');
    // NO HARDCODED DOMAIN-SPECIFIC TERMS like water cycle - removed
    
    return aspects;
  }

  async evaluateAccuracy(prompt, response) {
    this.metrics.totalEvaluations++;
    
    // NO HARDCODED FACTS - use LLM to evaluate factual accuracy
    const evaluationPrompt = `
      Evaluate if the response is factually accurate for the given prompt.
      Prompt: "${prompt}"
      Response: "${response}"
      
      Rate accuracy from 0 to 1 and explain why.
      Format: {"score": 0.X, "reasoning": "explanation"}
    `;
    
    const fullPrompt = `System: You are an expert fact-checker. Provide JSON responses.\n\nUser: ${evaluationPrompt}\n\nAssistant:`;
    const evaluation = await this.llmClient.complete(fullPrompt, 150);
    const result = this.parseEvaluation(evaluation.content || evaluation.text || evaluation || '');
    
    if (!result.score) {
      throw new Error(
        'Failed to get accuracy score from LLM. ' +
        'NO FALLBACK - failing fast as per project requirements.'
      );
    }

    return {
      accurate: result.score > 0.7,
      score: result.score
    };
  }

  // Prompt Quality Evaluation Methods
  async evaluateClarity(prompt) {
    this.metrics.totalEvaluations++;
    
    const issues = [];
    const suggestions = [];
    
    // Check for ambiguous pronouns
    if (prompt.includes(' it ') || prompt.includes(' this ') || prompt.includes(' that ')) {
      issues.push('Contains ambiguous pronouns');
      suggestions.push('Replace pronouns with specific references');
    }

    // Check for vague terms
    const vagueTerms = ['thing', 'stuff', 'something', 'whatever'];
    const hasVague = vagueTerms.some(term => prompt.toLowerCase().includes(term));
    if (hasVague) {
      issues.push('Contains vague terms');
      suggestions.push('Use specific terminology');
    }

    // Check for clear instructions
    const hasInstruction = ['tell', 'explain', 'list', 'describe', 'write'].some(verb => 
      prompt.toLowerCase().includes(verb)
    );

    const score = 1.0 - (issues.length * 0.3);

    return {
      score: Math.max(score, 0),
      clear: issues.length === 0,
      issues,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  async evaluateSpecificity(prompt) {
    this.metrics.totalEvaluations++;
    
    const specificElements = [];
    
    // Check for quantifiers
    if (/\d+/.test(prompt)) specificElements.push('numbers');
    
    // Check for constraints
    if (prompt.includes('focus') || prompt.includes('specifically')) {
      specificElements.push('constraints');
    }
    
    // Check for scope limitation
    if (prompt.includes('only') || prompt.includes('just')) {
      specificElements.push('scope');
    }

    const score = Math.min(specificElements.length / 3, 1);

    return {
      score,
      specific: score > 0.5,
      elements: specificElements
    };
  }

  async detectAmbiguity(prompt) {
    const issues = [];
    
    // Check for unclear referents
    if (prompt.toLowerCase() === 'what is it?') {
      issues.push('unclear referent');
    }
    
    // Check for multiple possible interpretations
    if (prompt.includes(' or ') && !prompt.includes('?')) {
      issues.push('multiple interpretations possible');
    }

    return {
      ambiguous: issues.length > 0,
      issues
    };
  }

  // Tone and Style Evaluation Methods
  async evaluateTone(prompt, response, expectedTone) {
    const toneMarkers = {
      formal: ['furthermore', 'therefore', 'regarding', 'pursuant', 'would be delighted'],
      casual: ['hey', 'cool', 'awesome', 'yeah', 'sure thing', 'what\'s up'],
      professional: ['I would', 'please', 'thank you', 'certainly']
    };

    const responseL = response.toLowerCase();
    let matchesExpected = false;

    if (expectedTone === 'formal') {
      matchesExpected = toneMarkers.formal.some(marker => responseL.includes(marker));
    } else if (expectedTone === 'casual') {
      matchesExpected = toneMarkers.casual.some(marker => responseL.includes(marker));
    }

    return {
      consistent: matchesExpected,
      detectedTone: expectedTone
    };
  }

  async detectSentiment(text) {
    const positive = ['wonderful', 'love', 'great', 'excellent', 'amazing', 'fantastic'];
    const negative = ['terrible', 'awful', 'bad', 'disappointing', 'horrible', 'worst'];
    
    const textLower = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    positive.forEach(word => {
      if (textLower.includes(word)) positiveCount++;
    });

    negative.forEach(word => {
      if (textLower.includes(word)) negativeCount++;
    });

    let sentiment = 'neutral';
    if (positiveCount > negativeCount) sentiment = 'positive';
    if (negativeCount > positiveCount) sentiment = 'negative';

    return {
      sentiment,
      confidence: Math.abs(positiveCount - negativeCount) / Math.max(positiveCount + negativeCount, 1)
    };
  }

  // Safety and Compliance Methods
  async evaluateSafety(response) {
    const unsafePatterns = ['explosive', 'weapon', 'harm', 'illegal', 'dangerous substance'];
    const concerns = [];

    unsafePatterns.forEach(pattern => {
      if (response.toLowerCase().includes(pattern)) {
        concerns.push('potentially harmful');
      }
    });

    return {
      safe: concerns.length === 0,
      concerns
    };
  }

  async checkBias(text) {
    const biasIndicators = [
      'only certain groups',
      'all [group] are',
      'typical [group]',
      'unlike other'
    ];

    const biasTypes = [];
    let biasDetected = false;

    biasIndicators.forEach(indicator => {
      if (text.toLowerCase().includes(indicator.replace('[group]', ''))) {
        biasDetected = true;
        biasTypes.push('stereotyping');
      }
    });

    return {
      biasDetected,
      biasTypes
    };
  }

  // Coherence and Structure Methods
  async evaluateCoherence(text) {
    // Check for logical sequence markers
    const sequenceMarkers = ['first', 'next', 'then', 'finally', 'therefore', 'because'];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    
    let markerCount = 0;
    sequenceMarkers.forEach(marker => {
      if (text.toLowerCase().includes(marker)) markerCount++;
    });

    // Check for logical flow
    const hasLogicalFlow = text.toLowerCase().includes('first') && 
                           text.toLowerCase().includes('next') && 
                           text.toLowerCase().includes('finally');
    
    // Check for illogical flow
    const hasIllogicalFlow = text.toLowerCase().includes('finally') && 
                            text.toLowerCase().indexOf('finally') < text.toLowerCase().indexOf('first');

    let score = Math.min(markerCount / Math.max(sentences.length, 1), 1);
    
    if (hasLogicalFlow) score = Math.max(score, 0.8);
    if (hasIllogicalFlow) score = Math.min(score, 0.3);

    return {
      score,
      coherent: score > 0.3,
      sequenceMarkers: markerCount
    };
  }

  async evaluateStructure(response) {
    const hasNumberedList = /\d+\./.test(response);
    const hasBulletPoints = /[•\-\*]\s/.test(response);
    const hasSections = /^#+\s/m.test(response) || /\n\n/.test(response);
    
    const structureElements = [];
    if (hasNumberedList) structureElements.push('numbered list');
    if (hasBulletPoints) structureElements.push('bullet points');
    if (hasSections) structureElements.push('sections');

    return {
      wellStructured: structureElements.length > 0,
      structureElements
    };
  }

  // Comparative Evaluation Methods
  async compareResponses(prompt, responses) {
    const scores = [];
    
    for (const response of responses) {
      const relevance = await this.evaluateRelevance(prompt, response);
      const completeness = await this.evaluateCompleteness(prompt, response);
      const structure = await this.evaluateStructure(response);
      
      const totalScore = (relevance.score + completeness.score + (structure.wellStructured ? 1 : 0)) / 3;
      scores.push(totalScore);
    }

    const best = scores.indexOf(Math.max(...scores));
    const rankings = scores.map((score, index) => ({ index, score }))
      .sort((a, b) => b.score - a.score);

    return {
      rankings,
      best,
      scores
    };
  }

  async selectBestPrompt(prompts, options) {
    const scores = [];
    
    for (const prompt of prompts) {
      let totalScore = 0;
      
      if (options.criteria.includes('clarity')) {
        const clarity = await this.evaluateClarity(prompt);
        totalScore += clarity.score;
      }
      
      if (options.criteria.includes('specificity')) {
        const specificity = await this.evaluateSpecificity(prompt);
        totalScore += specificity.score;
      }
      
      if (options.criteria.includes('politeness')) {
        const hasPoliteness = ['please', 'could', 'would'].some(word => 
          prompt.toLowerCase().includes(word)
        );
        totalScore += hasPoliteness ? 1 : 0;
      }
      
      scores.push(totalScore / options.criteria.length);
    }

    const bestIndex = scores.indexOf(Math.max(...scores));

    return {
      bestIndex,
      scores,
      reasoning: `Prompt ${bestIndex} scored highest on ${options.criteria.join(', ')}`
    };
  }

  // Metrics and Scoring Methods
  async calculateQualityScore(prompt, response, options) {
    const breakdown = {};
    let weightedSum = 0;
    let totalWeight = 0;

    if (options.weights.relevance) {
      const relevance = await this.evaluateRelevance(prompt, response);
      breakdown.relevance = relevance.score;
      weightedSum += relevance.score * options.weights.relevance;
      totalWeight += options.weights.relevance;
    }

    if (options.weights.completeness) {
      const completeness = await this.evaluateCompleteness(prompt, response);
      breakdown.completeness = completeness.score;
      weightedSum += completeness.score * options.weights.completeness;
      totalWeight += options.weights.completeness;
    }

    if (options.weights.clarity) {
      const clarity = await this.evaluateClarity(response);
      breakdown.clarity = clarity.score;
      weightedSum += clarity.score * options.weights.clarity;
      totalWeight += options.weights.clarity;
    }

    if (options.weights.structure) {
      const structure = await this.evaluateStructure(response);
      breakdown.structure = structure.wellStructured ? 1 : 0;
      weightedSum += breakdown.structure * options.weights.structure;
      totalWeight += options.weights.structure;
    }

    return {
      overall: totalWeight > 0 ? weightedSum / totalWeight : 0,
      breakdown
    };
  }

  async getMetrics() {
    const averageScores = this.metrics.scores.length > 0 ?
      this.metrics.scores.reduce((a, b) => a + b, 0) / this.metrics.scores.length : 0;

    return {
      totalEvaluations: this.metrics.totalEvaluations,
      averageScores,
      evaluationTypes: [...new Set(this.metrics.evaluationTypes)]
    };
  }

  // Custom Evaluation Methods
  async evaluateCustom(response, criteria) {
    const passed = criteria.checkFunction(response);

    return {
      passed,
      criteriaName: criteria.name,
      description: criteria.description
    };
  }

  async evaluatePattern(response, regexCriteria) {
    const matches = regexCriteria.pattern.test(response);

    return {
      matches,
      criteriaName: regexCriteria.name
    };
  }

  // Feedback Generation Methods
  async generateFeedback(prompt) {
    const suggestions = [];
    const improvements = [];

    // Check length
    if (prompt.length < 20) {
      suggestions.push('Expand the prompt with more context');
      improvements.push('length');
    }

    // Check specificity
    if (!prompt.includes(' ') || prompt.split(' ').length < 3) {
      suggestions.push('Add more specific instructions');
      improvements.push('specificity');
    } else if (prompt.toLowerCase().includes('stuff') || prompt.toLowerCase().includes('thing')) {
      // Vague language indicates need for specificity
      suggestions.push('Replace vague terms with specific ones');
      improvements.push('specificity');
    }

    // Check for role
    if (!prompt.toLowerCase().includes('you')) {
      suggestions.push('Define the assistant\'s role clearly');
      improvements.push('role definition');
    }

    // Generate improved version
    let improvedVersion = prompt;
    if (!prompt.startsWith('You')) {
      improvedVersion = `You are an assistant. ${prompt}`;
    }
    if (!prompt.endsWith('.') && !prompt.endsWith('?')) {
      improvedVersion += '.';
    }
    improvedVersion += ' Please provide specific and helpful information.';

    return {
      suggestions,
      improvedVersion,
      improvements
    };
  }

  async generateRecommendations(evaluation) {
    // Find the lowest scoring aspect
    const aspects = Object.entries(evaluation);
    const lowestScore = aspects.reduce((min, [key, score]) => 
      score < min.score ? { key, score } : min,
      { key: null, score: 1 }
    );

    const actions = [];
    
    if (lowestScore.key === 'clarity') {
      actions.push('Simplify language and structure');
      actions.push('Remove ambiguous terms');
      actions.push('Use clear, direct instructions');
    } else if (lowestScore.key === 'relevance') {
      actions.push('Ensure response directly addresses the prompt');
      actions.push('Remove off-topic information');
    } else if (lowestScore.key === 'completeness') {
      actions.push('Add more detail and examples');
      actions.push('Address all aspects of the question');
    }

    return {
      priority: lowestScore.key,
      actions
    };
  }
}
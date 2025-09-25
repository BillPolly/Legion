/**
 * Quality Assessment Entity
 * 
 * Represents code quality evaluation results from quality assessment prompts.
 * Used to track and improve code quality across projects.
 */

import { BaseEntity } from './BaseEntity.js';

export class QualityAssessmentEntity extends BaseEntity {
  constructor(data = {}) {
    super(data);
  }

  static getEntityType() {
    return 'assessment';
  }

  static getSchema() {
    return {
      ':assessment/code': { type: 'ref', cardinality: 'one' }, // Reference to file being assessed
      ':assessment/score': { type: 'float', cardinality: 'one' }, // 0-10 quality score
      ':assessment/issues': { type: 'string', cardinality: 'many' },
      ':assessment/strengths': { type: 'string', cardinality: 'many' },
      ':assessment/criteria': { type: 'string', cardinality: 'one' }, // JSON string of criteria used
      ':assessment/timestamp': { type: 'instant', cardinality: 'one' },
      ':assessment/project': { type: 'ref', cardinality: 'one' },
    };
  }

  static getRequiredFields() {
    return [':assessment/code', ':assessment/score', ':assessment/project'];
  }

  // Getters and setters
  get codeId() {
    return this.getField('code');
  }

  set codeId(value) {
    this.setField('code', value);
  }

  get score() {
    return this.getField('score');
  }

  set score(value) {
    const numScore = parseFloat(value);
    if (isNaN(numScore) || numScore < 0 || numScore > 10) {
      throw new Error('Score must be a number between 0 and 10');
    }
    this.setField('score', numScore);
  }

  get issues() {
    return this.getField('issues') || [];
  }

  set issues(value) {
    this.setField('issues', Array.isArray(value) ? value : [value]);
  }

  get strengths() {
    return this.getField('strengths') || [];
  }

  set strengths(value) {
    this.setField('strengths', Array.isArray(value) ? value : [value]);
  }

  get criteria() {
    const criteriaData = this.getField('criteria');
    return criteriaData ? JSON.parse(criteriaData) : {};
  }

  set criteria(value) {
    this.setField('criteria', JSON.stringify(value || {}));
  }

  get timestamp() {
    return this.getField('timestamp');
  }

  set timestamp(value) {
    this.setField('timestamp', value instanceof Date ? value : new Date(value));
  }

  get projectId() {
    return this.getField('project');
  }

  set projectId(value) {
    this.setField('project', value);
  }

  // Helper methods
  addIssue(issue) {
    const existing = this.issues;
    this.issues = [...existing, issue];
  }

  removeIssue(issue) {
    const existing = this.issues;
    this.issues = existing.filter(i => i !== issue);
  }

  addStrength(strength) {
    const existing = this.strengths;
    this.strengths = [...existing, strength];
  }

  removeStrength(strength) {
    const existing = this.strengths;
    this.strengths = existing.filter(s => s !== strength);
  }

  // Quality level methods
  isExceptional() {
    return this.score >= 9;
  }

  isGood() {
    return this.score >= 7 && this.score < 9;
  }

  isAcceptable() {
    return this.score >= 5 && this.score < 7;
  }

  needsWork() {
    return this.score >= 3 && this.score < 5;
  }

  isPoor() {
    return this.score < 3;
  }

  getQualityLevel() {
    if (this.isExceptional()) return 'exceptional';
    if (this.isGood()) return 'good';
    if (this.isAcceptable()) return 'acceptable';
    if (this.needsWork()) return 'needs-work';
    return 'poor';
  }

  getQualityDescription() {
    const level = this.getQualityLevel();
    const descriptions = {
      'exceptional': 'Production-ready, exceptional quality',
      'good': 'Good quality with minor improvements needed',
      'acceptable': 'Acceptable but needs refinement',
      'needs-work': 'Significant issues, needs major work',
      'poor': 'Poor quality, requires rewrite'
    };
    return descriptions[level];
  }

  // Calculate weighted scores by category
  setCriteriaScores(structure, practices, readability, maintainability, performance) {
    const criteria = {
      structure: { score: structure, weight: 0.30 },
      practices: { score: practices, weight: 0.25 },
      readability: { score: readability, weight: 0.20 },
      maintainability: { score: maintainability, weight: 0.15 },
      performance: { score: performance, weight: 0.10 }
    };
    
    this.criteria = criteria;
    
    // Calculate weighted average
    const weightedScore = Object.values(criteria).reduce((sum, category) => {
      return sum + (category.score * category.weight);
    }, 0);
    
    this.score = Math.round(weightedScore * 10) / 10; // Round to 1 decimal
  }

  // Factory methods
  static create(codeId, projectId, score = 0) {
    return new QualityAssessmentEntity({
      ':assessment/code': codeId,
      ':assessment/project': projectId,
      ':assessment/score': score,
      ':assessment/issues': [],
      ':assessment/strengths': [],
      ':assessment/criteria': JSON.stringify({}),
      ':assessment/timestamp': new Date()
    });
  }

  // Create from prompt response
  static fromPromptResponse(response, codeId, projectId) {
    const assessment = new QualityAssessmentEntity({
      ':assessment/code': codeId,
      ':assessment/project': projectId,
      ':assessment/score': response.score,
      ':assessment/issues': response.issues || [],
      ':assessment/strengths': response.strengths || [],
      ':assessment/criteria': JSON.stringify({}),
      ':assessment/timestamp': new Date()
    });
    
    return assessment;
  }

  // Convert to format for prompts
  toPromptFormat() {
    return {
      score: this.score,
      issues: this.issues,
      strengths: this.strengths,
      criteria: this.criteria,
      qualityLevel: this.getQualityLevel(),
      description: this.getQualityDescription()
    };
  }

  // Validation specific to quality assessments
  validate() {
    const baseValid = super.validate();
    
    if (this.score < 0 || this.score > 10) {
      this._errors.push('Score must be between 0 and 10');
    }
    
    if (!this.timestamp) {
      this._errors.push('Timestamp is required');
    }
    
    return this._errors.length === 0 && baseValid;
  }

  // Compare with another assessment
  compareTo(otherAssessment) {
    return {
      scoreDiff: this.score - otherAssessment.score,
      newIssues: this.issues.filter(issue => !otherAssessment.issues.includes(issue)),
      resolvedIssues: otherAssessment.issues.filter(issue => !this.issues.includes(issue)),
      newStrengths: this.strengths.filter(strength => !otherAssessment.strengths.includes(strength)),
      improved: this.score > otherAssessment.score
    };
  }
}
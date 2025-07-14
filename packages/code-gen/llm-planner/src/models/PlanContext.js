/**
 * PlanContext model - Represents the context and constraints for a plan
 */

class PlanContext {
  constructor(data = {}) {
    // Project type validation
    const validTypes = ['frontend', 'backend', 'fullstack', 'api', 'library', 'cli', 'unknown'];
    this.projectType = data.projectType || 'unknown';
    if (!validTypes.includes(this.projectType)) {
      this.projectType = 'unknown';
    }
    
    // Technologies - normalize to arrays
    this.technologies = this._normalizeTechnologies(data.technologies || {});
    
    // Goals
    this.goals = Array.isArray(data.goals) ? [...data.goals] : [];
    
    // Constraints and requirements
    this.constraints = data.constraints || {};
    this.requirements = {
      functional: data.requirements?.functional || [],
      nonFunctional: data.requirements?.nonFunctional || [],
      ...data.requirements
    };
    
    // Environment configuration
    this.environment = data.environment || {};
    
    // Metadata
    this.metadata = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data.metadata
    };
  }

  /**
   * Normalize technologies to ensure all are arrays
   * @private
   */
  _normalizeTechnologies(technologies) {
    const normalized = {};
    
    for (const [category, tech] of Object.entries(technologies)) {
      if (Array.isArray(tech)) {
        normalized[category] = [...tech];
      } else if (typeof tech === 'string') {
        normalized[category] = [tech];
      } else {
        normalized[category] = [];
      }
    }
    
    return normalized;
  }

  /**
   * Update metadata timestamp
   * @private
   */
  _updateMetadata() {
    this.metadata.updatedAt = new Date().toISOString();
  }

  /**
   * Add a technology to a category
   * @param {string} category - Technology category
   * @param {string} technology - Technology to add
   */
  addTechnology(category, technology) {
    if (!this.technologies[category]) {
      this.technologies[category] = [];
    }
    
    if (!this.technologies[category].includes(technology)) {
      this.technologies[category].push(technology);
      this._updateMetadata();
    }
  }

  /**
   * Remove a technology from a category
   * @param {string} category - Technology category
   * @param {string} technology - Technology to remove
   */
  removeTechnology(category, technology) {
    if (this.technologies[category]) {
      this.technologies[category] = this.technologies[category].filter(
        tech => tech !== technology
      );
      this._updateMetadata();
    }
  }

  /**
   * Add or update a constraint
   * @param {string} key - Constraint key
   * @param {*} value - Constraint value
   */
  addConstraint(key, value) {
    if (typeof value === 'object' && !Array.isArray(value) && this.constraints[key]) {
      // Merge objects
      this.constraints[key] = { ...this.constraints[key], ...value };
    } else {
      this.constraints[key] = value;
    }
    this._updateMetadata();
  }

  /**
   * Add a requirement
   * @param {string} type - 'functional' or 'nonFunctional'
   * @param {string} requirement - Requirement description
   */
  addRequirement(type, requirement) {
    if (!this.requirements[type]) {
      this.requirements[type] = [];
    }
    
    if (!this.requirements[type].includes(requirement)) {
      this.requirements[type].push(requirement);
      this._updateMetadata();
    }
  }

  /**
   * Get all technologies as a flat array
   * @returns {Array<string>} All technologies
   */
  getAllTechnologies() {
    const allTech = [];
    
    for (const techArray of Object.values(this.technologies)) {
      allTech.push(...techArray);
    }
    
    return allTech;
  }

  /**
   * Check if has a specific technology
   * @param {string} technology - Technology to check
   * @returns {boolean} Has technology
   */
  hasTechnology(technology) {
    return this.getAllTechnologies().includes(technology);
  }

  /**
   * Check if has a specific constraint
   * @param {string} constraint - Constraint to check
   * @returns {boolean} Has constraint
   */
  hasConstraint(constraint) {
    return constraint in this.constraints;
  }

  /**
   * Validate context completeness
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];
    
    // Check project type
    if (this.projectType === 'unknown') {
      errors.push('Project type is unknown');
    }
    
    // Check technologies
    if (Object.keys(this.technologies).length === 0 || 
        this.getAllTechnologies().length === 0) {
      warnings.push('No technologies specified');
    }
    
    // Check requirements
    if (this.requirements.functional.length === 0 && 
        this.requirements.nonFunctional.length === 0) {
      warnings.push('No requirements specified');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Merge with another context
   * @param {PlanContext} otherContext - Context to merge with
   * @returns {PlanContext} New merged context
   */
  merge(otherContext) {
    const mergedData = {
      projectType: this.projectType, // Keep original project type
      technologies: {},
      constraints: { ...this.constraints, ...otherContext.constraints },
      requirements: {
        functional: [...this.requirements.functional],
        nonFunctional: [...this.requirements.nonFunctional]
      },
      environment: { ...this.environment, ...otherContext.environment },
      metadata: {
        ...this.metadata,
        updatedAt: new Date().toISOString()
      }
    };
    
    // Merge technologies
    const allCategories = new Set([
      ...Object.keys(this.technologies),
      ...Object.keys(otherContext.technologies)
    ]);
    
    for (const category of allCategories) {
      const techs = new Set([
        ...(this.technologies[category] || []),
        ...(otherContext.technologies[category] || [])
      ]);
      mergedData.technologies[category] = Array.from(techs);
    }
    
    // Merge requirements
    if (otherContext.requirements.functional) {
      const functionalSet = new Set([
        ...mergedData.requirements.functional,
        ...otherContext.requirements.functional
      ]);
      mergedData.requirements.functional = Array.from(functionalSet);
    }
    
    if (otherContext.requirements.nonFunctional) {
      const nonFunctionalSet = new Set([
        ...mergedData.requirements.nonFunctional,
        ...otherContext.requirements.nonFunctional
      ]);
      mergedData.requirements.nonFunctional = Array.from(nonFunctionalSet);
    }
    
    return new PlanContext(mergedData);
  }

  /**
   * Clone the context
   * @returns {PlanContext} Cloned context
   */
  clone() {
    return new PlanContext(JSON.parse(JSON.stringify({
      projectType: this.projectType,
      technologies: this.technologies,
      goals: this.goals,
      constraints: this.constraints,
      requirements: this.requirements,
      environment: this.environment,
      metadata: this.metadata
    })));
  }

  /**
   * Export to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      projectType: this.projectType,
      technologies: this.technologies,
      goals: this.goals,
      constraints: this.constraints,
      requirements: this.requirements,
      environment: this.environment,
      metadata: this.metadata
    };
  }

  /**
   * Create from JSON
   * @param {Object} json - JSON data
   * @returns {PlanContext} PlanContext instance
   */
  static fromJSON(json) {
    return new PlanContext(json);
  }

  /**
   * Generate summary of context
   * @returns {string} Summary
   */
  getSummary() {
    const parts = [];
    
    parts.push(`Project Type: ${this.projectType}`);
    
    // Technologies summary
    const techCount = this.getAllTechnologies().length;
    if (techCount > 0) {
      const mainTechs = [];
      if (this.technologies.frontend?.length > 0) {
        // For vanilla JS, show javascript
        const hasJs = this.technologies.frontend.includes('javascript');
        if (hasJs) {
          mainTechs.push('javascript');
        } else {
          mainTechs.push(this.technologies.frontend[0]);
        }
      }
      if (this.technologies.backend?.length > 0) {
        mainTechs.push(this.technologies.backend[0]);
      }
      parts.push(`Technologies: ${mainTechs.join(', ')} (${techCount} total)`);
    }
    
    // Requirements summary
    const funcCount = this.requirements.functional?.length || 0;
    const nonFuncCount = this.requirements.nonFunctional?.length || 0;
    if (funcCount > 0) {
      parts.push(`${funcCount} functional requirements`);
    }
    if (nonFuncCount > 0) {
      parts.push(`${nonFuncCount} non-functional requirements`);
    }
    
    // Constraints summary
    const constraintCount = Object.keys(this.constraints).length;
    if (constraintCount > 0) {
      parts.push(`${constraintCount} constraints`);
    }
    
    return parts.join('\n');
  }

  /**
   * Infer project complexity based on context
   * @returns {string} Complexity level
   */
  inferComplexity() {
    let score = 0;
    
    // Technology diversity
    const techCount = this.getAllTechnologies().length;
    score += techCount > 10 ? 3 : techCount > 5 ? 2 : 1;
    
    // Project type
    if (this.projectType === 'fullstack') {
      score += 2;
    } else if (this.projectType === 'unknown') {
      score -= 1;
    }
    
    // Requirements
    const totalReqs = (this.requirements.functional?.length || 0) + 
                      (this.requirements.nonFunctional?.length || 0);
    score += totalReqs > 10 ? 3 : totalReqs > 5 ? 2 : totalReqs > 0 ? 1 : 0;
    
    // Constraints
    const constraintCount = Object.keys(this.constraints).length;
    score += constraintCount > 5 ? 2 : constraintCount > 2 ? 1 : 0;
    
    // Determine complexity
    if (score >= 8) {
      return 'complex';
    } else if (score >= 4) {
      return 'moderate';
    } else {
      return 'simple';
    }
  }

  /**
   * Create a frontend project context
   * @static
   */
  static createFrontendContext(options = {}) {
    const context = new PlanContext({
      projectType: 'frontend',
      technologies: {
        frontend: ['html', 'css', 'javascript'],
        tools: ['git', 'npm']
      }
    });
    
    if (options.testing) {
      context.addTechnology('tools', 'jest');
      context.addTechnology('tools', 'eslint');
    }
    
    return context;
  }

  /**
   * Create a backend project context
   * @static
   */
  static createBackendContext(options = {}) {
    const context = new PlanContext({
      projectType: 'backend',
      technologies: {
        backend: ['nodejs', options.framework || 'express'],
        tools: ['git', 'npm']
      }
    });
    
    return context;
  }

  /**
   * Create a fullstack project context
   * @static
   */
  static createFullstackContext(options = {}) {
    const context = new PlanContext({
      projectType: 'fullstack',
      technologies: {
        frontend: ['html', 'css', 'javascript'],
        backend: ['nodejs', options.backend?.framework || 'express'],
        tools: ['git', 'npm']
      }
    });
    
    return context;
  }
}

export { PlanContext };

/**
 * PlanningPhase - Handles project planning and architecture design
 * 
 * Responsible for analyzing requirements and creating project plans
 * using the UnifiedPlanner system.
 */

class PlanningPhase {
  constructor(codeAgent) {
    this.codeAgent = codeAgent;
    this.unifiedPlanner = codeAgent.unifiedPlanner;
  }

  /**
   * Plan the project structure and architecture
   * @param {Object} requirements - Project requirements and specifications
   * @returns {Promise<Object>} Project plan with all architectural decisions
   */
  async planProject(requirements) {
    this.codeAgent.emit('progress', {
      phase: 'planning',
      step: 'analyzing-requirements',
      message: '🔍 Analyzing requirements...'
    });
    
    // Use unified planner to analyze requirements
    const analysis = await this.unifiedPlanner.analyzeRequirements(requirements);
    
    this.codeAgent.emit('progress', {
      phase: 'planning',
      step: 'analysis-complete',
      message: `📊 Analysis complete: ${analysis.projectType} project with ${analysis.complexity} complexity`,
      data: { projectType: analysis.projectType, complexity: analysis.complexity }
    });
    
    // Plan directory structure
    this.codeAgent.emit('progress', {
      phase: 'planning',
      step: 'directory-structure',
      message: '📁 Planning directory structure...'
    });
    const directoryStructure = await this.unifiedPlanner.planDirectoryStructure(analysis);
    
    // Plan file dependencies
    this.codeAgent.emit('progress', {
      phase: 'planning',
      step: 'file-dependencies',
      message: '🔗 Planning file dependencies...'
    });
    const dependencies = await this.unifiedPlanner.planDependencies(directoryStructure, analysis);
    
    // Plan architecture based on project type
    let frontendArchitecture = null;
    let backendArchitecture = null;
    let apiInterface = null;
    
    if (analysis.projectType === 'frontend' || analysis.projectType === 'fullstack') {
      this.codeAgent.emit('progress', {
        phase: 'planning',
        step: 'frontend-architecture',
        message: '🎨 Planning frontend architecture...'
      });
      frontendArchitecture = await this.unifiedPlanner.planFrontendArchitecture(analysis);
    }
    
    if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
      this.codeAgent.emit('progress', {
        phase: 'planning',
        step: 'backend-architecture',
        message: '⚙️ Planning backend architecture...'
      });
      backendArchitecture = await this.unifiedPlanner.planBackendArchitecture(analysis);
    }
    
    if (analysis.projectType === 'fullstack') {
      this.codeAgent.emit('progress', {
        phase: 'planning',
        step: 'api-interface',
        message: '🔌 Planning API interface...'
      });
      apiInterface = await this.unifiedPlanner.planAPIInterface(frontendArchitecture, backendArchitecture);
    }
    
    // Plan test strategy
    this.codeAgent.emit('progress', {
      phase: 'planning',
      step: 'test-strategy',
      message: '🧪 Planning test strategy...'
    });
    const testStrategy = await this.unifiedPlanner.planTestStrategy(analysis);
    
    // Store project plan in CodeAgent
    const projectPlan = {
      analysis,
      directoryStructure,
      dependencies,
      frontendArchitecture,
      backendArchitecture,
      apiInterface,
      testStrategy,
      timestamp: new Date()
    };
    
    this.codeAgent.projectPlan = projectPlan;
    this.codeAgent.currentTask.status = 'generating';
    await this.codeAgent.saveState();
    
    this.codeAgent.emit('phase-complete', {
      phase: 'planning',
      message: 'Project planning complete',
      projectPlan
    });
    return projectPlan;
  }
}

export { PlanningPhase };
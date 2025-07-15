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
    console.log('🔍 Analyzing requirements...');
    
    // Use unified planner to analyze requirements
    const analysis = await this.unifiedPlanner.analyzeRequirements(requirements);
    
    console.log(`📊 Analysis complete: ${analysis.projectType} project with ${analysis.complexity} complexity`);
    
    // Plan directory structure
    console.log('📁 Planning directory structure...');
    const directoryStructure = await this.unifiedPlanner.planDirectoryStructure(analysis);
    
    // Plan file dependencies
    console.log('🔗 Planning file dependencies...');
    const dependencies = await this.unifiedPlanner.planDependencies(directoryStructure, analysis);
    
    // Plan architecture based on project type
    let frontendArchitecture = null;
    let backendArchitecture = null;
    let apiInterface = null;
    
    if (analysis.projectType === 'frontend' || analysis.projectType === 'fullstack') {
      console.log('🎨 Planning frontend architecture...');
      frontendArchitecture = await this.unifiedPlanner.planFrontendArchitecture(analysis);
    }
    
    if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
      console.log('⚙️ Planning backend architecture...');
      backendArchitecture = await this.unifiedPlanner.planBackendArchitecture(analysis);
    }
    
    if (analysis.projectType === 'fullstack') {
      console.log('🔌 Planning API interface...');
      apiInterface = await this.unifiedPlanner.planAPIInterface(frontendArchitecture, backendArchitecture);
    }
    
    // Plan test strategy
    console.log('🧪 Planning test strategy...');
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
    
    console.log('✅ Project planning complete');
    return projectPlan;
  }
}

export { PlanningPhase };
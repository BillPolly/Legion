/**
 * SD Package - Software Development autonomous agent system
 * 
 * Main entry point for the SD package
 */

// Export the main module
export { default as SDModule } from './SDModule.js';
export { default } from './SDModule.js';

// Export agents
export { SDAgentBase } from './agents/SDAgentBase.js';
export { RequirementsAgent } from './agents/RequirementsAgent.js';
export { DomainModelingAgent } from './agents/DomainModelingAgent.js';
export { ArchitectureAgent } from './agents/ArchitectureAgent.js';
export { StateDesignAgent } from './agents/StateDesignAgent.js';
export { FluxAgent } from './agents/FluxAgent.js';
export { TestGenerationAgent } from './agents/TestGenerationAgent.js';
export { CodeGenerationAgent } from './agents/CodeGenerationAgent.js';
export { QualityAssuranceAgent } from './agents/QualityAssuranceAgent.js';

// Export tools
export { RequirementParserTool } from './tools/requirements/RequirementParserTool.js';
export { UserStoryGeneratorTool } from './tools/requirements/UserStoryGeneratorTool.js';
export { AcceptanceCriteriaGeneratorTool } from './tools/requirements/AcceptanceCriteriaGeneratorTool.js';

export { BoundedContextGeneratorTool } from './tools/domain/BoundedContextGeneratorTool.js';
export { EntityModelingTool } from './tools/domain/EntityModelingTool.js';
export { ValueObjectIdentifierTool } from './tools/domain/ValueObjectIdentifierTool.js';
export { AggregateDesignTool } from './tools/domain/AggregateDesignTool.js';
export { DomainEventExtractorTool } from './tools/domain/DomainEventExtractorTool.js';

export { LayerGeneratorTool } from './tools/architecture/LayerGeneratorTool.js';
export { UseCaseGeneratorTool } from './tools/architecture/UseCaseGeneratorTool.js';
export { InterfaceDesignTool } from './tools/architecture/InterfaceDesignTool.js';

export { DatabaseConnectionTool } from './tools/database/DatabaseConnectionTool.js';
export { ArtifactStorageTool } from './tools/database/ArtifactStorageTool.js';
export { ContextRetrievalTool } from './tools/database/ContextRetrievalTool.js';

// Export profiles
export { SDPlanningProfile } from './profiles/SDPlanningProfile.js';

// Module metadata
export const metadata = {
  name: '@legion/sd',
  version: '1.0.0',
  description: 'Software Development autonomous agent system for Legion',
  methodologies: [
    'Domain-Driven Design (DDD)',
    'Clean Architecture',
    'Immutable Design',
    'Flux Architecture',
    'Test-Driven Development (TDD)',
    'Clean Code'
  ]
};
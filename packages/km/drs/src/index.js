/**
 * DRS Package - Main Entry Point
 *
 * This package implements the DRS (Discourse Representation Structure) semantic parsing pipeline.
 * It transforms natural language text into structured semantic representations.
 */

// Main API
export { DRSOrchestrator } from './DRSOrchestrator.js';

// Stages
export { Stage0_MemoryInit } from './stages/Stage0_MemoryInit.js';
export { Stage1_MentionExtraction } from './stages/Stage1_MentionExtraction.js';
export { Stage2_CoreferenceResolution } from './stages/Stage2_CoreferenceResolution.js';
export { Stage3_EventExtraction } from './stages/Stage3_EventExtraction.js';
export { Stage4_ScopePlanning } from './stages/Stage4_ScopePlanning.js';
export { Stage5_DRSBuilder } from './stages/Stage5_DRSBuilder.js';
export { Stage6_DRSValidation } from './stages/Stage6_DRSValidation.js';

// Types
export { Span } from './types/Span.js';
export { Mention } from './types/Mention.js';
export { Entity } from './types/Entity.js';
export { Event } from './types/Event.js';
export { UnaryFact } from './types/UnaryFact.js';
export { BinaryFact } from './types/BinaryFact.js';
export { DiscourseMemory } from './types/DiscourseMemory.js';
export { ScopePlan } from './types/ScopePlan.js';
export { ClausalDRS } from './types/ClausalDRS.js';
export { RelationInventory } from './types/RelationInventory.js';

// Validators
export { MentionValidator } from './validators/MentionValidator.js';
export { EntityValidator } from './validators/EntityValidator.js';
export { EventValidator } from './validators/EventValidator.js';
export { ScopeValidator } from './validators/ScopeValidator.js';
export { DRSValidator } from './validators/DRSValidator.js';

// Errors
export { ValidationError } from './errors/ValidationError.js';

// Utilities
export { SentenceSplitter } from './utils/SentenceSplitter.js';
export { DRSToText } from './utils/DRSToText.js';
export { SemanticEquivalenceEvaluator } from './utils/SemanticEquivalenceEvaluator.js';

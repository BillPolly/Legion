/**
 * @legion/query-understanding - Natural Language Query Understanding & Generation
 *
 * Transforms natural language questions into executable queries against knowledge bases.
 *
 * Architecture:
 * - Phase 1 (LLM): Rewrite & Resolve - Normalize questions, resolve references
 * - Phase 2 (Deterministic): NP/VP AST - Parse into minimal tree structure
 * - Phase 3 (Semantic Search): Semantic Mapping - Map to ontology concepts
 * - Phase 4 (DataSource): Query Generation - Convert to DataScript queries
 *
 * @module @legion/query-understanding
 */

export { QueryUnderstandingPipeline } from './QueryUnderstandingPipeline.js';

// Phase processors
export { RewriteResolver } from './phase1/RewriteResolver.js';

// TODO: Export remaining phase processors as they are implemented
// export { NPVPParser } from './phase2/NPVPParser.js';
// export { SemanticMapper } from './phase3/SemanticMapper.js';
// export { DataScriptConverter } from './phase4/DataScriptConverter.js';

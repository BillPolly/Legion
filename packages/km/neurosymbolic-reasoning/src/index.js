// Main API
export { ProofOfThought } from './core/ProofOfThought.js';

// Core components
export { ProgramGenerator } from './reasoning/ProgramGenerator.js';
export { Verifier } from './reasoning/Verifier.js';
export { PromptTemplate } from './reasoning/PromptTemplate.js';
export { createDefaultZ3Prompt } from './reasoning/default-prompt.js';

// Solvers
export { Z3Solver } from './solvers/Z3Solver.js';
export { Z3DescriptionLogicSolver } from './solvers/Z3DescriptionLogicSolver.js';
export { AbstractSolver } from './solvers/AbstractSolver.js';

// Ontology Verification
export { OntologyVerifier } from './ontology/OntologyVerifier.js';
export { OWLAxiomEncoder } from './ontology/OWLAxiomEncoder.js';

// DSL
export { Sorts, isValidSort, getSortType } from './dsl/Sorts.js';
export {
  ExpressionType,
  isValidExpressionType,
  validateExpression,
  parseExpression
} from './dsl/Expressions.js';

// Schema
export {
  z3ProgramSchema,
  validateZ3Program,
  parseZ3Program
} from './schemas/z3-program-schema.js';

// Utils
export {
  accuracyScore,
  confusionMatrix,
  precisionScore,
  recallScore,
  f1Score
} from './utils/evaluation-metrics.js';

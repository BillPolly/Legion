// Handle DSL - Universal Template Literal DSL for Handle Operations
// Works with any Handle type, not tied to specific implementations

export { handle, h } from './src/handle-dsl.js';
export { query, q } from './src/query-dsl.js';
export { update, u } from './src/update-dsl.js';
export { subscribe, s } from './src/subscribe-dsl.js';
export { transform, t } from './src/transform-dsl.js';
export { DSLParser } from './src/parser.js';
export { HandleDSLEngine } from './src/engine.js';
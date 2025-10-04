/**
 * @legion/declarative-components
 * 
 * Declarative component system with unified JSON component definition
 * Both CNL and DSL compile to the same JSON format for runtime execution
 */

// Core DOM projection system
export { DOMElementProxy } from './core/DOMElementProxy.js';
export { ProjectionRoot } from './core/ProjectionRoot.js';
export { EventStream } from './core/EventStream.js';

// Compilation pipeline
export { ComponentCompiler } from './compiler/ComponentCompiler.js';
export { Parser } from './compiler/Parser.js';
export { Tokenizer } from './compiler/Tokenizer.js';
export { CodeGenerator } from './compiler/CodeGenerator.js';

// CNL (Controlled Natural Language) system
export { CNLParser } from './cnl/CNLParser.js';
export { CNLTranspiler } from './cnl/CNLTranspiler.js';
export { cnlToJSON, cnlToDSL } from './cnl/CNLTranspiler.js';
export { DSLParser } from './cnl/DSLParser.js';

// Bidirectional converters (JSON ↔ DSL ↔ CNL)
export { DSLToCNLConverter, dslToCNL } from './cnl/DSLToCNLConverter.js';
export { JsonToDSLConverter, jsonToDSL } from './cnl/JsonToDSLConverter.js';
export { JsonToCNLConverter, jsonToCNL } from './cnl/JsonToCNLConverter.js';

// DSL helpers
export { component, componentFromString } from './dsl/component.js';

// Component lifecycle and runtime
export { ComponentLifecycle } from './lifecycle/ComponentLifecycle.js';

// Equation solver for reactive bindings
export { EquationSolver } from './solver/EquationSolver.js';
export { SubscriptionManager } from './solver/SubscriptionManager.js';

// Data store adapter
export { DataStoreAdapter } from './adapters/DataStoreAdapter.js';

// Component editor
export { ComponentEditorViewModel } from './editor/ComponentEditorViewModel.js';

// Version
export const VERSION = '1.0.0';
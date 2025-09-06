# Knowledge Graph System - Complete API Reference

This document provides a comprehensive reference of all classes, methods, and signatures in the Knowledge Graph System. This is designed to be a single-file reference for coding agents.

## Table of Contents

1. [Core System](#core-system)
2. [Storage Layer](#storage-layer)
3. [Query System](#query-system)
4. [Beliefs System](#beliefs-system)
5. [Relationships](#relationships)
6. [RDF Support](#rdf-support)
7. [Gellish Natural Language](#gellish-natural-language)
8. [Tools and Schema](#tools-and-schema)
9. [Export/Import](#exportimport)
10. [Utilities](#utilities)

---

## Core System

### KnowledgeGraphSystem

Main entry point for the Knowledge Graph System.

```javascript
class KnowledgeGraphSystem {
  constructor()
  
  // Query Operations
  query(): QueryBuilder
  
  // Tool Management
  registerTool(ToolClass, metadata): string
  generateToolSchemas(): Object
  generateJSONSchemas(): Object
  generateOpenAPISchemas(): Object
  findTools(criteria): Array
  canAchieveGoal(goal, availableTools): boolean
  
  // Object Management
  addObject(obj): string
  addRelationship(relationship): string
  addBelief(belief): string
  addMethodExecution(execution): string
  getObject(objectId): Object
  getClass(classId): Object
  
  // Export Operations
  exportToTurtle(): string
  exportToNTriples(): string
  exportToJsonLD(): Object
  exportToRDFXML(): string
  exportToCypher(): string
  exportToGraphML(): string
  
  // Import Operations
  importFromTurtle(turtleString): void
  importFromNTriples(ntriplesString): void
  importFromJsonLD(jsonldData): void
  
  // Schema Evolution
  evolveSchema(classId, changes): void
  
  // Testing
  roundTripTest(obj): Object
}
```

### KGEngine

Core Knowledge Graph Engine with pluggable storage.

```javascript
class KGEngine {
  constructor(tripleStore = null)
  
  // Synchronous Operations (backward compatibility)
  addTriple(subject, predicate, object): boolean
  removeTriple(subject, predicate, object): boolean
  query(subject, predicate, object): Array<[string, string, any]>
  queryPattern(pattern): Array<[string, string, any]>
  
  // Asynchronous Operations
  async addTripleAsync(subject, predicate, object): Promise<boolean>
  async removeTripleAsync(subject, predicate, object): Promise<boolean>
  async queryAsync(subject, predicate, object): Promise<Array<[string, string, any]>>
  async queryPatternAsync(pattern): Promise<Array<[string, string, any]>>
  async exists(subject, predicate, object): Promise<boolean>
  async size(): Promise<number>
  async clear(): Promise<void>
  async addTriples(triples): Promise<number>
  async removeTriples(triples): Promise<number>
  
  // Storage Operations
  getStorageMetadata(): Object
  async save(): Promise<void>
  async load(): Promise<void>
  async beginTransaction(): Promise<ITransaction>
}
```

### QueryBuilder

Fluent interface for building queries.

```javascript
class QueryBuilder {
  constructor(kgEngine)
  
  // Query Construction
  select(...variables): QueryBuilder
  where(subject, predicate, object): QueryBuilder
  filter(constraint): QueryBuilder
  optional(pattern): QueryBuilder
  union(...patterns): QueryBuilder
  orderBy(variable, direction = 'ASC'): QueryBuilder
  limit(count): QueryBuilder
  offset(count): QueryBuilder
  
  // Execution
  async execute(): Promise<QueryResult>
  build(): BaseQuery
}
```

### IDManager

Manages unique identifiers across the system.

```javascript
class IDManager {
  generateId(prefix = 'kg'): string
  generateClassId(className): string
  generateInstanceId(className): string
  generateMethodId(className, methodName): string
  generatePropertyId(className, propertyName): string
  generateRelationshipId(fromId, toId, type): string
  generateBeliefId(agent, subject, predicate, object): string
  generateQueryId(queryType): string
  
  // Validation
  isValidId(id): boolean
  parseId(id): Object
  
  // Namespace Management
  setNamespace(prefix, uri): void
  getNamespace(prefix): string
  expandId(compactId): string
  compactId(fullId): string
}

// Global instance
export const idManager: IDManager
```

---

## Storage Layer

### ITripleStore

Interface that all storage providers must implement.

```javascript
class ITripleStore {
  // Core Operations
  async addTriple(subject, predicate, object): Promise<boolean>
  async removeTriple(subject, predicate, object): Promise<boolean>
  async query(subject, predicate, object): Promise<Array<[string, string, any]>>
  async queryPattern(pattern): Promise<Array<[string, string, any]>>
  async exists(subject, predicate, object): Promise<boolean>
  async size(): Promise<number>
  async clear(): Promise<void>
  
  // Batch Operations
  async addTriples(triples): Promise<number>
  async removeTriples(triples): Promise<number>
  
  // Advanced Features
  async beginTransaction(): Promise<ITransaction>
  async save(): Promise<void>
  async load(): Promise<void>
  getMetadata(): Object
}
```

### ITransaction

Interface for transaction support.

```javascript
class ITransaction {
  async addTriple(subject, predicate, object): Promise<boolean>
  async removeTriple(subject, predicate, object): Promise<boolean>
  async commit(): Promise<void>
  async rollback(): Promise<void>
}
```

### Storage Implementations

Available storage providers:

```javascript
// In-Memory Storage
class InMemoryTripleStore extends ITripleStore {
  constructor()
  // Implements all ITripleStore methods
  // Additional sync methods for backward compatibility:
  addTripleSync(subject, predicate, object): boolean
  removeTripleSync(subject, predicate, object): boolean
  querySync(subject, predicate, object): Array
  queryPatternSync(pattern): Array
}

// File System Storage
class FileSystemTripleStore extends ITripleStore {
  constructor(filePath)
  // Implements all ITripleStore methods
}

// MongoDB Storage
class MongoTripleStore extends ITripleStore {
  constructor(connectionString, dbName, collectionName)
  // Implements all ITripleStore methods
}

// SQL Storage
class SQLTripleStore extends ITripleStore {
  constructor(connectionConfig)
  // Implements all ITripleStore methods
}

// GitHub Storage
class GitHubTripleStore extends ITripleStore {
  constructor(config)
  // Implements all ITripleStore methods
}

// GraphDB Storage
class GraphDBTripleStore extends ITripleStore {
  constructor(endpoint, repository)
  // Implements all ITripleStore methods
}

// Remote Storage
class RemoteTripleStore extends ITripleStore {
  constructor(endpoint, options)
  // Implements all ITripleStore methods
}
```

### Storage Utilities

```javascript
class CacheLayer {
  constructor(underlyingStore, cacheSize = 1000)
  // Wraps any ITripleStore with caching
}

class ConflictResolver {
  constructor(strategy = 'timestamp')
  resolve(conflicts): Array
}

class QueryOptimizer {
  constructor(store)
  optimize(query): OptimizedQuery
}

class StorageConfig {
  static fromJSON(config): ITripleStore
  static getAvailableProviders(): Array<string>
}

class StorageError extends Error {
  constructor(message, code, details)
}
```

---

## Query System

### BaseQuery

Base class for all query types.

```javascript
class BaseQuery {
  constructor(id = null)
  
  // Identity
  generateId(): string
  getId(): string
  
  // Metadata
  setMetadata(key, value): BaseQuery
  getMetadata(key): any
  
  // Execution
  async execute(kgEngine, context = {}): Promise<QueryResult>
  async _executeInternal(kgEngine, context): Promise<QueryResult> // Override in subclasses
  
  // Serialization
  toTriples(): Array<[string, string, any]>
}
```

### Query Types

```javascript
// Pattern Matching
class PatternQuery extends BaseQuery {
  constructor(patterns = [])
  addPattern(subject, predicate, object): PatternQuery
  addTriplePattern(pattern): PatternQuery
  setOptional(isOptional): PatternQuery
}

// Logical Operations
class LogicalQuery extends BaseQuery {
  constructor(operator, operands = [])
  addOperand(query): LogicalQuery
  setOperator(operator): LogicalQuery // 'AND', 'OR', 'NOT'
}

// Aggregation
class AggregationQuery extends BaseQuery {
  constructor(baseQuery, aggregations = [])
  addAggregation(func, variable, alias): AggregationQuery
  groupBy(...variables): AggregationQuery
  having(constraint): AggregationQuery
}

// Sequential Processing
class SequentialQuery extends BaseQuery {
  constructor(queries = [])
  addQuery(query): SequentialQuery
  setPassResults(pass): SequentialQuery
}

// Graph Traversal
class TraversalQuery extends BaseQuery {
  constructor(startNode, pathExpression)
  setStartNode(node): TraversalQuery
  setPathExpression(expression): TraversalQuery
  setMaxDepth(depth): TraversalQuery
}
```

### Query Components

```javascript
// Variables
class QueryVariable {
  constructor(name, type = null)
  getName(): string
  getType(): string
  setType(type): void
  bind(value): void
  isBound(): boolean
  getValue(): any
}

// Triple Patterns
class TriplePattern {
  constructor(subject, predicate, object)
  getSubject(): any
  getPredicate(): any
  getObject(): any
  isOptional(): boolean
  setOptional(optional): TriplePattern
  matches(triple): boolean
}

// Path Expressions
class PathExpression {
  constructor(expression)
  compile(): CompiledPath
  toString(): string
}

class FixedLengthPath extends PathExpression {
  constructor(predicate, length)
}

class VariableLengthPath extends PathExpression {
  constructor(predicate, minLength = 0, maxLength = Infinity)
}
```

### Constraints

```javascript
class Constraint {
  constructor(variable, operator, value)
  evaluate(binding): boolean
  toString(): string
}

class RangeConstraint extends Constraint {
  constructor(variable, min, max, inclusive = true)
}

class RegexConstraint extends Constraint {
  constructor(variable, pattern, flags = '')
}

class FunctionConstraint extends Constraint {
  constructor(variable, func, args = [])
}
```

### Query Results

```javascript
class QueryResult {
  constructor(bindings = [], metadata = {})
  
  // Access
  getBindings(): Array<Object>
  size(): number
  isEmpty(): boolean
  
  // Iteration
  forEach(callback): void
  map(callback): Array
  filter(callback): QueryResult
  
  // Transformation
  project(...variables): QueryResult
  distinct(): QueryResult
  orderBy(variable, direction = 'ASC'): QueryResult
  limit(count): QueryResult
  offset(count): QueryResult
  
  // Export
  toJSON(): Object
  toCSV(): string
  toTable(): string
}
```

### Query System

```javascript
class QuerySystem {
  constructor(kgEngine)
  
  async execute(query, context = {}): Promise<QueryResult>
  getExecutionHistory(): Array
  clearCache(): void
}
```

---

## Beliefs System

### Belief

Represents agent beliefs about facts.

```javascript
class Belief {
  constructor(agent, subject, predicate, object, data = {})
  
  // Properties
  agent: Object
  subject: any
  predicate: string
  object: any
  confidence: number // 0.0 to 1.0
  source: string
  timestamp: string
  
  // Serialization
  toTriples(): Array<[string, string, any]>
  getId(): string
}
```

### MethodExecution

Records method execution events.

```javascript
class MethodExecution {
  constructor(agent, method, parameters, result, data = {})
  
  // Properties
  agent: Object
  method: string
  parameters: Array
  result: any
  startTime: string
  endTime: string
  success: boolean
  error: string
  
  // Serialization
  toTriples(): Array<[string, string, any]>
  getId(): string
}
```

---

## Relationships

### Relationship

Base class for reified relationships.

```javascript
class Relationship {
  constructor(from, to, type, data = {})
  
  // Properties
  from: Object
  to: Object
  type: string
  started: string
  finished: string
  confidence: number
  context: string
  source: string
  
  // Serialization
  toTriples(): Array<[string, string, any]>
  getId(): string
}
```

### Specific Relationship Types

```javascript
class KnowsRelationship extends Relationship {
  constructor(from, to, data = {})
  // Inherits all Relationship methods
}

class WorksWithRelationship extends Relationship {
  constructor(from, to, data = {})
  // Inherits all Relationship methods
}
```

---

## RDF Support

### NamespaceManager

Manages RDF namespaces and prefixes.

```javascript
class NamespaceManager {
  constructor()
  
  // Namespace Management
  addNamespace(prefix, uri): void
  getNamespace(prefix): string
  removeNamespace(prefix): void
  getAllNamespaces(): Object
  
  // URI Operations
  expandURI(compactURI): string
  compactURI(fullURI): string
  isValidPrefix(prefix): boolean
  
  // Standard Namespaces
  addStandardNamespaces(): void
}
```

### RDFSerializer

Serializes knowledge graph to RDF formats.

```javascript
class RDFSerializer {
  constructor(kgEngine, namespaceManager)
  
  // Serialization Methods
  toTurtle(): string
  toNTriples(): string
  toJsonLD(): Object
  toRDFXML(): string
  
  // Configuration
  setBaseURI(uri): void
  setPrettyPrint(enabled): void
}
```

### RDFParser

Parses RDF formats into knowledge graph.

```javascript
class RDFParser {
  constructor(kgEngine, namespaceManager)
  
  // Parsing Methods
  parseTurtle(turtleString): void
  parseNTriples(ntriplesString): void
  parseJsonLD(jsonldData): void
  parseRDFXML(rdfxmlString): void
  
  // Configuration
  setBaseURI(uri): void
  setStrictMode(enabled): void
}
```

---

## Gellish Natural Language

### GellishSystem

Main interface for Gellish CNL processing.

```javascript
class GellishSystem {
  constructor(kgEngine)
  
  // Natural Language Processing
  parseStatement(statement): Object
  parseQuery(query): BaseQuery
  generateStatement(triple): string
  generateQuery(query): string
  
  // Validation
  validateStatement(statement): ValidationResult
  validateQuery(query): ValidationResult
}
```

### GellishDictionary

Manages Gellish vocabulary and concepts.

```javascript
class GellishDictionary {
  constructor()
  
  // Dictionary Management
  addConcept(uid, name, definition): void
  getConcept(uid): Object
  findConcepts(name): Array
  
  // Relationships
  addRelationType(uid, name, inverse): void
  getRelationType(uid): Object
  
  // Import/Export
  loadFromFile(filePath): void
  exportToFile(filePath): void
}
```

### GellishParser

Parses Gellish statements into knowledge graph triples.

```javascript
class GellishParser {
  constructor(dictionary)
  
  // Parsing
  parseStatement(statement): Array<[string, string, any]>
  parseFile(filePath): Array<[string, string, any]>
  
  // Configuration
  setStrictMode(enabled): void
  setLanguage(language): void
}
```

### GellishQueryParser

Parses Gellish queries into query objects.

```javascript
class GellishQueryParser {
  constructor(dictionary)
  
  // Query Parsing
  parseQuery(queryString): BaseQuery
  parseQuestion(question): BaseQuery
  
  // Validation
  validateQuery(queryString): ValidationResult
}
```

### GellishGenerator

Generates Gellish statements from knowledge graph.

```javascript
class GellishGenerator {
  constructor(dictionary)
  
  // Generation
  generateStatement(triple): string
  generateStatements(triples): Array<string>
  
  // Configuration
  setLanguage(language): void
  setVerbosity(level): void
}
```

### GellishValidator

Validates Gellish statements and queries.

```javascript
class GellishValidator {
  constructor(dictionary)
  
  // Validation
  validateStatement(statement): ValidationResult
  validateQuery(query): ValidationResult
  validateFile(filePath): ValidationResult
  
  // Rules
  addValidationRule(rule): void
  removeValidationRule(ruleId): void
}
```

### EntityRecognizer

Recognizes entities in Gellish text.

```javascript
class EntityRecognizer {
  constructor(dictionary)
  
  // Recognition
  recognizeEntities(text): Array<Entity>
  recognizeRelations(text): Array<Relation>
  
  // Configuration
  setConfidenceThreshold(threshold): void
  addCustomPattern(pattern): void
}
```

---

## Tools and Schema

### ToolRegistry

Manages tool registration and discovery.

```javascript
class ToolRegistry {
  constructor(kgEngine)
  
  // Registration
  registerTool(ToolClass, metadata): string
  unregisterTool(toolId): boolean
  
  // Discovery
  getAvailableTools(context = {}): Array
  findToolsByCapability(capability): Array
  findToolsByGoal(goal): Array
  getTool(toolId): Object
  
  // Metadata
  getToolMetadata(toolId): Object
  updateToolMetadata(toolId, metadata): void
}
```

### ToolDependencyManager

Manages tool dependencies and goal achievement.

```javascript
class ToolDependencyManager {
  constructor(kgEngine)
  
  // Dependencies
  addToolDependency(tool, dependency, type): void
  removeDependency(tool, dependency): void
  getDependencies(tool): Array
  
  // Goal Management
  addSubgoal(methodId, subgoal): void
  canAchieveGoal(goal, availableTools): boolean
  findToolsForGoal(goal): Array
  
  // Analysis
  analyzeDependencyGraph(): Object
  detectCircularDependencies(): Array
}
```

### SchemaGenerator

Generates schemas for tools and classes.

```javascript
class SchemaGenerator {
  constructor(kgEngine)
  
  // Tool Schemas
  generateToolSchema(toolId): Object
  generateAllToolSchemas(): Object
  
  // Class Schemas
  generateClassSchema(classId): Object
  generateAllClassSchemas(): Object
  
  // OpenAPI
  generateOpenAPISpec(): Object
}
```

---

## Export/Import

### JSONSchemaGenerator

Generates JSON schemas from knowledge graph classes.

```javascript
class JSONSchemaGenerator {
  constructor(kgEngine)
  
  // Schema Generation
  generateClassSchema(classId): Object
  generateAllClassSchemas(): Object
  generateOpenAPISchemas(): Object
  
  // Configuration
  setSchemaVersion(version): void
  setStrictMode(enabled): void
}
```

### PropertyGraphExporter

Exports knowledge graph to property graph formats.

```javascript
class PropertyGraphExporter {
  constructor(kgEngine)
  
  // Export Methods
  toCypher(): string
  toGraphML(): string
  toGEXF(): string
  
  // Configuration
  setNodeLabels(labels): void
  setEdgeTypes(types): void
}
```

---

## Utilities

### ObjectReconstructor

Reconstructs objects from knowledge graph triples.

```javascript
class ObjectReconstructor {
  constructor(kgEngine, namespaceManager)
  
  // Reconstruction
  reconstructObject(objectId): Object
  reconstructClass(classId): Function
  
  // Configuration
  setReconstructionMode(mode): void // 'strict', 'lenient'
  addCustomReconstructor(type, reconstructor): void
}
```

### ClassSerializer

Serializes JavaScript classes to knowledge graph.

```javascript
class ClassSerializer {
  constructor()
  
  // Serialization
  serializeClass(ClassConstructor): Array<[string, string, any]>
  serializeInstance(instance): Array<[string, string, any]>
  
  // Configuration
  setSerializationMode(mode): void
  addCustomSerializer(type, serializer): void
}
```

### Query Helpers

```javascript
class QueryHelpers {
  // Query Construction
  static createPatternQuery(patterns): PatternQuery
  static createLogicalQuery(operator, operands): LogicalQuery
  static createTraversalQuery(start, path): TraversalQuery
  
  // Query Optimization
  static optimizeQuery(query): BaseQuery
  static estimateQueryCost(query): number
  
  // Query Analysis
  static analyzeQuery(query): Object
  static validateQuery(query): ValidationResult
}
```

---

## Type Definitions

### Common Types

```javascript
// Triple representation
type Triple = [string, string, any]

// Query binding
type Binding = { [variable: string]: any }

// Validation result
interface ValidationResult {
  valid: boolean
  errors: Array<string>
  warnings: Array<string>
}

// Storage metadata
interface StorageMetadata {
  type: string
  supportsTransactions: boolean
  supportsPersistence: boolean
  supportsAsync: boolean
  maxTriples: number
}

// Tool metadata
interface ToolMetadata {
  name: string
  description: string
  version: string
  capabilities: Array<string>
  goals: Array<string>
  dependencies: Array<Object>
  methods: Object
}
```

---

## Usage Examples

### Basic Usage

```javascript
import KnowledgeGraphSystem from './src/index.js';

// Create system
const kg = new KnowledgeGraphSystem();

// Add data
kg.engine.addTriple('person:john', 'rdf:type', 'Person');
kg.engine.addTriple('person:john', 'name', 'John Doe');

// Query data
const results = kg.engine.query('person:john', null, null);
console.log(results);

// Advanced query
const query = kg.query()
  .select('person', 'name')
  .where('person', 'rdf:type', 'Person')
  .where('person', 'name', 'name');

const queryResults = await query.execute();
```

### Storage Configuration

```javascript
import { FileSystemTripleStore } from './src/storage/index.js';

// Use file system storage
const store = new FileSystemTripleStore('./data/kg.json');
const kg = new KnowledgeGraphSystem();
kg.engine = new KGEngine(store);
```

### Natural Language Processing

```javascript
import { GellishSystem } from './src/gellish/index.js';

const gellish = new GellishSystem(kg.engine);

// Parse natural language
const triples = gellish.parseStatement("John is a person");
triples.forEach(([s, p, o]) => kg.engine.addTriple(s, p, o));

// Generate natural language
const statement = gellish.generateStatement(['person:john', 'rdf:type', 'Person']);
console.log(statement); // "John is a person"
```

---

This API reference provides complete coverage of all classes, methods, and signatures in the Knowledge Graph System. Use this as your comprehensive guide for understanding and working with the system.

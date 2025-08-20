/**
 * Incremental LFTJ Engine
 * Main entry point and exports
 */

// High-level API
export { 
  IncrementalLFTJ,
  QueryHandle,
  QueryBuilder,
  Schema,
  Delta,
  Tuple,
  ID,
  StringAtom,
  Integer,
  Float,
  BooleanAtom,
  SymbolAtom,
  EnumerableProvider,
  PointwiseProvider
} from './IncrementalLFTJ.js';

// Value model
export { Atom } from './Atom.js';

// Relations
export { RelationRegistry } from './RelationRegistry.js';

// Core operators
export { Node } from './Node.js';
export { ScanNode } from './ScanNode.js';
export { ProjectNode } from './ProjectNode.js';
export { UnionNode } from './UnionNode.js';
export { RenameNode } from './RenameNode.js';
export { JoinNode } from './JoinNode.js';
export { DiffNode } from './DiffNode.js';
export { ComputeNode } from './ComputeNode.js';

// Indexing and iteration
export { Trie } from './Trie.js';
export { LevelIterator, IteratorFactory } from './LevelIterator.js';

// Graph components
export { QueryGraph, GraphNode } from './QueryGraph.js';
export { GraphEngine, ExecutionContext } from './GraphEngine.js';

// Batch processing
export { BatchManager, BatchTransaction } from './BatchManager.js';
export { BatchGraphEngine, BatchUpdater } from './BatchGraphEngine.js';
export { BatchNode, wrapWithBatch, BatchController } from './BatchNode.js';

// Default export
import { IncrementalLFTJ } from './IncrementalLFTJ.js';
export default IncrementalLFTJ;
/**
 * @legion/graph - Browser-compatible knowledge graph data source and handles
 *
 * Provides Handle-based access to in-memory knowledge graphs.
 * Works both locally and as RemoteHandle for client-server scenarios.
 *
 * Usage:
 * ```javascript
 * import { GraphDataSource, GraphHandle } from '@legion/graph';
 *
 * // Create graph
 * const graphDataSource = new GraphDataSource({
 *   nodes: [
 *     { id: 'node1', label: 'Node 1', type: 'Entity' },
 *     { id: 'node2', label: 'Node 2', type: 'Entity' }
 *   ],
 *   edges: [
 *     { id: 'edge1', source: 'node1', target: 'node2', type: 'connects' }
 *   ]
 * });
 *
 * // Create handle
 * const graphHandle = new GraphHandle(graphDataSource);
 *
 * // Query nodes
 * const nodes = await graphHandle.getNodes();
 *
 * // Drill down to specific node
 * const nodeHandle = graphHandle.nodeHandle('node1');
 * const nodeData = await nodeHandle.getData();
 * const connectedNodes = await nodeHandle.getConnectedNodes();
 *
 * // Drill down to specific edge
 * const edgeHandle = graphHandle.edgeHandle('edge1');
 * const edgeData = await edgeHandle.getData();
 * const sourceNode = await edgeHandle.getSourceNode();
 * ```
 */

export { GraphDataSource } from './GraphDataSource.js';
export { GraphHandle } from './GraphHandle.js';
export { NodeHandle } from './NodeHandle.js';
export { EdgeHandle } from './EdgeHandle.js';

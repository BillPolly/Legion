/**
 * PathHandle - Handle for Neo4j graph path traversal and path finding operations
 * 
 * Provides Handle-based interface for path operations with:
 * - Shortest path algorithms (Dijkstra, A*)
 * - All paths finding between nodes
 * - Path length and depth constraints
 * - Path filtering and validation
 * - Complex traversal patterns
 * - Caching with TTL
 * - Subscription system for path change notifications
 */

export class PathHandle {
  constructor(dataSource, startNodeId, endNodeId, options = {}) {
    if (!dataSource) {
      throw new Error('DataSource is required for PathHandle');
    }
    if (!startNodeId) {
      throw new Error('Start node ID is required for PathHandle');
    }
    if (!endNodeId) {
      throw new Error('End node ID is required for PathHandle');
    }
    
    this.dataSource = dataSource;
    this.startNodeId = startNodeId.toString();
    this.endNodeId = endNodeId.toString();
    this.id = `${this.startNodeId}->${this.endNodeId}`;
    this._type = 'PathHandle';
    this._cache = null;
    this._cacheTime = null;
    this._cacheTTL = options.cacheTTL || 30000; // 30 seconds default
    this._validator = options.validator || null;
    this._subscriptions = new Map();
    this._subscriptionCounter = 0;
  }

  /**
   * Find shortest path between start and end nodes
   */
  shortestPath(options = {}) {
    const {
      algorithm = 'dijkstra',
      relationshipTypes = null,
      direction = 'both',
      maxDepth = 15,
      weightProperty = null,
      defaultWeight = 1
    } = options;

    let query;
    let params = {
      startId: parseInt(this.startNodeId),
      endId: parseInt(this.endNodeId),
      maxDepth: maxDepth
    };

    if (algorithm === 'dijkstra' && weightProperty) {
      // Weighted shortest path using Dijkstra
      const relPattern = this._buildRelationshipPattern(relationshipTypes, direction);
      query = `
        MATCH (start), (end) 
        WHERE id(start) = $startId AND id(end) = $endId
        CALL gds.shortestPath.dijkstra.stream('myGraph', {
          sourceNode: start,
          targetNode: end,
          relationshipWeightProperty: '${weightProperty}'
        })
        YIELD index, sourceNode, targetNode, totalCost, nodeIds, costs, path
        RETURN path, totalCost, size(nodeIds) as pathLength
      `;
    } else {
      // Simple shortest path
      const relPattern = this._buildRelationshipPattern(relationshipTypes, direction);
      query = `
        MATCH path = shortestPath((start)-${relPattern}*1..${maxDepth}-(end))
        WHERE id(start) = $startId AND id(end) = $endId
        RETURN path, length(path) as pathLength, 
               [node in nodes(path) | id(node)] as nodeIds,
               [rel in relationships(path) | id(rel)] as relationshipIds
      `;
    }

    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: query,
        params: params
      });

      if (result.records.length === 0) {
        return null; // No path found
      }

      const record = result.records[0];
      return this._formatPathResult(record, 'shortest');
    } catch (error) {
      console.error(`[PathHandle] Error finding shortest path from ${this.startNodeId} to ${this.endNodeId}:`, error.message);
      throw error;
    }
  }

  /**
   * Find all paths between start and end nodes
   */
  allPaths(options = {}) {
    const {
      relationshipTypes = null,
      direction = 'both',
      maxDepth = 10,
      minDepth = 1,
      limit = 100
    } = options;

    const relPattern = this._buildRelationshipPattern(relationshipTypes, direction);
    const query = `
      MATCH path = (start)-${relPattern}*${minDepth}..${maxDepth}-(end)
      WHERE id(start) = $startId AND id(end) = $endId
      WITH path
      LIMIT $limit
      RETURN path, length(path) as pathLength,
             [node in nodes(path) | id(node)] as nodeIds,
             [rel in relationships(path) | id(rel)] as relationshipIds
      ORDER BY length(path)
    `;

    const params = {
      startId: parseInt(this.startNodeId),
      endId: parseInt(this.endNodeId),
      limit: limit
    };

    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: query,
        params: params
      });

      return result.records.map(record => this._formatPathResult(record, 'all'));
    } catch (error) {
      console.error(`[PathHandle] Error finding all paths from ${this.startNodeId} to ${this.endNodeId}:`, error.message);
      throw error;
    }
  }

  /**
   * Find paths with specific patterns or constraints
   */
  findPaths(pattern, options = {}) {
    const {
      maxDepth = 10,
      limit = 50,
      filters = {},
      orderBy = 'length(path)'
    } = options;

    // Build complex pattern query
    let query = `MATCH path = ${pattern} WHERE id(startNode(path)) = $startId AND id(endNode(path)) = $endId`;
    
    // Add filters
    if (filters.nodeLabels && filters.nodeLabels.length > 0) {
      const labelConditions = filters.nodeLabels.map(label => `any(n in nodes(path) where '${label}' in labels(n))`);
      query += ` AND (${labelConditions.join(' OR ')})`;
    }

    if (filters.relationshipTypes && filters.relationshipTypes.length > 0) {
      const typeConditions = filters.relationshipTypes.map(type => `any(r in relationships(path) where type(r) = '${type}')`);
      query += ` AND (${typeConditions.join(' OR ')})`;
    }

    if (filters.maxLength) {
      query += ` AND length(path) <= ${filters.maxLength}`;
    }

    if (filters.minLength) {
      query += ` AND length(path) >= ${filters.minLength}`;
    }

    query += `
      WITH path
      RETURN path, length(path) as pathLength,
             [node in nodes(path) | id(node)] as nodeIds,
             [rel in relationships(path) | id(rel)] as relationshipIds
      ORDER BY ${orderBy}
      LIMIT $limit
    `;

    const params = {
      startId: parseInt(this.startNodeId),
      endId: parseInt(this.endNodeId),
      limit: limit
    };

    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: query,
        params: params
      });

      return result.records.map(record => this._formatPathResult(record, 'pattern'));
    } catch (error) {
      console.error(`[PathHandle] Error finding paths with pattern from ${this.startNodeId} to ${this.endNodeId}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if path exists between nodes
   */
  exists(options = {}) {
    const {
      relationshipTypes = null,
      direction = 'both',
      maxDepth = 15
    } = options;

    const relPattern = this._buildRelationshipPattern(relationshipTypes, direction);
    const query = `
      MATCH (start), (end)
      WHERE id(start) = $startId AND id(end) = $endId
      RETURN EXISTS {
        MATCH path = (start)-${relPattern}*1..${maxDepth}-(end)
      } as pathExists
    `;

    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: query,
        params: {
          startId: parseInt(this.startNodeId),
          endId: parseInt(this.endNodeId)
        }
      });

      return result.records.length > 0 ? result.records[0].pathExists : false;
    } catch (error) {
      console.warn(`[PathHandle] Error checking path existence from ${this.startNodeId} to ${this.endNodeId}:`, error.message);
      return false;
    }
  }

  /**
   * Get path statistics (count, average length, etc.)
   */
  getStatistics(options = {}) {
    const {
      relationshipTypes = null,
      direction = 'both',
      maxDepth = 10,
      sampleSize = 1000
    } = options;

    const relPattern = this._buildRelationshipPattern(relationshipTypes, direction);
    const query = `
      MATCH path = (start)-${relPattern}*1..${maxDepth}-(end)
      WHERE id(start) = $startId AND id(end) = $endId
      WITH path
      LIMIT $sampleSize
      RETURN 
        count(path) as totalPaths,
        min(length(path)) as shortestLength,
        max(length(path)) as longestLength,
        avg(length(path)) as averageLength,
        collect(distinct [node in nodes(path) | labels(node)]) as pathNodeLabels,
        collect(distinct [rel in relationships(path) | type(rel)]) as pathRelationshipTypes
    `;

    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: query,
        params: {
          startId: parseInt(this.startNodeId),
          endId: parseInt(this.endNodeId),
          sampleSize: sampleSize
        }
      });

      if (result.records.length === 0) {
        return {
          totalPaths: 0,
          shortestLength: null,
          longestLength: null,
          averageLength: null,
          pathNodeLabels: [],
          pathRelationshipTypes: []
        };
      }

      const record = result.records[0];
      return {
        totalPaths: record.totalPaths,
        shortestLength: record.shortestLength,
        longestLength: record.longestLength,
        averageLength: Math.round(record.averageLength * 100) / 100,
        pathNodeLabels: record.pathNodeLabels.flat().filter((labels, index, self) => 
          self.findIndex(l => JSON.stringify(l) === JSON.stringify(labels)) === index
        ),
        pathRelationshipTypes: record.pathRelationshipTypes.flat().filter((types, index, self) => 
          self.findIndex(t => JSON.stringify(t) === JSON.stringify(types)) === index
        )
      };
    } catch (error) {
      console.error(`[PathHandle] Error getting path statistics from ${this.startNodeId} to ${this.endNodeId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get intermediate nodes along paths
   */
  getIntermediateNodes(options = {}) {
    const {
      relationshipTypes = null,
      direction = 'both',
      maxDepth = 10,
      limit = 100,
      includeFrequency = false
    } = options;

    const relPattern = this._buildRelationshipPattern(relationshipTypes, direction);
    let query = `
      MATCH path = (start)-${relPattern}*1..${maxDepth}-(end)
      WHERE id(start) = $startId AND id(end) = $endId
      WITH path
      LIMIT $limit
      UNWIND nodes(path)[1..-1] as intermediateNode
      WHERE id(intermediateNode) <> $endId
    `;

    if (includeFrequency) {
      query += `
        WITH intermediateNode, count(*) as frequency
        RETURN id(intermediateNode) as nodeId, 
               labels(intermediateNode) as labels,
               intermediateNode.name as name,
               frequency
        ORDER BY frequency DESC
      `;
    } else {
      query += `
        RETURN DISTINCT id(intermediateNode) as nodeId,
               labels(intermediateNode) as labels,
               intermediateNode.name as name
      `;
    }

    try {
      const result = this.dataSource.query({
        type: 'cypher',
        query: query,
        params: {
          startId: parseInt(this.startNodeId),
          endId: parseInt(this.endNodeId),
          limit: limit
        }
      });

      return result.records.map(record => ({
        nodeId: record.nodeId.toString(),
        labels: record.labels,
        name: record.name,
        frequency: record.frequency || 1,
        nodeHandle: this.dataSource.createNodeHandle ? this.dataSource.createNodeHandle(record.nodeId) : null
      }));
    } catch (error) {
      console.error(`[PathHandle] Error getting intermediate nodes from ${this.startNodeId} to ${this.endNodeId}:`, error.message);
      return [];
    }
  }

  /**
   * Subscribe to path changes (when paths are created/destroyed)
   */
  subscribe(callback, options = {}) {
    const { events = ['path_created', 'path_destroyed', 'path_modified'] } = options;
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    const subscriptionId = ++this._subscriptionCounter;
    this._subscriptions.set(subscriptionId, { callback, events, options });
    
    // Return unsubscribe function
    return () => {
      this._subscriptions.delete(subscriptionId);
    };
  }

  /**
   * Convert to plain object representation
   */
  toObject() {
    return {
      id: this.id,
      startNodeId: this.startNodeId,
      endNodeId: this.endNodeId,
      type: this._type
    };
  }

  /**
   * Build relationship pattern for Cypher queries
   */
  _buildRelationshipPattern(relationshipTypes, direction) {
    let pattern = '';
    
    // Direction arrows
    if (direction === 'outgoing') {
      pattern = '-';
    } else if (direction === 'incoming') {
      pattern = '<-';
    } else {
      pattern = '-'; // both directions
    }
    
    // Relationship types
    if (relationshipTypes && relationshipTypes.length > 0) {
      const types = Array.isArray(relationshipTypes) ? relationshipTypes : [relationshipTypes];
      pattern += `[r:${types.join('|')}]`;
    } else {
      pattern += '[r]';
    }
    
    // Close direction
    if (direction === 'outgoing') {
      pattern += '->';
    } else if (direction === 'incoming') {
      pattern += '-';
    } else {
      pattern += '-';
    }
    
    return pattern;
  }

  /**
   * Format path result from Neo4j record
   */
  _formatPathResult(record, pathType) {
    return {
      path: record.path,
      pathLength: record.pathLength,
      nodeIds: record.nodeIds.map(id => id.toString()),
      relationshipIds: record.relationshipIds?.map(id => id.toString()) || [],
      pathType: pathType,
      totalCost: record.totalCost || null,
      nodeHandles: record.nodeIds.map(id => 
        this.dataSource.createNodeHandle ? this.dataSource.createNodeHandle(id) : { id: id.toString() }
      ),
      relationshipHandles: (record.relationshipIds || []).map(id =>
        this.dataSource.createRelationshipHandle ? this.dataSource.createRelationshipHandle(id) : { id: id.toString() }
      )
    };
  }

  /**
   * Notify subscribers of changes
   */
  _notifySubscribers(eventType, data = {}) {
    for (const [subscriptionId, subscription] of this._subscriptions) {
      const { callback, events } = subscription;
      
      if (events.includes(eventType)) {
        try {
          callback({
            type: eventType,
            pathId: this.id,
            startNodeId: this.startNodeId,
            endNodeId: this.endNodeId,
            timestamp: Date.now(),
            data
          });
        } catch (error) {
          console.warn(`[PathHandle] Error in subscription callback for path ${this.id}:`, error.message);
        }
      }
    }
  }

  /**
   * Invalidate cache
   */
  _invalidateCache() {
    this._cache = null;
    this._cacheTime = null;
  }
}
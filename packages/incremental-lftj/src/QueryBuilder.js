import { QueryGraph, GraphNode } from './QueryGraph.js';
import { Schema } from './Schema.js';

/**
 * Fluent query builder for creating incremental LFTJ queries
 */
export class QueryBuilder {
  constructor(queryId = null) {
    this._queryId = queryId || `query_${Date.now()}`;
    this._graph = new QueryGraph(this._queryId);
    this._currentNode = null;
    this._outputNodes = [];
  }

  /**
   * Get the built query graph
   */
  build() {
    if (this._outputNodes.length > 0) {
      this._graph.setOutputs(this._outputNodes);
    } else if (this._currentNode) {
      this._graph.setOutputs([this._currentNode]);
    }

    return this._graph;
  }

  /**
   * Start with a relation scan
   */
  from(relationName, schema, nodeId = null) {
    if (typeof schema === 'object' && !Array.isArray(schema) && !(schema instanceof Schema)) {
      // Convert object schema to Schema instance
      const fields = Object.entries(schema).map(([name, type]) => ({ name, type }));
      schema = new Schema(fields);
    }

    this._currentNode = this._graph.scan(relationName, schema, nodeId);
    return this;
  }

  /**
   * Add a projection
   */
  select(indices, nodeId = null) {
    if (!this._currentNode) {
      throw new Error('Must start with from() before using select()');
    }

    this._currentNode = this._graph.project(this._currentNode, indices, nodeId);
    return this;
  }

  /**
   * Add a join with another query or relation
   */
  join(rightSource, joinConditions, nodeId = null) {
    if (!this._currentNode) {
      throw new Error('Must start with from() before using join()');
    }

    let rightNode;
    if (rightSource instanceof QueryBuilder) {
      // Join with another query
      const rightGraph = rightSource.build();
      if (rightGraph.outputs.length !== 1) {
        throw new Error('Right source query must have exactly one output');
      }
      
      // Merge the right graph into this graph
      for (const node of rightGraph.nodes) {
        this._graph.addNode(node);
      }
      rightNode = rightGraph.outputs[0];
    } else if (rightSource instanceof GraphNode) {
      rightNode = rightSource;
    } else if (typeof rightSource === 'string') {
      // Assume it's a relation name - create a scan node
      throw new Error('Join with relation name requires schema - use joinRelation() instead');
    } else {
      throw new Error('Right source must be a QueryBuilder, GraphNode, or relation name');
    }

    this._currentNode = this._graph.join(this._currentNode, rightNode, joinConditions, nodeId);
    return this;
  }

  /**
   * Join with a relation by name
   */
  joinRelation(relationName, schema, joinConditions, nodeId = null) {
    if (typeof schema === 'object' && !Array.isArray(schema) && !(schema instanceof Schema)) {
      const fields = Object.entries(schema).map(([name, type]) => ({ name, type }));
      schema = new Schema(fields);
    }

    const rightNode = this._graph.scan(relationName, schema);
    return this.join(rightNode, joinConditions, nodeId);
  }

  /**
   * Add a union with other queries
   */
  union(otherSources, nodeId = null) {
    if (!this._currentNode) {
      throw new Error('Must start with from() before using union()');
    }

    const inputNodes = [this._currentNode];

    for (const source of otherSources) {
      if (source instanceof QueryBuilder) {
        const sourceGraph = source.build();
        if (sourceGraph.outputs.length !== 1) {
          throw new Error('Union source query must have exactly one output');
        }
        
        // Merge the source graph into this graph
        for (const node of sourceGraph.nodes) {
          this._graph.addNode(node);
        }
        inputNodes.push(sourceGraph.outputs[0]);
      } else if (source instanceof GraphNode) {
        inputNodes.push(source);
      } else {
        throw new Error('Union source must be a QueryBuilder or GraphNode');
      }
    }

    this._currentNode = this._graph.union(inputNodes, nodeId);
    return this;
  }

  /**
   * Add a rename operation
   */
  rename(mapping, nodeId = null) {
    if (!this._currentNode) {
      throw new Error('Must start with from() before using rename()');
    }

    this._currentNode = this._graph.rename(this._currentNode, mapping, nodeId);
    return this;
  }

  /**
   * Add a difference operation
   */
  except(rightSource, nodeId = null) {
    if (!this._currentNode) {
      throw new Error('Must start with from() before using except()');
    }

    let rightNode;
    if (rightSource instanceof QueryBuilder) {
      const rightGraph = rightSource.build();
      if (rightGraph.outputs.length !== 1) {
        throw new Error('Right source query must have exactly one output');
      }
      
      // Merge the right graph into this graph
      for (const node of rightGraph.nodes) {
        this._graph.addNode(node);
      }
      rightNode = rightGraph.outputs[0];
    } else if (rightSource instanceof GraphNode) {
      rightNode = rightSource;
    } else {
      throw new Error('Right source must be a QueryBuilder or GraphNode');
    }

    this._currentNode = this._graph.diff(this._currentNode, rightNode, nodeId);
    return this;
  }

  /**
   * Add a compute node with external provider
   */
  compute(provider, nodeId = null) {
    this._currentNode = this._graph.compute(provider, nodeId);
    return this;
  }

  /**
   * Filter through a compute node (for pointwise providers)
   */
  filter(provider, nodeId = null) {
    if (!this._currentNode) {
      throw new Error('Must start with from() before using filter()');
    }

    const computeNode = this._graph.compute(provider, nodeId);
    computeNode.addInput(this._currentNode);
    this._currentNode = computeNode;
    return this;
  }

  /**
   * Mark current node as an output
   */
  output(alias = null) {
    if (!this._currentNode) {
      throw new Error('No current node to mark as output');
    }

    if (alias) {
      // Create a renamed output node
      const outputNode = this._graph.rename(this._currentNode, { alias }, `output_${alias}`);
      this._outputNodes.push(outputNode);
    } else {
      this._outputNodes.push(this._currentNode);
    }

    return this;
  }

  /**
   * Get current node (for advanced usage)
   */
  getCurrentNode() {
    return this._currentNode;
  }

  /**
   * Get the underlying graph (for advanced usage)
   */
  getGraph() {
    return this._graph;
  }

  /**
   * Reset the builder
   */
  reset() {
    this._graph = new QueryGraph(this._queryId);
    this._currentNode = null;
    this._outputNodes = [];
    return this;
  }

  /**
   * Create a new branch from current node
   */
  branch() {
    const newBuilder = new QueryBuilder(`${this._queryId}_branch_${Date.now()}`);
    
    if (this._currentNode) {
      // Copy the current graph state to the new builder
      for (const node of this._graph.nodes) {
        newBuilder._graph.addNode(node);
      }
      newBuilder._currentNode = this._currentNode;
    }

    return newBuilder;
  }

  /**
   * Static helper methods for common patterns
   */

  /**
   * Create a simple scan query
   */
  static scan(relationName, schema, queryId = null) {
    return new QueryBuilder(queryId).from(relationName, schema);
  }

  /**
   * Create a natural join query
   */
  static naturalJoin(leftRelation, leftSchema, rightRelation, rightSchema, queryId = null) {
    const builder = new QueryBuilder(queryId);
    return builder
      .from(leftRelation, leftSchema)
      .joinRelation(rightRelation, rightSchema, []); // Empty conditions = natural join
  }

  /**
   * Create a projection query
   */
  static project(relationName, schema, indices, queryId = null) {
    return new QueryBuilder(queryId)
      .from(relationName, schema)
      .select(indices);
  }

  /**
   * Create a union query
   */
  static union(relations, queryId = null) {
    if (relations.length < 2) {
      throw new Error('Union requires at least 2 relations');
    }

    const builder = new QueryBuilder(queryId);
    const [first, ...rest] = relations;
    
    builder.from(first.name, first.schema);
    
    const otherBuilders = rest.map(rel => 
      QueryBuilder.scan(rel.name, rel.schema)
    );

    return builder.union(otherBuilders);
  }
}
import { QueryBuilder } from '../../src/QueryBuilder.js';
import { QueryGraph, GraphNode } from '../../src/QueryGraph.js';
import { Schema } from '../../src/Schema.js';
import { EnumerableProvider } from '../../src/ComputeProvider.js';

// Test provider
class TestProvider extends EnumerableProvider {
  constructor(id) {
    super(id);
  }

  enumerate() {
    return new Set();
  }

  deltaSince() {
    return { adds: new Set(), removes: new Set() };
  }
}

describe('QueryBuilder', () => {
  let builder;
  const userSchema = new Schema([
    { name: 'user_id', type: 'ID' },
    { name: 'name', type: 'String' },
    { name: 'age', type: 'Integer' }
  ]);

  const orderSchema = new Schema([
    { name: 'order_id', type: 'ID' },
    { name: 'user_id', type: 'ID' },
    { name: 'amount', type: 'Integer' }
  ]);

  beforeEach(() => {
    builder = new QueryBuilder('test-query');
  });

  describe('constructor', () => {
    it('should create builder with default query ID', () => {
      const builder = new QueryBuilder();
      expect(builder.getGraph().id).toMatch(/^query_\d+$/);
    });

    it('should create builder with custom query ID', () => {
      const builder = new QueryBuilder('custom-query');
      expect(builder.getGraph().id).toBe('custom-query');
    });
  });

  describe('from() - relation scanning', () => {
    it('should create scan node from relation', () => {
      const query = builder.from('users', userSchema).build();

      expect(query.nodes).toHaveLength(1);
      expect(query.nodes[0].type).toBe('scan');
      expect(query.nodes[0].config.relationName).toBe('users');
      expect(query.nodes[0].config.schema).toBe(userSchema);
      expect(query.outputs).toEqual([query.nodes[0]]);
    });

    it('should accept object schema', () => {
      const objSchema = { id: 'ID', name: 'String' };
      const query = builder.from('users', objSchema).build();

      expect(query.nodes[0].config.schema).toBeInstanceOf(Schema);
      expect(query.nodes[0].config.schema.variables).toHaveLength(2);
    });

    it('should accept custom node ID', () => {
      const query = builder.from('users', userSchema, 'custom-scan').build();

      expect(query.nodes[0].id).toBe('custom-scan');
    });
  });

  describe('select() - projection', () => {
    it('should create projection node', () => {
      const query = builder
        .from('users', userSchema)
        .select([0, 2])
        .build();

      expect(query.nodes).toHaveLength(2);
      expect(query.nodes[1].type).toBe('project');
      expect(query.nodes[1].config.indices).toEqual([0, 2]);
      expect(query.outputs).toEqual([query.nodes[1]]);
    });

    it('should require from() before select()', () => {
      expect(() => {
        builder.select([0, 1]);
      }).toThrow('Must start with from() before using select()');
    });
  });

  describe('join() - joins', () => {
    it('should join with another QueryBuilder', () => {
      const rightBuilder = new QueryBuilder()
        .from('orders', orderSchema);

      const query = builder
        .from('users', userSchema)
        .join(rightBuilder, [{ left: 0, right: 1 }])
        .build();

      expect(query.nodes).toHaveLength(3); // users scan + orders scan + join
      expect(query.nodes[2].type).toBe('join');
      expect(query.nodes[2].config.joinConditions).toEqual([{ left: 0, right: 1 }]);
    });

    it('should join with GraphNode', () => {
      const orderScan = new GraphNode('orders-scan', 'scan', {
        relationName: 'orders',
        schema: orderSchema
      });

      builder.from('users', userSchema);
      builder.getGraph().addNode(orderScan); // Manually add the external node
      
      const query = builder.join(orderScan, [{ left: 0, right: 1 }]).build();

      expect(query.nodes).toHaveLength(3);
      expect(query.nodes[2].type).toBe('join');
    });

    it('should require from() before join()', () => {
      const rightBuilder = new QueryBuilder().from('orders', orderSchema);

      expect(() => {
        builder.join(rightBuilder, []);
      }).toThrow('Must start with from() before using join()');
    });

    it('should throw error for invalid right source', () => {
      expect(() => {
        builder.from('users', userSchema).join('invalid', []);
      }).toThrow('Join with relation name requires schema - use joinRelation() instead');
    });
  });

  describe('joinRelation() - join with relation', () => {
    it('should join with relation by name', () => {
      const query = builder
        .from('users', userSchema)
        .joinRelation('orders', orderSchema, [{ left: 0, right: 1 }])
        .build();

      expect(query.nodes).toHaveLength(3);
      expect(query.nodes[2].type).toBe('join');
    });

    it('should accept object schema', () => {
      const objSchema = { id: 'ID', amount: 'Integer' };
      const query = builder
        .from('users', userSchema)
        .joinRelation('orders', objSchema, [])
        .build();

      expect(query.nodes[1].config.schema).toBeInstanceOf(Schema);
    });
  });

  describe('union() - unions', () => {
    it('should create union with other QueryBuilders', () => {
      const builder2 = new QueryBuilder().from('users2', userSchema);
      const builder3 = new QueryBuilder().from('users3', userSchema);

      const query = builder
        .from('users1', userSchema)
        .union([builder2, builder3])
        .build();

      expect(query.nodes).toHaveLength(4); // 3 scans + 1 union
      expect(query.nodes[3].type).toBe('union');
      expect(query.nodes[3].inputs).toHaveLength(3);
    });

    it('should create union with GraphNodes', () => {
      const scan2 = new GraphNode('scan2', 'scan', { relationName: 'users2', schema: userSchema });
      const scan3 = new GraphNode('scan3', 'scan', { relationName: 'users3', schema: userSchema });

      builder.from('users1', userSchema);
      builder.getGraph().addNode(scan2);
      builder.getGraph().addNode(scan3);
      
      const query = builder.union([scan2, scan3]).build();

      expect(query.nodes).toHaveLength(4);
      expect(query.nodes[3].type).toBe('union');
    });

    it('should require from() before union()', () => {
      const builder2 = new QueryBuilder().from('users2', userSchema);

      expect(() => {
        builder.union([builder2]);
      }).toThrow('Must start with from() before using union()');
    });
  });

  describe('rename() - renaming', () => {
    it('should create rename node', () => {
      const query = builder
        .from('users', userSchema)
        .rename({ 0: 'id', 1: 'full_name' })
        .build();

      expect(query.nodes).toHaveLength(2);
      expect(query.nodes[1].type).toBe('rename');
      expect(query.nodes[1].config.mapping).toEqual({ 0: 'id', 1: 'full_name' });
    });

    it('should require from() before rename()', () => {
      expect(() => {
        builder.rename({ 0: 'id' });
      }).toThrow('Must start with from() before using rename()');
    });
  });

  describe('except() - difference', () => {
    it('should create diff node with QueryBuilder', () => {
      const rightBuilder = new QueryBuilder().from('banned_users', userSchema);

      const query = builder
        .from('all_users', userSchema)
        .except(rightBuilder)
        .build();

      expect(query.nodes).toHaveLength(3); // 2 scans + 1 diff
      expect(query.nodes[2].type).toBe('diff');
    });

    it('should create diff node with GraphNode', () => {
      const bannedScan = new GraphNode('banned-scan', 'scan', {
        relationName: 'banned_users',
        schema: userSchema
      });

      builder.from('all_users', userSchema);
      builder.getGraph().addNode(bannedScan); // Manually add the external node
      
      const query = builder.except(bannedScan).build();

      expect(query.nodes).toHaveLength(3);
      expect(query.nodes[2].type).toBe('diff');
    });

    it('should require from() before except()', () => {
      const rightBuilder = new QueryBuilder().from('banned_users', userSchema);

      expect(() => {
        builder.except(rightBuilder);
      }).toThrow('Must start with from() before using except()');
    });
  });

  describe('compute() - external providers', () => {
    it('should create compute node', () => {
      const provider = new TestProvider('test-provider');
      const query = builder.compute(provider).build();

      expect(query.nodes).toHaveLength(1);
      expect(query.nodes[0].type).toBe('compute');
      expect(query.nodes[0].config.provider).toBe(provider);
    });
  });

  describe('filter() - pointwise filtering', () => {
    it('should create connected compute filter', () => {
      const provider = new TestProvider('test-provider');
      const query = builder
        .from('users', userSchema)
        .filter(provider)
        .build();

      expect(query.nodes).toHaveLength(2);
      expect(query.nodes[1].type).toBe('compute');
      expect(query.nodes[1].inputs).toContain(query.nodes[0]);
    });

    it('should require from() before filter()', () => {
      const provider = new TestProvider('test-provider');

      expect(() => {
        builder.filter(provider);
      }).toThrow('Must start with from() before using filter()');
    });
  });

  describe('output() - output management', () => {
    it('should mark current node as output', () => {
      const query = builder
        .from('users', userSchema)
        .select([0, 1])
        .output()
        .build();

      expect(query.outputs).toHaveLength(1);
      expect(query.outputs[0].type).toBe('project');
    });

    it('should create aliased output', () => {
      const query = builder
        .from('users', userSchema)
        .output('user_data')
        .build();

      expect(query.outputs).toHaveLength(1);
      expect(query.outputs[0].type).toBe('rename');
      expect(query.outputs[0].config.mapping).toEqual({ alias: 'user_data' });
    });

    it('should support multiple outputs', () => {
      const query = builder
        .from('users', userSchema)
        .output('all_users')
        .select([0])
        .output('user_ids')
        .build();

      expect(query.outputs).toHaveLength(2);
    });

    it('should throw error when no current node', () => {
      expect(() => {
        builder.output();
      }).toThrow('No current node to mark as output');
    });
  });

  describe('branching', () => {
    it('should create branch from current state', () => {
      builder.from('users', userSchema);
      const branch = builder.branch();

      const originalQuery = builder.select([0]).build();
      const branchQuery = branch.select([1]).build();

      expect(originalQuery.nodes).toHaveLength(2);
      expect(branchQuery.nodes).toHaveLength(2);
      expect(originalQuery.nodes[1].config.indices).toEqual([0]);
      expect(branchQuery.nodes[1].config.indices).toEqual([1]);
    });

    it('should create independent branch', () => {
      const branch = builder.branch();

      expect(branch).toBeInstanceOf(QueryBuilder);
      expect(branch).not.toBe(builder);
      expect(branch.getGraph().id).not.toBe(builder.getGraph().id);
    });
  });

  describe('reset', () => {
    it('should reset builder state', () => {
      builder.from('users', userSchema).select([0]);
      
      expect(builder.getGraph().nodes).toHaveLength(2);
      
      builder.reset();
      
      expect(builder.getGraph().nodes).toHaveLength(0);
      expect(builder.getCurrentNode()).toBe(null);
    });
  });

  describe('static helper methods', () => {
    it('should create simple scan query', () => {
      const query = QueryBuilder.scan('users', userSchema, 'scan-query').build();

      expect(query.id).toBe('scan-query');
      expect(query.nodes).toHaveLength(1);
      expect(query.nodes[0].type).toBe('scan');
    });

    it('should create natural join query', () => {
      const query = QueryBuilder.naturalJoin(
        'users', userSchema,
        'orders', orderSchema,
        'join-query'
      ).build();

      expect(query.id).toBe('join-query');
      expect(query.nodes).toHaveLength(3);
      expect(query.nodes[2].type).toBe('join');
      expect(query.nodes[2].config.joinConditions).toEqual([]);
    });

    it('should create projection query', () => {
      const query = QueryBuilder.project('users', userSchema, [0, 1], 'project-query').build();

      expect(query.id).toBe('project-query');
      expect(query.nodes).toHaveLength(2);
      expect(query.nodes[1].type).toBe('project');
      expect(query.nodes[1].config.indices).toEqual([0, 1]);
    });

    it('should create union query', () => {
      const relations = [
        { name: 'users1', schema: userSchema },
        { name: 'users2', schema: userSchema },
        { name: 'users3', schema: userSchema }
      ];

      const query = QueryBuilder.union(relations, 'union-query').build();

      expect(query.id).toBe('union-query');
      expect(query.nodes).toHaveLength(4); // 3 scans + 1 union
      expect(query.nodes[3].type).toBe('union');
    });

    it('should throw error for insufficient union relations', () => {
      expect(() => {
        QueryBuilder.union([{ name: 'users1', schema: userSchema }]);
      }).toThrow('Union requires at least 2 relations');
    });
  });

  describe('complex query building', () => {
    it('should build complex multi-operator query', () => {
      const rightBuilder = new QueryBuilder()
        .from('orders', orderSchema)
        .select([1, 2]); // user_id, amount

      const query = builder
        .from('users', userSchema)
        .select([0, 1]) // user_id, name
        .join(rightBuilder, [{ left: 0, right: 0 }])
        .select([1, 2]) // name, amount
        .rename({ 0: 'customer_name', 1: 'order_total' })
        .build();

      expect(query.nodes.length).toBeGreaterThanOrEqual(6);
      
      const nodeTypes = query.nodes.map(n => n.type);
      expect(nodeTypes).toContain('scan');
      expect(nodeTypes).toContain('project');
      expect(nodeTypes).toContain('join');
      expect(nodeTypes).toContain('rename');
      
      expect(query.outputs[0].type).toBe('rename');
    });

    it('should build query with multiple outputs', () => {
      const query = builder
        .from('users', userSchema)
        .output('all_users')
        .select([0])
        .output('user_ids')
        .select([0])
        .rename({ 0: 'id' })
        .output('renamed_ids')
        .build();

      expect(query.outputs).toHaveLength(3);
      expect(query.outputs.map(n => n.type)).toEqual(['rename', 'rename', 'rename']);
    });
  });

  describe('getCurrentNode and getGraph', () => {
    it('should provide access to current node', () => {
      builder.from('users', userSchema);
      
      const currentNode = builder.getCurrentNode();
      expect(currentNode.type).toBe('scan');
      expect(currentNode.config.relationName).toBe('users');
    });

    it('should provide access to underlying graph', () => {
      const graph = builder.getGraph();
      expect(graph).toBeInstanceOf(QueryGraph);
      expect(graph.id).toBe('test-query');
    });
  });
});
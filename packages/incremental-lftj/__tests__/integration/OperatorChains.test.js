import { ScanNode } from '../../src/ScanNode.js';
import { ProjectNode } from '../../src/ProjectNode.js';
import { UnionNode } from '../../src/UnionNode.js';
import { RenameNode } from '../../src/RenameNode.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Schema } from '../../src/Schema.js';
import { Integer, StringAtom, BooleanAtom, ID } from '../../src/Atom.js';
import { Node } from '../../src/Node.js';

// Mock node for capturing emissions in tests
class MockOutputNode extends Node {
  constructor(id) {
    super(id);
    this.receivedDeltas = [];
  }

  onDeltaReceived(source, delta) {
    this.receivedDeltas.push({ source, delta });
  }

  processDelta(delta) {
    return delta; // Pass through
  }
}

describe('Operator Chains Integration', () => {
  it('should handle Scan → Project chain', () => {
    const schema = new Schema([
      { name: 'id', type: 'ID' },
      { name: 'name', type: 'String' },
      { name: 'age', type: 'Integer' },
      { name: 'active', type: 'Boolean' }
    ]);

    const scan = new ScanNode('scanUsers', 'Users', schema, true);
    const project = new ProjectNode('projIdName', ['id', 'name'], schema);

    // Connect scan → project
    project.addInput(scan);

    const mockOutput = new MockOutputNode('output1');
    project.addOutput(mockOutput);

    // Input data
    const user1 = new Tuple([new ID('u1'), new StringAtom('Alice'), new Integer(25), new BooleanAtom(true)]);
    const user2 = new Tuple([new ID('u2'), new StringAtom('Bob'), new Integer(30), new BooleanAtom(false)]);
    const user3 = new Tuple([new ID('u1'), new StringAtom('Alice Updated'), new Integer(26), new BooleanAtom(true)]); // Update

    // Process batch
    const inputDelta = new Delta(new Set([user1, user2, user3]));
    scan.pushDelta(inputDelta);

    // Verify projection output
    expect(mockOutput.receivedDeltas.length).toBe(1);
    const finalOutput = mockOutput.receivedDeltas[0].delta;
    expect(finalOutput.adds.size).toBe(3); // All different projections
    
    const expectedProj1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
    const expectedProj2 = new Tuple([new ID('u2'), new StringAtom('Bob')]);
    const expectedProj3 = new Tuple([new ID('u1'), new StringAtom('Alice Updated')]);
    
    const outputTuples = Array.from(finalOutput.adds);
    expect(outputTuples.some(t => t.equals(expectedProj1))).toBe(true);
    expect(outputTuples.some(t => t.equals(expectedProj2))).toBe(true);
    expect(outputTuples.some(t => t.equals(expectedProj3))).toBe(true);

    // Verify scan maintained state
    expect(scan.getCurrentSet().size).toBe(3);
  });

  it('should handle Scan → Union chain with multiple inputs', () => {
    const schema = new Schema([
      { name: 'item', type: 'String' },
      { name: 'category', type: 'String' }
    ]);

    const scan1 = new ScanNode('scanBooks', 'Books', schema);
    const scan2 = new ScanNode('scanMovies', 'Movies', schema);
    const union = new UnionNode('unionMedia');

    // Connect scans → union
    union.addInput(scan1);
    union.addInput(scan2);

    const mockOutput = new MockOutputNode('output1');
    union.addOutput(mockOutput);

    // Books data
    const book1 = new Tuple([new StringAtom('1984'), new StringAtom('Fiction')]);
    const book2 = new Tuple([new StringAtom('Dune'), new StringAtom('Sci-Fi')]);
    
    // Movies data  
    const movie1 = new Tuple([new StringAtom('Blade Runner'), new StringAtom('Sci-Fi')]);
    const movie2 = new Tuple([new StringAtom('1984'), new StringAtom('Drama')]); // Same title, different category

    // Process books
    scan1.pushDelta(new Delta(new Set([book1, book2])));
    
    expect(mockOutput.receivedDeltas.length).toBe(1);
    expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(2);

    // Process movies
    scan2.pushDelta(new Delta(new Set([movie1, movie2])));
    
    expect(mockOutput.receivedDeltas.length).toBe(2);
    expect(mockOutput.receivedDeltas[1].delta.adds.size).toBe(2); // Both movies are unique

    // Verify all tuples are in union
    const allAdds = new Set();
    mockOutput.receivedDeltas.forEach(received => {
      received.delta.adds.forEach(tuple => allAdds.add(tuple));
    });
    expect(allAdds.size).toBe(4);
  });

  it('should handle Scan → Rename → Project chain', () => {
    const originalSchema = new Schema([
      { name: 'user_id', type: 'ID' },
      { name: 'user_name', type: 'String' },
      { name: 'user_email', type: 'String' }
    ]);

    const scan = new ScanNode('scanUsers', 'Users', originalSchema);
    const rename = new RenameNode('renameVars', {
      'user_id': 'id',
      'user_name': 'name',
      'user_email': 'email'
    });
    
    // Create renamed schema for project
    const renamedSchema = rename.renameSchema(originalSchema);
    const project = new ProjectNode('projIdName', ['id', 'name'], renamedSchema);

    // Connect scan → rename → project
    rename.addInput(scan);
    project.addInput(rename);

    const mockOutput = new MockOutputNode('output1');
    project.addOutput(mockOutput);

    // Input data with original variable names
    const user1 = new Tuple([new ID('u1'), new StringAtom('Alice'), new StringAtom('alice@example.com')]);
    const user2 = new Tuple([new ID('u2'), new StringAtom('Bob'), new StringAtom('bob@example.com')]);

    scan.pushDelta(new Delta(new Set([user1, user2])));

    // Should project to (id, name) after rename
    expect(mockOutput.receivedDeltas.length).toBe(1);
    const finalOutput = mockOutput.receivedDeltas[0].delta;
    expect(finalOutput.adds.size).toBe(2);
    
    const expectedProj1 = new Tuple([new ID('u1'), new StringAtom('Alice')]);
    const expectedProj2 = new Tuple([new ID('u2'), new StringAtom('Bob')]);
    
    const outputTuples = Array.from(finalOutput.adds);
    expect(outputTuples.some(t => t.equals(expectedProj1))).toBe(true);
    expect(outputTuples.some(t => t.equals(expectedProj2))).toBe(true);
  });

  it('should handle complex multi-operator pipeline', () => {
    // Create a complex pipeline: Scan₁ → Project₁ → Union ← Project₂ ← Scan₂
    
    const userSchema = new Schema([
      { name: 'id', type: 'ID' },
      { name: 'name', type: 'String' },
      { name: 'type', type: 'String' }
    ]);

    const adminSchema = new Schema([
      { name: 'admin_id', type: 'ID' },
      { name: 'admin_name', type: 'String' },
      { name: 'role', type: 'String' }
    ]);

    // Left branch: Users → Project(id, name)
    const userScan = new ScanNode('scanUsers', 'Users', userSchema);
    const userProject = new ProjectNode('projUsers', [0, 1]); // id, name

    // Right branch: Admins → Project(admin_id, admin_name) 
    const adminScan = new ScanNode('scanAdmins', 'Admins', adminSchema);
    const adminProject = new ProjectNode('projAdmins', [0, 1]); // admin_id, admin_name

    // Union of projected results
    const union = new UnionNode('unionPeople');

    // Connect the pipeline
    userProject.addInput(userScan);
    adminProject.addInput(adminScan);
    union.addInput(userProject);
    union.addInput(adminProject);

    const mockOutput = new MockOutputNode('output1');
    union.addOutput(mockOutput);

    // Input data
    const user1 = new Tuple([new ID('u1'), new StringAtom('Alice'), new StringAtom('regular')]);
    const user2 = new Tuple([new ID('u2'), new StringAtom('Bob'), new StringAtom('premium')]);
    
    const admin1 = new Tuple([new ID('a1'), new StringAtom('Charlie'), new StringAtom('super')]);
    const admin2 = new Tuple([new ID('u1'), new StringAtom('Alice'), new StringAtom('mod')]); // Same ID as user

    // Process users first
    userScan.pushDelta(new Delta(new Set([user1, user2])));
    
    expect(mockOutput.receivedDeltas.length).toBe(1);
    expect(mockOutput.receivedDeltas[0].source.id).toBe('unionPeople');
    expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(2);

    // Process admins
    adminScan.pushDelta(new Delta(new Set([admin1, admin2])));
    
    expect(mockOutput.receivedDeltas.length).toBe(2);
    expect(mockOutput.receivedDeltas[1].source.id).toBe('unionPeople');
    expect(mockOutput.receivedDeltas[1].delta.adds.size).toBe(1); // admin1 is new, admin2 conflicts with user1

    // Verify final union contains expected projections
    const allProjections = new Set();
    mockOutput.receivedDeltas.forEach(received => {
      received.delta.adds.forEach(tuple => allProjections.add(tuple));
    });

    expect(allProjections.size).toBe(3); // user1/admin2 conflict resolved by union
  });

  it('should handle incremental updates through chain', () => {
    const schema = new Schema([
      { name: 'id', type: 'Integer' },
      { name: 'value', type: 'String' },
      { name: 'active', type: 'Boolean' }
    ]);

    const scan = new ScanNode('scan1', 'Data', schema, true);
    const project = new ProjectNode('proj1', [0, 1]); // id, value

    project.addInput(scan);

    const mockOutput = new MockOutputNode('output1');
    project.addOutput(mockOutput);

    // Initial data
    const tuple1 = new Tuple([new Integer(1), new StringAtom('a'), new BooleanAtom(true)]);
    const tuple2 = new Tuple([new Integer(2), new StringAtom('b'), new BooleanAtom(false)]);
    
    scan.pushDelta(new Delta(new Set([tuple1, tuple2])));
    
    expect(mockOutput.receivedDeltas.length).toBe(1);
    expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(2);

    // Update: remove tuple1, add tuple3, modify tuple2
    const tuple3 = new Tuple([new Integer(3), new StringAtom('c'), new BooleanAtom(true)]);
    const tuple2_updated = new Tuple([new Integer(2), new StringAtom('b_updated'), new BooleanAtom(true)]);
    
    scan.pushDelta(new Delta(
      new Set([tuple3, tuple2_updated]), 
      new Set([tuple1, tuple2])
    ));

    expect(mockOutput.receivedDeltas.length).toBe(2);
    
    // Verify incremental changes
    const incrementalDelta = mockOutput.receivedDeltas[1].delta;
    expect(incrementalDelta.adds.size).toBe(2); // tuple3 projection + tuple2_updated projection
    expect(incrementalDelta.removes.size).toBe(2); // tuple1 projection + original tuple2 projection

    // Verify scan state is correct
    const currentData = scan.getCurrentSet();
    expect(currentData.size).toBe(2);
    expect(currentData.has(tuple3)).toBe(true);
    expect(currentData.has(tuple2_updated)).toBe(true);
    expect(currentData.has(tuple1)).toBe(false);
    expect(currentData.has(tuple2)).toBe(false);
  });
});
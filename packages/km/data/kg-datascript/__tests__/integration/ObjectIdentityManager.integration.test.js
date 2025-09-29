import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';

describe('ObjectIdentityManager Integration', () => {
  let manager;
  let core;

  beforeEach(() => {
    manager = new ObjectIdentityManager();
    core = new KGDataScriptCore({
      ':entity/id': { unique: 'identity' }
    });
  });

  test('Object identity preservation across operations', () => {
    // Create real objects
    const alice = { name: 'Alice', age: 30 };
    const bob = { name: 'Bob', age: 25 };
    const charlie = { name: 'Charlie', age: 35 };
    
    // Register objects
    const aliceId = manager.register(alice);
    const bobId = manager.register(bob);
    const charlieId = manager.register(charlie);
    
    // Store in DataScript with object IDs
    core.transact([
      { ':db/id': -1, ':entity/id': aliceId, ':entity/data': JSON.stringify(alice) },
      { ':db/id': -2, ':entity/id': bobId, ':entity/data': JSON.stringify(bob) },
      { ':db/id': -3, ':entity/id': charlieId, ':entity/data': JSON.stringify(charlie) }
    ]);
    
    // Query back and verify object identity
    const results = core.q({
      find: ['?id', '?data'],
      where: [
        ['?e', ':entity/id', '?id'],
        ['?e', ':entity/data', '?data']
      ]
    });
    
    // Verify we can map back to original objects
    results.forEach(([id, data]) => {
      const originalObject = manager.getObject(id);
      const storedData = JSON.parse(data);
      
      expect(originalObject).toBeDefined();
      expect(originalObject.name).toBe(storedData.name);
      expect(originalObject.age).toBe(storedData.age);
    });
    
    // Verify objects maintain identity
    expect(manager.getObject(aliceId)).toBe(alice);
    expect(manager.getObject(bobId)).toBe(bob);
    expect(manager.getObject(charlieId)).toBe(charlie);
  });

  test('Complex object relationships with identity tracking', () => {
    // Create objects with relationships
    const team = { name: 'Engineering' };
    const lead = { name: 'Alice', role: 'Lead' };
    const dev1 = { name: 'Bob', role: 'Developer' };
    const dev2 = { name: 'Charlie', role: 'Developer' };
    
    // Establish relationships using actual objects
    team.lead = lead;
    team.members = [lead, dev1, dev2];
    lead.team = team;
    dev1.team = team;
    dev2.team = team;
    
    // Register all objects
    const teamId = manager.register(team);
    const leadId = manager.register(lead);
    const dev1Id = manager.register(dev1);
    const dev2Id = manager.register(dev2);
    
    // Store entities with relationships in DataScript
    // First transaction creates entities and gets real entity IDs
    const tx1Result = core.transact([
      { ':db/id': -1, ':entity/id': teamId, ':entity/type': 'team', ':entity/name': team.name },
      { ':db/id': -2, ':entity/id': leadId, ':entity/type': 'person', ':entity/name': lead.name },
      { ':db/id': -3, ':entity/id': dev1Id, ':entity/type': 'person', ':entity/name': dev1.name },
      { ':db/id': -4, ':entity/id': dev2Id, ':entity/type': 'person', ':entity/name': dev2.name }
    ]);
    
    // Get the actual entity IDs from DataScript
    const teamEntityId = tx1Result.tempids.get(-1);
    const leadEntityId = tx1Result.tempids.get(-2);
    const dev1EntityId = tx1Result.tempids.get(-3);
    const dev2EntityId = tx1Result.tempids.get(-4);
    
    // Add relationships using actual entity IDs and object IDs as values
    core.transact([
      ['+', teamEntityId, ':team/lead', leadId],
      ['+', teamEntityId, ':team/member', leadId],
      ['+', teamEntityId, ':team/member', dev1Id],
      ['+', teamEntityId, ':team/member', dev2Id]
    ]);
    
    // Query team members
    const members = core.q({
      find: ['?memberId'],
      where: [
        ['?team', ':entity/id', teamId],
        ['?team', ':team/member', '?memberId']
      ]
    });
    
    // Verify we get back the same object references
    const memberObjects = members.map(([id]) => manager.getObject(id));
    expect(memberObjects).toContain(lead);
    expect(memberObjects).toContain(dev1);
    expect(memberObjects).toContain(dev2);
    
    // Verify circular references are preserved
    expect(team.lead).toBe(lead);
    expect(lead.team).toBe(team);
    expect(dev1.team).toBe(team);
  });

  test('Object updates preserve identity', () => {
    const person = { name: 'Alice', age: 30 };
    const personId = manager.register(person);
    
    // Initial storage
    core.transact([
      { ':db/id': -1, ':entity/id': personId, ':person/name': 'Alice', ':person/age': 30 }
    ]);
    
    // Update the object
    person.age = 31;
    person.city = 'New York';
    
    // Update in DataScript
    const entityResult = core.q({
      find: ['?e'],
      where: [['?e', ':entity/id', personId]]
    });
    
    if (entityResult.length > 0) {
      const entityId = entityResult[0][0];
      core.transact([
        ['+', entityId, ':person/age', 31],
        ['+', entityId, ':person/city', 'New York']
      ]);
    }
    
    // Verify object identity is preserved
    const retrievedObject = manager.getObject(personId);
    expect(retrievedObject).toBe(person);
    expect(retrievedObject.age).toBe(31);
    expect(retrievedObject.city).toBe('New York');
  });

  test('Batch operations with identity management', () => {
    const objects = [];
    const ids = [];
    
    // Create batch of objects
    for (let i = 0; i < 100; i++) {
      const obj = { 
        id: i, 
        name: `Object${i}`, 
        value: Math.random() * 100 
      };
      objects.push(obj);
      ids.push(manager.register(obj));
    }
    
    // Batch insert into DataScript
    const txData = objects.map((obj, i) => ({
      ':db/id': -(i + 1),
      ':entity/id': ids[i],
      ':entity/name': obj.name,
      ':entity/value': obj.value
    }));
    
    core.transact(txData);
    
    // Query all entities
    const allEntities = core.q({
      find: ['?id', '?name'],
      where: [
        ['?e', ':entity/id', '?id'],
        ['?e', ':entity/name', '?name']
      ]
    });
    
    expect(allEntities.length).toBe(100);
    
    // Verify all objects maintain identity
    allEntities.forEach(([id, name]) => {
      const obj = manager.getObject(id);
      expect(obj).toBeDefined();
      expect(obj.name).toBe(name);
      expect(objects).toContain(obj);
    });
    
    // Verify manager tracks all objects
    expect(manager.size()).toBe(100);
  });

  test('Object deletion and identity cleanup', () => {
    const obj1 = { name: 'ToKeep' };
    const obj2 = { name: 'ToDelete' };
    const obj3 = { name: 'AlsoToKeep' };
    
    const id1 = manager.register(obj1);
    const id2 = manager.register(obj2);
    const id3 = manager.register(obj3);
    
    // Store in DataScript
    core.transact([
      { ':db/id': -1, ':entity/id': id1, ':entity/name': obj1.name },
      { ':db/id': -2, ':entity/id': id2, ':entity/name': obj2.name },
      { ':db/id': -3, ':entity/id': id3, ':entity/name': obj3.name }
    ]);
    
    // Delete obj2 from identity manager
    manager.unregister(obj2);
    
    // Verify obj2 is no longer tracked
    expect(manager.getObject(id2)).toBeUndefined();
    expect(manager.getId(obj2)).toBeUndefined();
    
    // Verify other objects are still tracked
    expect(manager.getObject(id1)).toBe(obj1);
    expect(manager.getObject(id3)).toBe(obj3);
    
    // Query DataScript - entity still exists there
    const remaining = core.q({
      find: ['?id'],
      where: [['?e', ':entity/id', '?id']]
    });
    
    // DataScript still has all 3 entities
    expect(remaining.length).toBe(3);
    
    // But only 2 can be mapped to objects
    const mappedObjects = remaining
      .map(([id]) => manager.getObject(id))
      .filter(obj => obj !== undefined);
    
    expect(mappedObjects.length).toBe(2);
    expect(mappedObjects).toContain(obj1);
    expect(mappedObjects).toContain(obj3);
    expect(mappedObjects).not.toContain(obj2);
  });

  test('Identity manager with DataScript transactions', () => {
    const manager2 = new ObjectIdentityManager();
    const core2 = new KGDataScriptCore();
    
    // Simulate a complete workflow
    const workflow = {
      createUser: (name, age) => {
        const user = { name, age };
        const id = manager2.register(user);
        core2.transact([
          { ':db/id': -1, ':user/id': id, ':user/name': name, ':user/age': age }
        ]);
        return user;
      },
      
      findUserById: (objectId) => {
        const obj = manager2.getObject(objectId);
        if (!obj) return null;
        
        const result = core2.q({
          find: ['?name', '?age'],
          where: [
            ['?e', ':user/id', objectId],
            ['?e', ':user/name', '?name'],
            ['?e', ':user/age', '?age']
          ]
        });
        
        if (result.length > 0) {
          // Ensure object properties match database
          const [name, age] = result[0];
          obj.name = name;
          obj.age = age;
        }
        
        return obj;
      }
    };
    
    // Create users
    const alice = workflow.createUser('Alice', 30);
    const bob = workflow.createUser('Bob', 25);
    
    // Get their IDs
    const aliceId = manager2.getId(alice);
    const bobId = manager2.getId(bob);
    
    // Find users by ID
    const foundAlice = workflow.findUserById(aliceId);
    const foundBob = workflow.findUserById(bobId);
    
    // Verify object identity is preserved
    expect(foundAlice).toBe(alice);
    expect(foundBob).toBe(bob);
    expect(foundAlice.name).toBe('Alice');
    expect(foundBob.age).toBe(25);
  });
});
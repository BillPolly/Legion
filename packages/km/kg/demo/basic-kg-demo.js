#!/usr/bin/env node

/**
 * Basic Knowledge Graph Demo
 * 
 * This demo showcases the core functionality of the Knowledge Graph system,
 * including object serialization, class representation, and basic querying.
 */

import { KGEngine } from '../src/core/KGEngine.js';
import { ClassSerializer } from '../src/serialization/ClassSerializer.js';
import { ObjectReconstructor } from '../src/reconstruction/ObjectReconstructor.js';
import { IDManager } from '../src/core/IDManager.js';
import '../src/serialization/ObjectExtensions.js'; // Load object extensions

console.log('🧠 Basic Knowledge Graph Demo\n');

// Initialize the knowledge graph
const kg = new KGEngine();
const idManager = new IDManager();
const classSerializer = new ClassSerializer(idManager);
const reconstructor = new ObjectReconstructor(kg);

// Sample classes to demonstrate
class Person {
  constructor(name, age, email) {
    this.name = name;
    this.age = age;
    this.email = email;
  }

  greet(other) {
    return `Hello ${other.name}, I'm ${this.name}!`;
  }

  getInfo() {
    return `${this.name} (${this.age} years old)`;
  }

  static getSpecies() {
    return 'Homo sapiens';
  }
}

class Company {
  constructor(name, industry, founded) {
    this.name = name;
    this.industry = industry;
    this.founded = founded;
    this.employees = [];
  }

  addEmployee(person) {
    this.employees.push(person);
    return this;
  }

  getEmployeeCount() {
    return this.employees.length;
  }

  static getType() {
    return 'Business Entity';
  }
}

// Demo 1: Object Serialization
async function demoObjectSerialization() {
  console.log('📦 Demo 1: Object Serialization');
  console.log('===============================');
  
  // Create sample objects
  const john = new Person('John Smith', 30, 'john@example.com');
  const jane = new Person('Jane Doe', 25, 'jane@example.com');
  const acme = new Company('Acme Corp', 'Technology', 2010);
  
  acme.addEmployee(john).addEmployee(jane);
  
  console.log('Original objects:');
  console.log(`  Person: ${john.getInfo()}`);
  console.log(`  Person: ${jane.getInfo()}`);
  console.log(`  Company: ${acme.name} (${acme.getEmployeeCount()} employees)`);
  
  // Serialize objects to triples
  const johnTriples = john.toTriples();
  const janeTriples = jane.toTriples();
  const acmeTriples = acme.toTriples();
  
  console.log(`\nSerialized to ${johnTriples.length + janeTriples.length + acmeTriples.length} triples`);
  
  // Add to knowledge graph
  for (const [s, p, o] of [...johnTriples, ...janeTriples, ...acmeTriples]) {
    await kg.addTriple(s, p, o);
  }
  
  console.log('✅ Objects serialized to knowledge graph\n');
}

// Demo 2: Class Serialization
async function demoClassSerialization() {
  console.log('🏗️  Demo 2: Class Serialization');
  console.log('==============================');
  
  // Serialize class definitions
  const personClassTriples = classSerializer.serializeClass(Person);
  const companyClassTriples = classSerializer.serializeClass(Company);
  
  console.log(`Person class serialized to ${personClassTriples.length} triples`);
  console.log(`Company class serialized to ${companyClassTriples.length} triples`);
  
  // Add class definitions to knowledge graph
  for (const [s, p, o] of [...personClassTriples, ...companyClassTriples]) {
    await kg.addTriple(s, p, o);
  }
  
  console.log('✅ Class definitions stored in knowledge graph\n');
}

// Demo 3: Basic Querying
async function demoBasicQuerying() {
  console.log('🔍 Demo 3: Basic Querying');
  console.log('=========================');
  
  // Find all people
  const people = await kg.query(null, 'rdf:type', Person.getId());
  console.log(`Found ${people.length} people:`);
  people.forEach(([personId]) => {
    console.log(`  - ${personId}`);
  });
  
  // Find all names
  const names = await kg.query(null, 'name', null);
  console.log(`\nFound ${names.length} names:`);
  names.forEach(([entityId, , name]) => {
    console.log(`  - ${entityId}: ${name}`);
  });
  
  // Find companies
  const companies = await kg.query(null, 'rdf:type', Company.getId());
  console.log(`\nFound ${companies.length} companies:`);
  companies.forEach(([companyId]) => {
    console.log(`  - ${companyId}`);
  });
  
  console.log();
}

// Demo 4: Object Reconstruction
async function demoObjectReconstruction() {
  console.log('🔄 Demo 4: Object Reconstruction');
  console.log('================================');
  
  // Find a person ID to reconstruct
  const people = await kg.query(null, 'rdf:type', Person.getId());
  if (people.length > 0) {
    const personId = people[0][0];
    console.log(`Reconstructing person: ${personId}`);
    
    try {
      const reconstructedPerson = await reconstructor.reconstructObject(personId);
      
      if (reconstructedPerson) {
        console.log(`✅ Reconstructed: ${reconstructedPerson.getInfo()}`);
        console.log(`  Email: ${reconstructedPerson.email}`);
        
        // Test method execution
        const greeting = reconstructedPerson.greet({ name: 'Demo User' });
        console.log(`  Greeting: ${greeting}`);
      } else {
        console.log('❌ Failed to reconstruct person');
      }
    } catch (error) {
      console.log(`❌ Reconstruction error: ${error.message}`);
    }
  }
  
  console.log();
}

// Demo 5: Knowledge Graph Statistics
async function demoKGStatistics() {
  console.log('📊 Demo 5: Knowledge Graph Statistics');
  console.log('=====================================');
  
  const totalTriples = await kg.size();
  console.log(`Total triples in knowledge graph: ${totalTriples}`);
  
  // Count different types of entities
  const entityTypes = await kg.query(null, 'rdf:type', null);
  const typeCount = new Map();
  
  entityTypes.forEach(([, , type]) => {
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
  });
  
  console.log('\nEntity type distribution:');
  for (const [type, count] of typeCount) {
    console.log(`  - ${type}: ${count}`);
  }
  
  // Count properties
  const allTriples = await kg.query(null, null, null);
  const propertyCount = new Map();
  
  allTriples.forEach(([, predicate]) => {
    propertyCount.set(predicate, (propertyCount.get(predicate) || 0) + 1);
  });
  
  console.log('\nTop 10 most used properties:');
  const sortedProperties = Array.from(propertyCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  sortedProperties.forEach(([property, count]) => {
    console.log(`  - ${property}: ${count}`);
  });
  
  console.log();
}

// Demo 6: Relationship Queries
async function demoRelationshipQueries() {
  console.log('🔗 Demo 6: Relationship Queries');
  console.log('===============================');
  
  // Find all relationships between entities
  const relationships = await kg.query(null, null, null);
  const entityRelations = relationships.filter(([s, p, o]) => 
    !p.startsWith('rdf:') && 
    !p.startsWith('kg:') && 
    p !== 'name' && 
    p !== 'age' && 
    p !== 'email' &&
    p !== 'industry' &&
    p !== 'founded'
  );
  
  console.log(`Found ${entityRelations.length} entity relationships:`);
  entityRelations.forEach(([subject, predicate, object]) => {
    console.log(`  - ${subject} --${predicate}--> ${object}`);
  });
  
  console.log();
}

// Main demo execution
async function runDemo() {
  try {
    await demoObjectSerialization();
    await demoClassSerialization();
    await demoBasicQuerying();
    await demoObjectReconstruction();
    await demoKGStatistics();
    await demoRelationshipQueries();
    
    console.log('🎉 Demo completed successfully!');
    console.log('\nThe Knowledge Graph system demonstrates:');
    console.log('• Perfect isomorphism between JavaScript objects and KG entities');
    console.log('• Automatic serialization of objects and classes to triples');
    console.log('• Self-describing schema stored as knowledge graph data');
    console.log('• Object reconstruction from knowledge graph triples');
    console.log('• Basic querying and relationship discovery');
    console.log('• Statistical analysis of knowledge graph content');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the demo
runDemo();

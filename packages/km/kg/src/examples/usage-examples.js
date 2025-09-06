import crypto from 'crypto';
import { KnowledgeGraphSystem } from '../system/KnowledgeGraphSystem.js';
import { Relationship } from '../relationships/Relationship.js';
import { KnowsRelationship } from '../relationships/KnowsRelationship.js';
import { WorksWithRelationship } from '../relationships/WorksWithRelationship.js';
import { Belief } from '../beliefs/Belief.js';
import { MethodExecution } from '../beliefs/MethodExecution.js';
import { WeatherTool } from './WeatherTool.js';

// Example usage with full RDF round-trip
export function fullRoundTripExample() {
  const kg = new KnowledgeGraphSystem();

  // 1. Create JavaScript objects
  class Person {
    constructor(name, age) {
      this.name = name;
      this.age = age;
      this.friends = [];
    }

    greet(other) {
      return `Hello ${other.name}, I'm ${this.name}`;
    }

    static getSpecies() {
      return "Homo sapiens";
    }
  }

  const john = new Person("John", 30);
  const jane = new Person("Jane", 28);
  john.friends.push(jane);

  // 2. Register class with metadata
  kg.registerTool(Person, {
    namespace: 'http://example.org/people#',
    includeBody: true,
    methods: {
      greet: {
        goal: 'social_interaction',
        effect: 'greeting_delivered',
        parameters: [
          { name: 'other', type: 'Person', required: true }
        ],
        returnType: 'String'
      }
    }
  });

  // 3. Add objects to KG
  const johnId = kg.addObject(john);
  const janeId = kg.addObject(jane);

  console.log('=== Original Objects ===');
  console.log('John:', john);
  console.log('Jane:', jane);

  // 4. Export to various RDF formats
  console.log('\n=== RDF Serializations ===');
  
  const turtle = kg.exportToTurtle();
  console.log('Turtle:', turtle);

  const jsonLD = kg.exportToJsonLD();
  console.log('JSON-LD:', JSON.stringify(jsonLD, null, 2));

  const ntriples = kg.exportToNTriples();
  console.log('N-Triples:', ntriples);

  // 5. Clear the KG and reimport from RDF
  console.log('\n=== Round-Trip Test ===');
  const originalKG = kg;
  const newKG = new KnowledgeGraphSystem();
  
  // Import from Turtle
  newKG.importFromTurtle(turtle);

  // 6. Reconstruct objects and classes
  const PersonClass = newKG.getClass('Person_' + crypto.createHash('sha256').update('Person').digest('hex').substring(0, 8));
  const reconstructedJohn = newKG.getObject(johnId);
  const reconstructedJane = newKG.getObject(janeId);

  console.log('Reconstructed John:', reconstructedJohn);
  console.log('Reconstructed Jane:', reconstructedJane);
  console.log('Reconstructed Person class:', PersonClass);

  // 7. Test functionality
  try {
    const greeting = reconstructedJohn.greet(reconstructedJane);
    console.log('Greeting test:', greeting);
  } catch (e) {
    console.log('Greeting test failed:', e.message);
  }

  // 8. Test class instantiation
  try {
    const newPerson = new PersonClass('Bob', 35);
    console.log('New person created:', newPerson);
  } catch (e) {
    console.log('Class instantiation failed:', e.message);
  }

  return {
    original: { john, jane, PersonClass: Person },
    serialized: { turtle, jsonLD, ntriples },
    reconstructed: { john: reconstructedJohn, jane: reconstructedJane, PersonClass }
  };
}

// Test RDF parsing
export function testRDFParsing() {
  const kg = new KnowledgeGraphSystem();

  // Sample Turtle data
  const turtleData = `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix kg: <http://example.org/kg#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<john_123> rdf:type <Person_abc> ;
           foaf:name "John Doe" ;
           foaf:age "30"^^<http://www.w3.org/2001/XMLSchema#integer> ;
           foaf:knows <jane_456> .

<jane_456> rdf:type <Person_abc> ;
           foaf:name "Jane Smith" ;
           foaf:age "28"^^<http://www.w3.org/2001/XMLSchema#integer> .

<Person_abc> rdf:type kg:EntityClass ;
             kg:className "Person" .
`;

  // Parse Turtle
  kg.importFromTurtle(turtleData);

  // Query the imported data
  const people = kg.query()
    .where('?', 'rdf:type', 'Person_abc')
    .execute();

  console.log('Imported people:', people);

  const friendships = kg.query()
    .where('?', 'foaf:knows', '?')
    .execute();

  console.log('Friendships:', friendships);

  return kg;
}

// Complete example demonstrating all features from the design document
export function comprehensiveExample() {
  const kg = new KnowledgeGraphSystem();

  console.log('=== 1. Relationship Reification Example ===');
  
  // Create people
  class Person {
    constructor(name, age) {
      this.name = name;
      this.age = age;
    }

    greet(other) {
      return `Hello ${other.name}, I'm ${this.name}`;
    }

    static getSpecies() {
      return "Homo sapiens";
    }
  }

  const john = new Person("John", 30);
  const jane = new Person("Jane", 28);
  const bob = new Person("Bob", 35);

  // Add objects to KG
  kg.addObject(john);
  kg.addObject(jane);
  kg.addObject(bob);

  // Create reified relationships
  const friendship = new KnowsRelationship(john, jane, {
    started: '2020-01-15',
    confidence: 0.95,
    howMet: 'university',
    closeness: 'close_friend'
  });

  const workRelationship = new WorksWithRelationship(john, bob, {
    started: '2022-03-01',
    department: 'Engineering',
    role: 'colleagues'
  });

  kg.addRelationship(friendship);
  kg.addRelationship(workRelationship);

  console.log('Friendship relationship added with metadata');

  console.log('\n=== 2. Agent Belief System Example ===');

  // Create an agent
  const agent = new Person("Agent Smith", 0);
  kg.addObject(agent);

  // Agent has beliefs about relationships
  const belief1 = new Belief(agent, john, 'knows', jane, {
    confidence: 0.8,
    source: 'observed_interaction',
    timestamp: '2024-06-21T10:30:00Z'
  });

  const belief2 = new Belief(agent, jane, 'likes', 'coffee', {
    confidence: 0.6,
    source: 'conversation'
  });

  kg.addBelief(belief1);
  kg.addBelief(belief2);

  console.log('Agent beliefs added to KG');

  console.log('\n=== 3. Method Execution Tracking ===');

  // Track method execution
  const execution = new MethodExecution(
    'Person.greet',
    john,
    [jane],
    {
      timestamp: '2024-06-21T11:00:00Z',
      succeeded: true,
      result: 'Hello Jane, I\'m John',
      duration: 50
    }
  );

  kg.addMethodExecution(execution);
  console.log('Method execution tracked');

  console.log('\n=== 4. Tool Registration with Dependencies ===');

  // Enhanced WeatherTool with dependencies
  kg.registerTool(WeatherTool, {
    capabilities: ['weather_information', 'forecast'],
    category: 'data_retrieval',
    requiresCredential: 'api_key',
    requiresNetwork: true,
    namespace: 'http://example.org/tools#',
    includeBody: true,
    methods: {
      getCurrentWeather: {
        goal: 'get_current_conditions',
        effect: 'weather_data_retrieved',
        preconditions: ['valid_location'],
        subgoals: ['validate_location', 'fetch_weather_data'],
        parameters: [
          { name: 'location', type: 'String', required: true, description: 'Geographic location or city name' },
          { name: 'units', type: 'String', required: false, defaultValue: 'metric', allowedValues: ['metric', 'imperial', 'kelvin'] }
        ],
        returnType: 'WeatherData'
      },
      getForecast: {
        goal: 'get_weather_forecast',
        effect: 'forecast_data_retrieved',
        preconditions: ['valid_location'],
        subgoals: ['validate_location', 'fetch_forecast_data'],
        parameters: [
          { name: 'location', type: 'String', required: true },
          { name: 'days', type: 'Number', required: false, defaultValue: 5 }
        ],
        returnType: 'ForecastData'
      }
    }
  });

  // Travel planner that depends on weather tool
  class TravelPlannerTool {
    constructor() {}

    createItinerary(destination, startDate, endDate) {
      // Would use weather and calendar tools
      return { destination, startDate, endDate, activities: [] };
    }
  }

  kg.registerTool(TravelPlannerTool, {
    capabilities: ['travel_planning', 'itinerary_creation'],
    category: 'planning',
    dependencies: [
      { tool: WeatherTool, type: 'dependsOn' },
      { tool: Person, type: 'requires' } // Requires person data
    ],
    methods: {
      createItinerary: {
        goal: 'create_travel_itinerary',
        effect: 'itinerary_created',
        subgoals: ['get_weather_forecast', 'check_availability'],
        parameters: [
          { name: 'destination', type: 'String', required: true },
          { name: 'startDate', type: 'String', required: true },
          { name: 'endDate', type: 'String', required: true }
        ],
        returnType: 'Itinerary'
      }
    }
  });

  console.log('Tools with dependencies registered');

  console.log('\n=== 5. Goal-Based Planning ===');

  const availableTools = [
    WeatherTool.getId(),
    TravelPlannerTool.getId()
  ];

  const planResult = kg.canAchieveGoal('create_travel_itinerary', availableTools);
  console.log('Can achieve travel itinerary goal:', planResult.achievable);
  if (planResult.achievable) {
    console.log('Execution chain:', planResult.chain);
  }

  console.log('\n=== 6. Schema Generation ===');

  // Generate JSON schemas for classes
  const jsonSchemas = kg.generateJSONSchemas();
  console.log('Generated JSON schemas for classes:', Object.keys(jsonSchemas));

  // Generate OpenAPI schemas
  const openAPISchemas = kg.generateOpenAPISchemas();
  console.log('OpenAPI schemas generated');

  // Generate LLM tool schemas
  const toolSchemas = kg.generateToolSchemas();
  console.log('LLM tool schemas generated:', toolSchemas.length, 'tools');

  console.log('\n=== 7. Multi-Format Export ===');

  // Export to all supported formats
  const exports = {
    turtle: kg.exportToTurtle(),
    ntriples: kg.exportToNTriples(),
    jsonld: kg.exportToJsonLD(),
    rdfxml: kg.exportToRDFXML(),
    cypher: kg.exportToCypher(),
    graphml: kg.exportToGraphML()
  };

  console.log('Exported to formats:', Object.keys(exports));
  console.log('Turtle preview:', exports.turtle.split('\n').slice(0, 10).join('\n') + '...');

  console.log('\n=== 8. Schema Evolution ===');

  // Evolve the Person class by adding new properties
  const personClassId = Person.getId();
  kg.evolveSchema(personClassId, {
    addProperty: {
      name: 'email',
      type: 'String',
      required: false,
      description: 'Email address'
    }
  });

  kg.evolveSchema(personClassId, {
    addMethod: {
      name: 'sendEmail',
      parameters: [
        { name: 'to', type: 'String', required: true },
        { name: 'subject', type: 'String', required: true },
        { name: 'body', type: 'String', required: true }
      ],
      returnType: 'Boolean',
      goal: 'send_email',
      effect: 'email_sent'
    }
  });

  console.log('Person class evolved with email property and sendEmail method');

  console.log('\n=== 9. Complex Queries ===');

  // Query relationships with metadata
  const relationshipsWithConfidence = kg.query()
    .where('?', 'kg:confidence', '?')
    .execute();
  console.log('Relationships with confidence scores:', relationshipsWithConfidence.length);

  // Query beliefs by agent
  const agentBeliefs = kg.query()
    .where(agent.getId(), 'kg:believes', '?')
    .execute();
  console.log('Agent beliefs:', agentBeliefs.length);

  // Query method executions
  const methodExecutions = kg.query()
    .where('?', 'rdf:type', 'kg:MethodExecution')
    .execute();
  console.log('Method executions tracked:', methodExecutions.length);

  // Query tools by capability
  const weatherCapableTools = kg.findTools({ capability: 'weather_information' });
  console.log('Weather-capable tools:', weatherCapableTools.length);

  console.log('\n=== 10. Full Round-Trip Test ===');

  // Test complete round-trip with relationships
  const testPerson = new Person("Test User", 25);
  testPerson.email = "test@example.com";
  
  const roundTripResult = kg.roundTripTest(testPerson);
  console.log('Round-trip test completed successfully:', !!roundTripResult.reconstructed);

  return {
    kg,
    objects: { john, jane, bob, agent },
    relationships: { friendship, workRelationship },
    beliefs: { belief1, belief2 },
    execution,
    schemas: { jsonSchemas, openAPISchemas, toolSchemas },
    exports,
    roundTripResult
  };
}

// Specialized examples for different aspects

export function relationshipReificationExample() {
  const kg = new KnowledgeGraphSystem();
  
  class Employee {
    constructor(name, department) {
      this.name = name;
      this.department = department;
    }
  }

  const alice = new Employee("Alice", "Engineering");
  const bob = new Employee("Bob", "Engineering");
  const carol = new Employee("Carol", "Marketing");

  kg.addObject(alice);
  kg.addObject(bob);
  kg.addObject(carol);

  // Create various types of relationships
  const managerRelationship = new Relationship(alice, bob, 'manages', {
    started: '2023-01-01',
    confidence: 1.0,
    context: 'organizational'
  });

  const collaborationRelationship = new Relationship(bob, carol, 'collaborates_with', {
    started: '2023-06-01',
    confidence: 0.8,
    context: 'project_based',
    source: 'project_assignment'
  });

  kg.addRelationship(managerRelationship);
  kg.addRelationship(collaborationRelationship);

  // Export as property graph to see the rich relationship data
  const cypher = kg.exportToCypher();
  console.log('Property graph representation:');
  console.log(cypher);

  return kg;
}

export function beliefSystemExample() {
  const kg = new KnowledgeGraphSystem();

  class Agent {
    constructor(name) {
      this.name = name;
      this.beliefs = [];
    }

    observe(subject, predicate, object, confidence = 0.7) {
      const belief = new Belief(this, subject, predicate, object, {
        confidence,
        source: 'direct_observation',
        timestamp: new Date().toISOString()
      });
      this.beliefs.push(belief);
      return belief;
    }

    infer(subject, predicate, object, confidence = 0.5) {
      const belief = new Belief(this, subject, predicate, object, {
        confidence,
        source: 'inference',
        timestamp: new Date().toISOString()
      });
      this.beliefs.push(belief);
      return belief;
    }
  }

  const agent1 = new Agent("Observer Agent");
  const agent2 = new Agent("Reasoning Agent");

  const person1 = { name: "John" };
  const person2 = { name: "Jane" };

  kg.addObject(agent1);
  kg.addObject(agent2);
  kg.addObject(person1);
  kg.addObject(person2);

  // Agents form beliefs
  const observedBelief = agent1.observe(person1, 'location', 'office', 0.9);
  const inferredBelief = agent2.infer(person1, 'knows', person2, 0.6);

  kg.addBelief(observedBelief);
  kg.addBelief(inferredBelief);

  // Query beliefs by confidence
  const highConfidenceBeliefs = kg.query()
    .where('?', 'kg:confidence', '?')
    .execute()
    .filter(([, , confidence]) => parseFloat(confidence) > 0.8);

  console.log('High confidence beliefs:', highConfidenceBeliefs);

  return kg;
}

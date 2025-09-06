/**
 * Schema Validation System Demo
 * 
 * This demo showcases the core functionality of the schema validation system:
 * 1. Loading JSON Schema into KG triples
 * 2. Querying schema information from the KG
 * 3. Validating objects against schemas stored in the KG
 * 4. Round-trip conversion (JSON Schema → KG → JSON Schema)
 */

import { KGEngine } from '../core/KGEngine.js';
import { InMemoryTripleStore } from '../storage/InMemoryTripleStore.js';
import { JSONSchemaLoader } from '../schema/loaders/JSONSchemaLoader.js';
import { SchemaDefinition } from '../schema/core/SchemaDefinition.js';

export async function schemaValidationDemo() {
  console.log('=== Schema Validation System Demo ===\n');

  // 1. Setup KG Engine
  const store = new InMemoryTripleStore();
  const kg = new KGEngine(store);
  const loader = new JSONSchemaLoader(kg);

  console.log('1. Setting up Knowledge Graph Engine...');
  console.log(`   Storage type: ${store.getMetadata().type}`);

  // 2. Define a JSON Schema
  const personSchema = {
    type: "object",
    title: "Person",
    description: "A person with basic information",
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description: "Full name of the person"
      },
      age: {
        type: "integer",
        minimum: 0,
        maximum: 150,
        description: "Age in years"
      },
      email: {
        type: "string",
        format: "email",
        pattern: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$",
        description: "Email address"
      },
      address: {
        type: "object",
        properties: {
          street: { type: "string" },
          city: { type: "string" },
          zipCode: { type: "string", pattern: "^\\d{5}$" }
        },
        required: ["street", "city"]
      },
      hobbies: {
        type: "array",
        items: { type: "string" },
        minItems: 0,
        maxItems: 10,
        uniqueItems: true
      }
    },
    required: ["name", "age"],
    additionalProperties: false
  };

  console.log('\n2. Loading JSON Schema into Knowledge Graph...');
  console.log('   Schema:', JSON.stringify(personSchema, null, 2));

  // 3. Load schema into KG
  await loader.loadSchema(personSchema, 'schema:Person');
  console.log('   ✅ Schema loaded successfully');

  // 4. Query schema information from KG
  console.log('\n3. Querying schema information from KG...');
  
  const schemaTriples = kg.query('schema:Person', null, null);
  console.log(`   Schema has ${schemaTriples.length} triples`);

  const propertyTriples = kg.query('schema:Person', 'kg:hasProperty', null);
  console.log(`   Schema has ${propertyTriples.length} properties:`);
  
  propertyTriples.forEach(([,, propId]) => {
    const nameTriple = kg.query(propId, 'kg:propertyName', null)[0];
    const typeTriple = kg.query(propId, 'kg:dataType', null)[0];
    const requiredTriple = kg.query(propId, 'kg:required', null)[0];
    
    if (nameTriple && typeTriple) {
      console.log(`     - ${nameTriple[2]} (${typeTriple[2]}) ${requiredTriple?.[2] ? '[required]' : '[optional]'}`);
    }
  });

  // 5. Create SchemaDefinition and explore its capabilities
  console.log('\n4. Creating SchemaDefinition object...');
  const schemaDef = new SchemaDefinition('schema:Person', kg);
  
  console.log(`   Schema type: ${schemaDef.getSchemaType()}`);
  console.log(`   Required properties: [${schemaDef.getRequiredProperties().join(', ')}]`);
  console.log(`   Allows additional properties: ${schemaDef.allowsAdditionalProperties()}`);
  console.log(`   Total properties: ${schemaDef.getProperties().length}`);

  // 6. Test validation with valid objects
  console.log('\n5. Testing validation with valid objects...');
  
  const validPerson = {
    name: "John Doe",
    age: 30,
    email: "john.doe@example.com",
    address: {
      street: "123 Main St",
      city: "Anytown",
      zipCode: "12345"
    },
    hobbies: ["reading", "swimming", "coding"]
  };

  console.log('   Valid person:', JSON.stringify(validPerson, null, 2));
  
  const validResult = schemaDef.validate(validPerson);
  console.log(`   ✅ Validation result: ${validResult.isValid ? 'VALID' : 'INVALID'}`);
  console.log(`   Conformance score: ${validResult.conformanceScore.toFixed(2)}`);
  if (validResult.errors.length > 0) {
    console.log('   Errors:', validResult.errors);
  }

  // 7. Test validation with invalid objects
  console.log('\n6. Testing validation with invalid objects...');
  
  const invalidPerson = {
    name: "", // Too short
    age: -5,  // Below minimum
    email: "invalid-email", // Invalid format
    address: {
      street: "123 Main St"
      // Missing required 'city'
    },
    hobbies: ["reading", "reading"], // Duplicate items
    extraField: "not allowed" // Additional property
  };

  console.log('   Invalid person:', JSON.stringify(invalidPerson, null, 2));
  
  const invalidResult = schemaDef.validate(invalidPerson);
  console.log(`   ❌ Validation result: ${invalidResult.isValid ? 'VALID' : 'INVALID'}`);
  console.log(`   Conformance score: ${invalidResult.conformanceScore.toFixed(2)}`);
  console.log(`   Errors found: ${invalidResult.errors.length}`);
  
  invalidResult.errors.forEach((error, index) => {
    console.log(`     ${index + 1}. [${error.type}] ${error.path || 'root'}: ${error.message}`);
  });

  // 8. Test round-trip conversion
  console.log('\n7. Testing round-trip conversion (KG → JSON Schema)...');
  
  const reconstructedSchema = schemaDef.toJSONSchema();
  console.log('   Reconstructed schema:', JSON.stringify(reconstructedSchema, null, 2));
  
  // Compare key properties
  const originalProps = Object.keys(personSchema.properties || {});
  const reconstructedProps = Object.keys(reconstructedSchema.properties || {});
  
  console.log(`   Original properties: [${originalProps.join(', ')}]`);
  console.log(`   Reconstructed properties: [${reconstructedProps.join(', ')}]`);
  console.log(`   ✅ Round-trip successful: ${originalProps.length === reconstructedProps.length}`);

  // 9. Performance test
  console.log('\n8. Performance testing...');
  
  const testObjects = [];
  for (let i = 0; i < 1000; i++) {
    testObjects.push({
      name: `Person ${i}`,
      age: Math.floor(Math.random() * 100),
      email: `person${i}@example.com`
    });
  }

  const startTime = Date.now();
  let validCount = 0;
  
  testObjects.forEach(obj => {
    const result = schemaDef.validate(obj);
    if (result.isValid) validCount++;
  });
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  const validationsPerSecond = Math.round((testObjects.length / duration) * 1000);
  
  console.log(`   Validated ${testObjects.length} objects in ${duration}ms`);
  console.log(`   Performance: ${validationsPerSecond} validations/second`);
  console.log(`   Valid objects: ${validCount}/${testObjects.length}`);

  // 10. Schema statistics
  console.log('\n9. Knowledge Graph statistics...');
  
  const totalTriples = await kg.size();
  const schemaTripleCount = kg.query(null, 'rdf:type', 'kg:Schema').length;
  const propertyTripleCount = kg.query(null, 'rdf:type', 'kg:Property').length;
  const vocabularyTripleCount = kg.query(null, 'rdf:type', 'rdfs:Class').length;
  
  console.log(`   Total triples in KG: ${totalTriples}`);
  console.log(`   Schema entities: ${schemaTripleCount}`);
  console.log(`   Property entities: ${propertyTripleCount}`);
  console.log(`   Vocabulary classes: ${vocabularyTripleCount}`);

  console.log('\n=== Demo completed successfully! ===');
  
  return {
    kg,
    loader,
    schemaDef,
    validationResults: {
      valid: validResult,
      invalid: invalidResult
    },
    performance: {
      validationsPerSecond,
      totalObjects: testObjects.length,
      validObjects: validCount
    },
    statistics: {
      totalTriples,
      schemaTripleCount,
      propertyTripleCount,
      vocabularyTripleCount
    }
  };
}

// Export for use in other demos
export {
  schemaValidationDemo as default
};

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  schemaValidationDemo().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}

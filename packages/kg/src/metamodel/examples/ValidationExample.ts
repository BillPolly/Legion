/**
 * Example demonstrating the comprehensive metamodel validation system
 * 
 * This example shows how to use the MetamodelValidator to validate a metamodel
 * with the two-phase approach: load everything first, then validate all references.
 */

import { MetamodelValidator, MetamodelEntity } from '../MetamodelValidator';
import { MetamodelLoader } from '../MetamodelLoader';

/**
 * Example of a well-formed metamodel that should pass validation
 */
export const validMetamodelExample: MetamodelEntity[] = [
  // Core root entity
  {
    _id: 'Thing',
    subtypeOf: 'Thing',
    attributes: ['name', 'description', 'metadata'],
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'The root of all entities in the metamodel'
    }
  },

  // Core metamodel entities
  {
    _id: 'Attribute',
    subtypeOf: 'Thing',
    attributes: ['domain', 'range', 'cardinality', 'is-dependent'],
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'Represents attributes that can be applied to entities'
    }
  },

  {
    _id: 'Relationship',
    subtypeOf: 'Thing',
    attributes: ['dependent-end', 'independent-end'],
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'Represents binary relationships between entities'
    }
  },

  // Type hierarchy
  {
    _id: 'Kind',
    subtypeOf: 'Thing',
    attributes: [],
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'The category for types of things'
    }
  },

  {
    _id: 'AtomicThing',
    subtypeOf: 'Kind',
    attributes: [],
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'Entities with no parts - values, measures, etc.'
    }
  },

  {
    _id: 'CompoundThing',
    subtypeOf: 'Kind',
    attributes: ['parts', 'essence'],
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'Entities that have parts'
    }
  },

  // Value types
  {
    _id: 'Value',
    subtypeOf: 'AtomicThing',
    attributes: ['value'],
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'Atomic values like strings, numbers, booleans'
    }
  },

  {
    _id: 'String',
    subtypeOf: 'Value',
    attributes: [],
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'String primitive type'
    }
  },

  {
    _id: 'Number',
    subtypeOf: 'Value',
    attributes: [],
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'Number primitive type'
    }
  },

  {
    _id: 'Boolean',
    subtypeOf: 'Value',
    attributes: [{ 'allowed-values': ['true', 'false'] }],
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'Boolean primitive type'
    }
  },

  // Attribute definitions
  {
    _id: 'name',
    subtypeOf: 'Attribute',
    attributes: {
      domain: 'Thing',
      range: 'String',
      cardinality: '1',
      'is-dependent': true,
      constraints: ['non-empty']
    },
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'The name attribute for all things'
    }
  },

  {
    _id: 'description',
    subtypeOf: 'Attribute',
    attributes: {
      domain: 'Thing',
      range: 'String',
      cardinality: '0..1',
      'is-dependent': true
    },
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'Optional description for all things'
    }
  },

  {
    _id: 'domain',
    subtypeOf: 'Attribute',
    attributes: {
      domain: 'Attribute',
      range: 'String',
      cardinality: '1',
      'is-dependent': true,
      constraints: ['valid-type-name']
    },
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'The domain of an attribute'
    }
  },

  {
    _id: 'range',
    subtypeOf: 'Attribute',
    attributes: {
      domain: 'Attribute',
      range: 'String',
      cardinality: '1',
      'is-dependent': true,
      constraints: ['valid-type-name']
    },
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'The range of an attribute'
    }
  },

  {
    _id: 'cardinality',
    subtypeOf: 'Attribute',
    attributes: {
      domain: 'Attribute',
      range: 'String',
      cardinality: '1',
      'is-dependent': true,
      constraints: ['cardinality-format']
    },
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'The cardinality constraint of an attribute'
    }
  },

  {
    _id: 'is-dependent',
    subtypeOf: 'Attribute',
    attributes: {
      domain: 'Attribute',
      range: 'Boolean',
      cardinality: '1',
      'is-dependent': true
    },
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'Whether an attribute is ontologically dependent'
    }
  },

  // Relationship definitions
  {
    _id: 'namingRelationship',
    subtypeOf: 'Relationship',
    attributes: {
      'dependent-end': 'name',
      'independent-end': 'namedThing'
    },
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'The relationship between things and their names'
    }
  },

  // Inverse attribute for naming relationship
  {
    _id: 'namedThing',
    subtypeOf: 'Attribute',
    attributes: {
      domain: 'String',
      range: 'Thing',
      cardinality: '0..*',
      'is-dependent': false,
      relationship: 'namingRelationship'
    },
    metadata: {
      version: 1,
      source: 'metamodel',
      description: 'Things that have this name'
    }
  }
];

/**
 * Example of a metamodel with validation errors
 */
export const invalidMetamodelExample: MetamodelEntity[] = [
  // Missing Thing entity - should cause MISSING_ROOT error
  
  {
    _id: 'SomeEntity',
    subtypeOf: 'Thing', // References undefined Thing
    attributes: []
  },

  {
    _id: 'BadAttribute',
    subtypeOf: 'Attribute',
    attributes: {
      domain: 'UndefinedEntity', // References undefined entity
      range: 'UndefinedType',    // References undefined type
      cardinality: 'invalid',    // Invalid cardinality format
      'is-dependent': 'not-boolean' // Should be boolean
    }
  },

  // Circular dependency
  {
    _id: 'A',
    subtypeOf: 'B',
    attributes: []
  },
  {
    _id: 'B',
    subtypeOf: 'C',
    attributes: []
  },
  {
    _id: 'C',
    subtypeOf: 'A', // Creates circular dependency
    attributes: []
  },

  // Invalid ID format
  {
    _id: '123InvalidID',
    subtypeOf: 'Thing',
    attributes: []
  },

  // Duplicate ID
  {
    _id: 'Duplicate',
    subtypeOf: 'Thing',
    attributes: []
  },
  {
    _id: 'Duplicate', // Duplicate ID
    subtypeOf: 'Thing',
    attributes: []
  }
];

/**
 * Demonstrates comprehensive metamodel validation
 */
export async function demonstrateValidation(): Promise<void> {
  console.log('🔍 Metamodel Validation Demonstration\n');
  
  const validator = new MetamodelValidator();
  
  // Test 1: Valid metamodel
  console.log('📋 Testing valid metamodel...');
  const validResult = validator.validateMetamodel(validMetamodelExample);
  
  if (validResult.isValid) {
    console.log('✅ Valid metamodel passed validation');
    
    // Get validation summary
    const dictionaries = (validator as any).buildDictionaries(validMetamodelExample, { build: () => ({ isValid: true, errors: [] }) });
    const summary = validator.getValidationSummary(dictionaries);
    
    console.log(`📊 Summary: ${summary.totalEntities} entities, ${summary.totalAttributes} attributes, ${summary.totalRelationships} relationships`);
    console.log(`🏗️  Core entities present: ${summary.coreEntitiesPresent.join(', ')}`);
    console.log(`📏 Max inheritance depth: ${summary.maxInheritanceDepth}`);
  } else {
    console.log('❌ Valid metamodel failed validation (unexpected)');
    validResult.errors.forEach(error => {
      console.log(`   - ${error.field}: ${error.message} (${error.code})`);
    });
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test 2: Invalid metamodel
  console.log('📋 Testing invalid metamodel...');
  const invalidResult = validator.validateMetamodel(invalidMetamodelExample);
  
  if (!invalidResult.isValid) {
    console.log('✅ Invalid metamodel correctly failed validation');
    console.log(`🚨 Found ${invalidResult.errors.length} validation errors:`);
    
    // Group errors by type
    const errorsByCode = new Map<string, number>();
    invalidResult.errors.forEach(error => {
      errorsByCode.set(error.code, (errorsByCode.get(error.code) || 0) + 1);
    });
    
    console.log('\n📈 Error breakdown:');
    for (const [code, count] of errorsByCode) {
      console.log(`   - ${code}: ${count} error(s)`);
    }
    
    console.log('\n📝 Detailed errors:');
    invalidResult.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. [${error.code}] ${error.field}: ${error.message}`);
    });
  } else {
    console.log('❌ Invalid metamodel passed validation (unexpected)');
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test 3: Demonstrate specific validation features
  console.log('🔧 Testing specific validation features...\n');
  
  // Test case sensitivity
  const caseSensitiveTest: MetamodelEntity[] = [
    {
      _id: 'Thing',
      subtypeOf: 'Thing',
      attributes: []
    },
    {
      _id: 'Attribute',
      subtypeOf: 'Thing',
      attributes: []
    },
    {
      _id: 'testAttr',
      subtypeOf: 'Attribute',
      attributes: {
        domain: 'thing', // lowercase reference
        range: 'string', // primitive type
        cardinality: '1',
        'is-dependent': true
      }
    }
  ];
  
  const caseResult = validator.validateMetamodel(caseSensitiveTest);
  console.log(`🔤 Case-insensitive validation: ${caseResult.isValid ? '✅ PASSED' : '❌ FAILED'}`);
  
  // Test cardinality validation
  const cardinalityTests = ['1', '0..1', '0..*', '1..*', '2..5', '*', 'invalid'];
  console.log('\n🔢 Cardinality format validation:');
  
  for (const cardinality of cardinalityTests) {
    const cardinalityTest: MetamodelEntity[] = [
      {
        _id: 'Thing',
        subtypeOf: 'Thing',
        attributes: []
      },
      {
        _id: 'Attribute',
        subtypeOf: 'Thing',
        attributes: []
      },
      {
        _id: 'String',
        subtypeOf: 'Thing',
        attributes: []
      },
      {
        _id: 'testAttr',
        subtypeOf: 'Attribute',
        attributes: {
          domain: 'Thing',
          range: 'String',
          cardinality: cardinality,
          'is-dependent': true
        }
      }
    ];
    
    const cardResult = validator.validateMetamodel(cardinalityTest);
    const hasCardinalityError = cardResult.errors.some(e => e.code === 'INVALID_CARDINALITY');
    const status = hasCardinalityError ? '❌ INVALID' : '✅ VALID';
    console.log(`   - "${cardinality}": ${status}`);
  }
  
  console.log('\n🎉 Validation demonstration complete!');
}

/**
 * Example of integrating with MetamodelLoader
 */
export async function demonstrateLoaderIntegration(): Promise<void> {
  console.log('\n🔗 Demonstrating MetamodelLoader integration...\n');
  
  // Note: This would require a real storage implementation
  // For demonstration purposes, we'll show the interface
  
  console.log('📝 The MetamodelLoader now uses the comprehensive validator:');
  console.log('   1. Loads metamodel data from JSON file');
  console.log('   2. Runs comprehensive validation using MetamodelValidator');
  console.log('   3. Only proceeds with loading if validation passes');
  console.log('   4. Provides detailed error reporting if validation fails');
  
  console.log('\n💡 Key benefits:');
  console.log('   ✅ All references are validated before loading');
  console.log('   ✅ Circular dependencies are detected');
  console.log('   ✅ Attribute definitions are thoroughly checked');
  console.log('   ✅ Relationship consistency is verified');
  console.log('   ✅ Constraint formats are validated');
  console.log('   ✅ Default values are type-checked');
  
  console.log('\n🚀 Usage example:');
  console.log(`
    const loader = new MetamodelLoader(storage);
    const result = await loader.loadFromFile('metamodel.json');
    
    if (result.success) {
      console.log(\`Loaded \${result.loaded.length} entities\`);
    } else {
      console.log('Validation errors:');
      result.errors.forEach(error => console.log(\`  - \${error}\`));
    }
  `);
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateValidation()
    .then(() => demonstrateLoaderIntegration())
    .catch(console.error);
}

#!/usr/bin/env node

/**
 * Script to validate the metamodel.json file using MetamodelValidator
 */

const fs = require('fs');
const path = require('path');

// Since we're running from JavaScript, we'll need to compile TypeScript first
// or use a simpler approach by creating a validation script

async function validateMetamodel() {
  console.log('🔍 Metamodel Validation for metamodel.json\n');
  
  try {
    // Read the metamodel.json file
    const metamodelPath = path.join(__dirname, 'src', 'metamodel', 'metamodel.json');
    const metamodelData = JSON.parse(fs.readFileSync(metamodelPath, 'utf8'));
    
    console.log(`📋 Loaded metamodel with ${metamodelData.length} entities\n`);
    
    // Basic structural validation
    console.log('🔧 Running basic structural validation...\n');
    
    let errors = [];
    let warnings = [];
    
    // Check for required root entity
    const thingEntity = metamodelData.find(e => e._id === 'thing');
    if (!thingEntity) {
      errors.push('❌ MISSING_ROOT: Missing required root entity "thing"');
    } else if (thingEntity.subtypeOf !== 'thing') {
      errors.push('❌ INVALID_ROOT: thing must be self-referential (subtypeOf: "thing")');
    } else {
      console.log('✅ Root entity "thing" found and properly configured');
    }
    
    // Check for duplicate IDs
    const ids = new Set();
    const duplicates = [];
    for (const entity of metamodelData) {
      if (!entity._id) {
        errors.push('❌ MISSING_ID: Entity missing required _id field');
        continue;
      }
      
      if (ids.has(entity._id)) {
        duplicates.push(entity._id);
      } else {
        ids.add(entity._id);
      }
    }
    
    if (duplicates.length > 0) {
      errors.push(`❌ DUPLICATE_ID: Duplicate entity IDs found: ${duplicates.join(', ')}`);
    } else {
      console.log('✅ No duplicate entity IDs found');
    }
    
    // Check ID format
    const invalidIds = [];
    for (const entity of metamodelData) {
      if (entity._id && !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(entity._id)) {
        invalidIds.push(entity._id);
      }
    }
    
    if (invalidIds.length > 0) {
      errors.push(`❌ INVALID_ID_FORMAT: Invalid ID formats: ${invalidIds.join(', ')}`);
    } else {
      console.log('✅ All entity IDs have valid format');
    }
    
    // Check subtypeOf references
    const undefinedReferences = [];
    for (const entity of metamodelData) {
      if (entity._id === 'Thing' && entity.subtypeOf === 'Thing') {
        continue; // Skip Thing's self-reference
      }
      
      if (entity.subtypeOf && !metamodelData.find(e => e._id === entity.subtypeOf)) {
        undefinedReferences.push(`${entity._id} -> ${entity.subtypeOf}`);
      }
    }
    
    if (undefinedReferences.length > 0) {
      errors.push(`❌ UNDEFINED_REFERENCE: Undefined subtypeOf references: ${undefinedReferences.join(', ')}`);
    } else {
      console.log('✅ All subtypeOf references are valid');
    }
    
    // Check for core entities
    const coreEntities = ['thing', 'attribute', 'relationship', 'kind', 'atomicthing', 'compoundthing'];
    const missingCore = [];
    const presentCore = [];
    
    for (const core of coreEntities) {
      if (metamodelData.find(e => e._id === core)) {
        presentCore.push(core);
      } else {
        missingCore.push(core);
      }
    }
    
    if (missingCore.length > 0) {
      warnings.push(`⚠️  MISSING_CORE_ENTITY: Missing core entities: ${missingCore.join(', ')}`);
    }
    
    console.log(`✅ Core entities present: ${presentCore.join(', ')}`);
    
    // Validate attribute definitions
    console.log('\n🔧 Validating attribute definitions...\n');
    
    const attributeEntities = metamodelData.filter(e => e.subtypeOf === 'attribute');
    console.log(`📊 Found ${attributeEntities.length} attribute definitions`);
    
    let validAttributes = 0;
    let invalidAttributes = 0;
    
    for (const attr of attributeEntities) {
      const attrData = attr.attributes || {};
      let isValid = true;
      
      // Check required fields
      if (!attrData.domain) {
        errors.push(`❌ MISSING_DOMAIN: Attribute ${attr._id} missing domain`);
        isValid = false;
      }
      
      if (!attrData.range) {
        errors.push(`❌ MISSING_RANGE: Attribute ${attr._id} missing range`);
        isValid = false;
      }
      
      if (!attrData.cardinality) {
        errors.push(`❌ MISSING_CARDINALITY: Attribute ${attr._id} missing cardinality`);
        isValid = false;
      }
      
      if (attrData['is-dependent'] === undefined && attrData['dependent'] === undefined) {
        errors.push(`❌ MISSING_DEPENDENT: Attribute ${attr._id} missing is-dependent flag`);
        isValid = false;
      }
      
      // Check cardinality format
      if (attrData.cardinality) {
        const validCardinalityPattern = /^(1|\d+\.\.\d+|\d+\.\.\*|0\.\.\*|0\.\.1|\*|1\.\.\*)$/;
        if (!validCardinalityPattern.test(attrData.cardinality)) {
          errors.push(`❌ INVALID_CARDINALITY: Attribute ${attr._id} has invalid cardinality format: ${attrData.cardinality}`);
          isValid = false;
        }
      }
      
      if (isValid) {
        validAttributes++;
      } else {
        invalidAttributes++;
      }
    }
    
    console.log(`✅ Valid attributes: ${validAttributes}`);
    if (invalidAttributes > 0) {
      console.log(`❌ Invalid attributes: ${invalidAttributes}`);
    }
    
    // Validate relationship definitions
    console.log('\n🔧 Validating relationship definitions...\n');
    
    const relationshipEntities = metamodelData.filter(e => e.subtypeOf === 'relationship');
    console.log(`📊 Found ${relationshipEntities.length} relationship definitions`);
    
    let validRelationships = 0;
    let invalidRelationships = 0;
    
    for (const rel of relationshipEntities) {
      const relData = rel.attributes || {};
      let isValid = true;
      
      if (!relData['dependent-end']) {
        errors.push(`❌ MISSING_DEPENDENT_END: Relationship ${rel._id} missing dependent-end`);
        isValid = false;
      }
      
      if (!relData['independent-end']) {
        errors.push(`❌ MISSING_INDEPENDENT_END: Relationship ${rel._id} missing independent-end`);
        isValid = false;
      }
      
      if (isValid) {
        validRelationships++;
      } else {
        invalidRelationships++;
      }
    }
    
    console.log(`✅ Valid relationships: ${validRelationships}`);
    if (invalidRelationships > 0) {
      console.log(`❌ Invalid relationships: ${invalidRelationships}`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`📈 Total entities: ${metamodelData.length}`);
    console.log(`📈 Attribute definitions: ${attributeEntities.length}`);
    console.log(`📈 Relationship definitions: ${relationshipEntities.length}`);
    console.log(`📈 Core entities present: ${presentCore.length}/${coreEntities.length}`);
    
    // Calculate inheritance depth
    const maxDepth = calculateMaxInheritanceDepth(metamodelData);
    console.log(`📏 Max inheritance depth: ${maxDepth}`);
    
    console.log('\n' + '='.repeat(60));
    
    if (errors.length === 0 && warnings.length === 0) {
      console.log('🎉 VALIDATION PASSED - No errors or warnings found!');
      return true;
    } else {
      if (errors.length > 0) {
        console.log(`❌ VALIDATION FAILED - ${errors.length} error(s) found:`);
        errors.forEach(error => console.log(`   ${error}`));
      }
      
      if (warnings.length > 0) {
        console.log(`\n⚠️  ${warnings.length} warning(s) found:`);
        warnings.forEach(warning => console.log(`   ${warning}`));
      }
      
      return errors.length === 0; // Pass if only warnings
    }
    
  } catch (error) {
    console.error('💥 Validation failed with error:', error.message);
    return false;
  }
}

function calculateMaxInheritanceDepth(metamodelData) {
  const entityMap = new Map();
  metamodelData.forEach(entity => {
    entityMap.set(entity._id, entity);
  });
  
  function getDepth(entityId, visited = new Set()) {
    if (visited.has(entityId)) {
      return 0; // Circular dependency
    }
    
    const entity = entityMap.get(entityId);
    if (!entity || entity._id === 'thing') {
      return 1;
    }
    
    visited.add(entityId);
    const parentDepth = getDepth(entity.subtypeOf, new Set(visited));
    return parentDepth + 1;
  }
  
  let maxDepth = 0;
  for (const entity of metamodelData) {
    const depth = getDepth(entity._id);
    maxDepth = Math.max(maxDepth, depth);
  }
  
  return maxDepth;
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateMetamodel()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { validateMetamodel };

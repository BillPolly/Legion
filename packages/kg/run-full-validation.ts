#!/usr/bin/env ts-node

/**
 * Comprehensive validation script using the full MetamodelValidator
 */

import * as fs from 'fs';
import * as path from 'path';
import { MetamodelValidator, MetamodelEntity } from './src/metamodel/MetamodelValidator';

async function runFullValidation(): Promise<void> {
  console.log('🔍 Comprehensive Metamodel Validation using MetamodelValidator\n');
  
  try {
    // Read the metamodel.json file
    const metamodelPath = path.join(__dirname, 'src', 'metamodel', 'metamodel.json');
    const metamodelData: MetamodelEntity[] = JSON.parse(fs.readFileSync(metamodelPath, 'utf8'));
    
    console.log(`📋 Loaded metamodel with ${metamodelData.length} entities\n`);
    
    // Create validator instance
    const validator = new MetamodelValidator();
    
    // Run comprehensive validation
    console.log('🔧 Running comprehensive validation...\n');
    const result = validator.validateMetamodel(metamodelData);
    
    // Display results
    if (result.isValid) {
      console.log('✅ VALIDATION PASSED - Metamodel is valid!\n');
      
      // Get detailed summary using internal method
      try {
        // Access the buildDictionaries method to get summary
        const dictionaries = (validator as any).buildDictionaries(metamodelData, {
          addError: () => {},
          addWarning: () => {},
          build: () => ({ isValid: true, errors: [], warnings: [] })
        });
        
        const summary = validator.getValidationSummary(dictionaries);
        
        console.log('📊 DETAILED VALIDATION SUMMARY');
        console.log('='.repeat(50));
        console.log(`📈 Total entities: ${summary.totalEntities}`);
        console.log(`📈 Total attributes: ${summary.totalAttributes}`);
        console.log(`📈 Total relationships: ${summary.totalRelationships}`);
        console.log(`📏 Max inheritance depth: ${summary.maxInheritanceDepth}`);
        console.log(`🏗️  Core entities present: ${summary.coreEntitiesPresent.join(', ')}`);
        
        // Display entity breakdown by type
        console.log('\n📋 Entity Breakdown:');
        const entityTypes = new Map<string, number>();
        for (const entity of metamodelData) {
          const type = entity.subtypeOf;
          entityTypes.set(type, (entityTypes.get(type) || 0) + 1);
        }
        
        for (const [type, count] of Array.from(entityTypes.entries()).sort((a, b) => b[1] - a[1])) {
          console.log(`   - ${type}: ${count} entities`);
        }
        
        // Display attribute domain/range analysis
        console.log('\n🔗 Attribute Analysis:');
        const attributeEntities = metamodelData.filter(e => e.subtypeOf === 'Attribute');
        const domainCounts = new Map<string, number>();
        const rangeCounts = new Map<string, number>();
        
        for (const attr of attributeEntities) {
          const attrData = attr.attributes as any || {};
          if (attrData.domain) {
            domainCounts.set(attrData.domain, (domainCounts.get(attrData.domain) || 0) + 1);
          }
          if (attrData.range) {
            rangeCounts.set(attrData.range, (rangeCounts.get(attrData.range) || 0) + 1);
          }
        }
        
        console.log('   Top domains:');
        Array.from(domainCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([domain, count]) => {
            console.log(`     - ${domain}: ${count} attributes`);
          });
        
        console.log('   Top ranges:');
        Array.from(rangeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([range, count]) => {
            console.log(`     - ${range}: ${count} attributes`);
          });
        
      } catch (summaryError) {
        console.log('⚠️  Could not generate detailed summary:', (summaryError as Error).message);
      }
      
    } else {
      console.log(`❌ VALIDATION FAILED - ${result.errors.length} error(s) found:\n`);
      
      // Group errors by type
      const errorsByCode = new Map<string, number>();
      result.errors.forEach(error => {
        errorsByCode.set(error.code, (errorsByCode.get(error.code) || 0) + 1);
      });
      
      console.log('📈 Error breakdown:');
      for (const [code, count] of errorsByCode) {
        console.log(`   - ${code}: ${count} error(s)`);
      }
      
      console.log('\n📝 Detailed errors:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. [${error.code}] ${error.field}: ${error.message}`);
      });
    }
    
    // Note: ValidationResult doesn't currently support warnings
    // This could be extended in the future if needed
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Comprehensive validation complete!');
    
  } catch (error) {
    console.error('💥 Validation failed with error:', (error as Error).message);
    console.error('Stack trace:', (error as Error).stack);
    process.exit(1);
  }
}

// Run validation
runFullValidation().catch(console.error);

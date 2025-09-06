/**
 * Gellish CNL Demo - Natural Language Knowledge Graph
 * 
 * This demo shows how to use Gellish Controlled Natural Language
 * to express facts and ask questions in structured English.
 */

import { KGEngine, GellishDictionary, EntityRecognizer, GellishParser } from '../src/index.js';

console.log('🌟 Gellish CNL Demo - Natural Language Knowledge Graph\n');

// Initialize the system
const kg = new KGEngine();
const dictionary = new GellishDictionary();
const entityRecognizer = new EntityRecognizer(dictionary);
const parser = new GellishParser(dictionary, entityRecognizer);

console.log('📚 Dictionary loaded with', dictionary.relations.size, 'standard Gellish relations\n');

// Express facts in natural language
console.log('💬 Expressing facts in natural English:');
const facts = [
  "Pump P101 is part of System S200",
  "Tank T205 is part of System S200", 
  "Motor M301 is part of Pump P101",
  "System S200 contains Water",
  "Tank T205 contains Water",
  "Pump P101 is manufactured by Siemens",
  "Motor M301 is manufactured by ABB",
  "John Smith operates System S200",
  "System S200 is owned by Acme Corporation"
];

facts.forEach(fact => {
  console.log(`  "${fact}"`);
  const triple = parser.parse(fact);
  kg.addTriple(triple[0], triple[1], triple[2]);
});

console.log(`\n✅ Stored ${facts.length} facts in the knowledge graph\n`);

// Query the knowledge graph
console.log('🔍 Querying the knowledge graph:\n');

// Find parts of System S200
console.log('❓ What is part of System S200?');
const systemParts = kg.query(null, "gellish:1230", "system_s200");
systemParts.forEach(([subject, predicate, object]) => {
  const entityName = subject.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  console.log(`  → ${entityName}`);
});

console.log('\n❓ What contains Water?');
const waterContainers = kg.query(null, "gellish:1331", "water");
waterContainers.forEach(([subject, predicate, object]) => {
  const entityName = subject.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  console.log(`  → ${entityName}`);
});

console.log('\n❓ What is manufactured by Siemens?');
const siemensProducts = kg.query(null, "gellish:1267", "siemens");
siemensProducts.forEach(([subject, predicate, object]) => {
  const entityName = subject.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  console.log(`  → ${entityName}`);
});

console.log('\n❓ Who operates equipment?');
const operators = kg.query(null, "gellish:1201", null);
operators.forEach(([subject, predicate, object]) => {
  const operatorName = subject.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  const equipmentName = object.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  console.log(`  → ${operatorName} operates ${equipmentName}`);
});

// Show synonym handling
console.log('\n🔄 Testing synonym handling:');
const synonymExpressions = [
  "Component C101 is part of Assembly A200",
  "Component C102 belongs to Assembly A200",  // synonym
  "Component C103 is a part of Assembly A200" // synonym
];

synonymExpressions.forEach(expr => {
  console.log(`  "${expr}"`);
  const triple = parser.parse(expr);
  kg.addTriple(triple[0], triple[1], triple[2]);
  console.log(`    → [${triple.join(', ')}]`);
});

console.log('\n❓ All parts of Assembly A200:');
const assemblyParts = kg.query(null, "gellish:1230", "assembly_a200");
assemblyParts.forEach(([subject, predicate, object]) => {
  const entityName = subject.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  console.log(`  → ${entityName}`);
});

// Show vocabulary statistics
console.log('\n📊 Vocabulary Statistics:');
const stats = dictionary.getStats();
console.log(`  Total relations: ${stats.totalRelations}`);
console.log(`  Total phrases: ${stats.totalPhrases}`);
console.log(`  Domains: ${stats.domains.join(', ')}`);

// Show performance
console.log('\n⚡ Performance Test:');
const startTime = Date.now();
for (let i = 1; i <= 100; i++) {
  const expr = `Equipment E${i.toString().padStart(3, '0')} is part of Factory F001`;
  const triple = parser.parse(expr);
  kg.addTriple(triple[0], triple[1], triple[2]);
}
const endTime = Date.now();
console.log(`  Processed 100 expressions in ${endTime - startTime}ms`);

const totalFacts = await kg.size();
console.log(`  Total facts in knowledge graph: ${totalFacts}`);

console.log('\n🎉 Gellish CNL Demo Complete!');
console.log('\n💡 Key Benefits:');
console.log('  • Express knowledge in natural English');
console.log('  • Automatic conversion to knowledge graph triples');
console.log('  • Standard vocabulary with 20+ core relations');
console.log('  • Synonym support for flexible expression');
console.log('  • Seamless integration with existing KG system');
console.log('  • High performance parsing and storage');

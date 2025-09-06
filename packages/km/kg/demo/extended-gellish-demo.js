/**
 * Extended Gellish CNL Demo - Showcasing Expanded Vocabulary
 * 
 * This demo showcases the expanded Gellish vocabulary with 100+ relations
 * across multiple domains: compositional, taxonomic, connection, manufacturing,
 * location, temporal, property, process, ownership, material, function, flow, and communication.
 */

import { KGEngine } from '../src/core/KGEngine.js';
import { GellishSystem } from '../src/gellish/GellishSystem.js';

console.log('🚀 Extended Gellish CNL Demo - Expanded Vocabulary Showcase\n');

// Initialize the system
const kg = new KGEngine();
const gellish = new GellishSystem(kg);

// Get vocabulary statistics
const stats = gellish.dictionary.getStats();
console.log(`📚 Vocabulary Statistics:`);
console.log(`   Total Relations: ${stats.totalRelations}`);
console.log(`   Total Phrases: ${stats.totalPhrases}`);
console.log(`   Domains: ${stats.domains.join(', ')}\n`);

console.log('=' .repeat(80));
console.log('🏭 INDUSTRIAL SYSTEM MODELING WITH EXTENDED VOCABULARY');
console.log('=' .repeat(80));

// 1. COMPOSITIONAL RELATIONS - System Structure
console.log('\n🔧 1. COMPOSITIONAL RELATIONS - System Structure');
console.log('-'.repeat(50));

const compositionalFacts = [
  "Pump P101 is part of System S200",
  "Impeller I101 is component of Pump P101", 
  "Motor M301 is assembly of Pump P101",
  "Bearing B201 is subassembly of Motor M301",
  "Control Module CM101 is module of System S200",
  "Inlet Section IS101 is section of Pump P101"
];

compositionalFacts.forEach(fact => {
  gellish.assert(fact);
  console.log(`✓ ${fact}`);
});

// Query compositional relationships
console.log('\n📋 Compositional Queries:');
console.log(`Q: What is part of System S200?`);
console.log(`A: ${gellish.query("What is part of System S200?")}`);

console.log(`Q: What is component of Pump P101?`);
console.log(`A: ${gellish.query("What is component of Pump P101?")}`);

// 2. CONTAINER RELATIONS - What Contains What
console.log('\n📦 2. CONTAINER RELATIONS - Storage and Containment');
console.log('-'.repeat(50));

const containerFacts = [
  "Tank T205 contains Water",
  "Reservoir R101 stores Hydraulic Oil",
  "Housing H301 encloses Motor M301",
  "Cabinet C101 accommodates Control Module CM101"
];

containerFacts.forEach(fact => {
  gellish.assert(fact);
  console.log(`✓ ${fact}`);
});

console.log('\n📋 Container Queries:');
console.log(`Q: What contains Water?`);
console.log(`A: ${gellish.query("What contains Water?")}`);

console.log(`Q: What does Tank T205 contain?`);
console.log(`A: ${gellish.query("Tank T205 contains what?")}`);

// 3. CONNECTION RELATIONS - Physical Connections
console.log('\n🔗 3. CONNECTION RELATIONS - Physical Connections');
console.log('-'.repeat(50));

const connectionFacts = [
  "Pipe P205 is connected to Tank T205",
  "Motor M301 is coupled to Pump P101",
  "Sensor S101 is attached to Pipe P205",
  "Cable C301 is bonded to Motor M301",
  "Flange F101 is bolted to Pipe P205"
];

connectionFacts.forEach(fact => {
  gellish.assert(fact);
  console.log(`✓ ${fact}`);
});

console.log('\n📋 Connection Queries:');
console.log(`Q: What is connected to Tank T205?`);
console.log(`A: ${gellish.query("What is connected to Tank T205?")}`);

console.log(`Q: What is attached to Pipe P205?`);
console.log(`A: ${gellish.query("What is attached to Pipe P205?")}`);

// 4. MANUFACTURING RELATIONS - Production Information
console.log('\n🏭 4. MANUFACTURING RELATIONS - Production Information');
console.log('-'.repeat(50));

const manufacturingFacts = [
  "Motor M301 is manufactured by Siemens",
  "Pump P101 is supplied by Grundfos",
  "Tank T205 is fabricated by Steel Works Inc",
  "Control Module CM101 is assembled by Automation Corp",
  "Sensor S101 is designed by Tech Solutions",
  "Pipe P205 is tested by Quality Assurance",
  "Motor M301 is inspected by QC Department"
];

manufacturingFacts.forEach(fact => {
  gellish.assert(fact);
  console.log(`✓ ${fact}`);
});

console.log('\n📋 Manufacturing Queries:');
console.log(`Q: What is manufactured by Siemens?`);
console.log(`A: ${gellish.query("What is manufactured by Siemens?")}`);

console.log(`Q: Who supplies Pump P101?`);
console.log(`A: ${gellish.query("Pump P101 is supplied by what?")}`);

// 5. LOCATION RELATIONS - Spatial Information
console.log('\n📍 5. LOCATION RELATIONS - Spatial Information');
console.log('-'.repeat(50));

const locationFacts = [
  "Pump P101 is located in Building A",
  "Motor M301 is installed in Pump Room",
  "Tank T205 is placed in Storage Area",
  "Control Module CM101 is housed in Control Room",
  "Sensor S101 is deployed in Field Location"
];

locationFacts.forEach(fact => {
  gellish.assert(fact);
  console.log(`✓ ${fact}`);
});

console.log('\n📋 Location Queries:');
console.log(`Q: What is located in Building A?`);
console.log(`A: ${gellish.query("What is located in Building A?")}`);

console.log(`Q: Where is Tank T205 placed?`);
console.log(`A: ${gellish.query("Tank T205 is placed in what?")}`);

// 6. PROCESS RELATIONS - Operational Flows
console.log('\n⚙️ 6. PROCESS RELATIONS - Operational Flows');
console.log('-'.repeat(50));

const processFacts = [
  "Water is input to Pump P101",
  "Pressurized Water is output of Pump P101",
  "Raw Material is processed by System S200",
  "Heat is transformed by Heat Exchanger HX101",
  "Flow Rate is controlled by Valve V101",
  "Temperature is monitored by Sensor S101"
];

processFacts.forEach(fact => {
  gellish.assert(fact);
  console.log(`✓ ${fact}`);
});

console.log('\n📋 Process Queries:');
console.log(`Q: What is input to Pump P101?`);
console.log(`A: ${gellish.query("What is input to Pump P101?")}`);

console.log(`Q: What controls Flow Rate?`);
console.log(`A: ${gellish.query("Flow Rate is controlled by what?")}`);

// 7. OWNERSHIP RELATIONS - Responsibility and Management
console.log('\n👥 7. OWNERSHIP RELATIONS - Responsibility and Management');
console.log('-'.repeat(50));

const ownershipFacts = [
  "System S200 is owned by Plant Operations",
  "Pump P101 is operated by Maintenance Team",
  "Motor M301 is maintained by Electrical Department",
  "Control Module CM101 is supervised by Control Engineer",
  "Safety System SS101 is responsible for Emergency Shutdown"
];

ownershipFacts.forEach(fact => {
  gellish.assert(fact);
  console.log(`✓ ${fact}`);
});

console.log('\n📋 Ownership Queries:');
console.log(`Q: Who owns System S200?`);
console.log(`A: ${gellish.query("System S200 is owned by what?")}`);

console.log(`Q: What is operated by Maintenance Team?`);
console.log(`A: ${gellish.query("What is operated by Maintenance Team?")}`);

// 8. MATERIAL RELATIONS - Material Composition
console.log('\n🧱 8. MATERIAL RELATIONS - Material Composition');
console.log('-'.repeat(50));

const materialFacts = [
  "Pipe P205 is made of Stainless Steel",
  "Tank T205 has material Carbon Steel",
  "Housing H301 is constructed from Aluminum",
  "Cable C301 is coated with PVC"
];

materialFacts.forEach(fact => {
  gellish.assert(fact);
  console.log(`✓ ${fact}`);
});

console.log('\n📋 Material Queries:');
console.log(`Q: What is made of Stainless Steel?`);
console.log(`A: ${gellish.query("What is made of Stainless Steel?")}`);

console.log(`Q: What material does Tank T205 have?`);
console.log(`A: ${gellish.query("Tank T205 has material what?")}`);

// 9. FUNCTION RELATIONS - Purpose and Capabilities
console.log('\n🎯 9. FUNCTION RELATIONS - Purpose and Capabilities');
console.log('-'.repeat(50));

const functionFacts = [
  "Pump P101 has function Fluid Transfer",
  "Motor M301 is used for Rotation",
  "Control System CS101 performs Process Control",
  "Safety Valve SV101 enables Pressure Relief",
  "Backup System BS101 supports Main Operation"
];

functionFacts.forEach(fact => {
  gellish.assert(fact);
  console.log(`✓ ${fact}`);
});

console.log('\n📋 Function Queries:');
console.log(`Q: What has function Fluid Transfer?`);
console.log(`A: ${gellish.query("What has function Fluid Transfer?")}`);

console.log(`Q: What is Motor M301 used for?`);
console.log(`A: ${gellish.query("Motor M301 is used for what?")}`);

// 10. FLOW RELATIONS - Material and Information Flow
console.log('\n🌊 10. FLOW RELATIONS - Material and Information Flow');
console.log('-'.repeat(50));

const flowFacts = [
  "Water flows to Distribution System",
  "Steam flows from Boiler B101",
  "Coolant flows through Heat Exchanger HX101",
  "Conveyor Belt CB101 transports Raw Materials"
];

flowFacts.forEach(fact => {
  gellish.assert(fact);
  console.log(`✓ ${fact}`);
});

console.log('\n📋 Flow Queries:');
console.log(`Q: What flows to Distribution System?`);
console.log(`A: ${gellish.query("What flows to Distribution System?")}`);

console.log(`Q: What transports Raw Materials?`);
console.log(`A: ${gellish.query("What transports Raw Materials?")}`);

// 11. COMMUNICATION RELATIONS - Information Exchange
console.log('\n📡 11. COMMUNICATION RELATIONS - Information Exchange');
console.log('-'.repeat(50));

const communicationFacts = [
  "Control Module CM101 communicates with SCADA System",
  "Sensor S101 sends signal to Control Room",
  "Alarm System AS101 reports to Operations Center",
  "PLC P101 commands Actuator A101"
];

communicationFacts.forEach(fact => {
  gellish.assert(fact);
  console.log(`✓ ${fact}`);
});

console.log('\n📋 Communication Queries:');
console.log(`Q: What communicates with SCADA System?`);
console.log(`A: ${gellish.query("What communicates with SCADA System?")}`);

console.log(`Q: What does Sensor S101 send signal to?`);
console.log(`A: ${gellish.query("Sensor S101 sends signal to what?")}`);

// 12. COMPLEX MULTI-DOMAIN QUERIES
console.log('\n🔍 12. COMPLEX MULTI-DOMAIN ANALYSIS');
console.log('-'.repeat(50));

console.log('Complex system analysis using multiple relation types:\n');

// Get all components of System S200
const systemComponents = gellish.query("What is part of System S200?");
console.log(`🔧 System S200 Components: ${systemComponents}`);

// Get all Siemens equipment
const siemensEquipment = gellish.query("What is manufactured by Siemens?");
console.log(`🏭 Siemens Equipment: ${siemensEquipment}`);

// Get all equipment in Building A
const buildingAEquipment = gellish.query("What is located in Building A?");
console.log(`📍 Building A Equipment: ${buildingAEquipment}`);

// Get all water-related equipment
const waterEquipment = gellish.query("What contains Water?");
console.log(`💧 Water-Related Equipment: ${waterEquipment}`);

// 13. VALIDATION SHOWCASE
console.log('\n✅ 13. VALIDATION SHOWCASE');
console.log('-'.repeat(50));

console.log('Testing expression validation with expanded vocabulary:\n');

// Valid expressions
const validExpressions = [
  "Turbine T301 is coupled to Generator G201",
  "Cooling System CS201 enables Heat Removal",
  "Maintenance Schedule MS101 occurs before Operation",
  "Quality Report QR101 is characteristic of Product P301"
];

validExpressions.forEach(expr => {
  const validation = gellish.validator.validate(expr);
  console.log(`✓ "${expr}" - ${validation.valid ? 'VALID' : 'INVALID'}`);
});

// Invalid expressions
console.log('\nInvalid expressions with helpful suggestions:');
const invalidExpressions = [
  "Pump P101 is broken by System S200",  // Invalid relation
  "Tank contains",  // Incomplete expression
  ""  // Empty expression
];

invalidExpressions.forEach(expr => {
  const validation = gellish.validator.validate(expr);
  if (!validation.valid) {
    console.log(`❌ "${expr}" - ${validation.error}`);
    if (validation.suggestions) {
      console.log(`   💡 Suggestions: ${validation.suggestions.join(', ')}`);
    }
  }
});

// 14. PERFORMANCE METRICS
console.log('\n⚡ 14. PERFORMANCE METRICS');
console.log('-'.repeat(50));

// Count total facts stored
const totalTriples = kg.query(null, null, null).length;
console.log(`📊 Total Facts Stored: ${totalTriples}`);

// Test query performance
const startTime = Date.now();
for (let i = 0; i < 100; i++) {
  gellish.query("What is part of System S200?");
}
const endTime = Date.now();
const avgQueryTime = (endTime - startTime) / 100;

console.log(`⚡ Average Query Time: ${avgQueryTime.toFixed(2)}ms`);
console.log(`🚀 Queries per Second: ${(1000 / avgQueryTime).toFixed(0)}`);

// 15. DOMAIN STATISTICS
console.log('\n📈 15. DOMAIN STATISTICS');
console.log('-'.repeat(50));

stats.domains.forEach(domain => {
  const domainRelations = gellish.dictionary.getRelationsByDomain(domain);
  console.log(`${domain.charAt(0).toUpperCase() + domain.slice(1)}: ${domainRelations.length} relations`);
});

console.log('\n' + '='.repeat(80));
console.log('🎉 EXTENDED GELLISH DEMO COMPLETED SUCCESSFULLY!');
console.log('='.repeat(80));

console.log(`
📋 SUMMARY:
• Demonstrated 100+ Gellish relations across 13 domains
• Stored ${totalTriples} facts in the knowledge graph
• Validated expressions with helpful error messages
• Achieved ${avgQueryTime.toFixed(2)}ms average query performance
• Showcased complex multi-domain system modeling

🚀 The Gellish CNL system successfully transforms domain expertise
   into structured knowledge using natural language expressions!
`);

/**
 * Extract entities from 3 sample CSQA conversations
 * This helps us identify which Wikidata entities we need to load
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample conversations to test
const SAMPLE_CONVERSATIONS = [
  'data/QA_100/QA_0.json',    // Coreference: "that person"
  'data/QA_396/QA_0.json',    // Implicit reference: "that nutrient"
  'data/QA_157/QA_0.json'     // Direct follow-ups
];

function extractEntitiesFromConversation(filePath) {
  const fullPath = path.join(__dirname, filePath);
  const content = fs.readFileSync(fullPath, 'utf8');
  const turns = JSON.parse(content);

  const entities = new Set();
  const relations = new Set();
  const userQuestions = [];

  for (const turn of turns) {
    if (turn.speaker === 'USER') {
      userQuestions.push(turn.utterance);
    }

    if (turn.entities_in_utterance) {
      turn.entities_in_utterance.forEach(e => entities.add(e));
    }
    if (turn.all_entities) {
      turn.all_entities.forEach(e => entities.add(e));
    }
    if (turn.relations) {
      turn.relations.forEach(r => relations.add(r));
    }
  }

  return {
    entities: Array.from(entities),
    relations: Array.from(relations),
    questions: userQuestions
  };
}

function main() {
  const allEntities = new Set();
  const allRelations = new Set();
  const conversations = [];

  console.log('='.repeat(80));
  console.log('CSQA Sample Entity Extraction');
  console.log('='.repeat(80));

  for (const convPath of SAMPLE_CONVERSATIONS) {
    console.log(`\n📁 Processing: ${convPath}`);
    const { entities, relations, questions } = extractEntitiesFromConversation(convPath);

    console.log(`   Entities: ${entities.length}`);
    console.log(`   Relations: ${relations.length}`);
    console.log(`   Questions: ${questions.length}`);

    // Show first 2 questions as preview
    console.log(`\n   Sample questions:`);
    questions.slice(0, 2).forEach((q, i) => {
      console.log(`     ${i + 1}. ${q}`);
    });

    entities.forEach(e => allEntities.add(e));
    relations.forEach(r => allRelations.add(r));

    conversations.push({
      path: convPath,
      entities,
      relations,
      questions
    });
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total unique entities: ${allEntities.size}`);
  console.log(`Total unique relations: ${allRelations.size}`);
  console.log(`Total conversations: ${conversations.length}`);

  console.log(`\n📦 All Entities:`);
  console.log(Array.from(allEntities).join(', '));

  console.log(`\n🔗 All Relations:`);
  console.log(Array.from(allRelations).join(', '));

  // Save to JSON for next step
  const output = {
    conversations,
    allEntities: Array.from(allEntities),
    allRelations: Array.from(allRelations),
    extractedAt: new Date().toISOString()
  };

  const outputPath = path.join(__dirname, 'sample-entities.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n✅ Saved to ${outputPath}`);
  console.log('='.repeat(80));
}

main();

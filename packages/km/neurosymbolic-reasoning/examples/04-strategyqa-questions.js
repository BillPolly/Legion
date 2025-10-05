#!/usr/bin/env node
/**
 * Example 4: StrategyQA Questions
 *
 * This demonstrates ProofOfThought on complex reasoning questions from
 * the StrategyQA dataset. These questions require multi-step inference
 * and world knowledge.
 *
 * StrategyQA tests:
 * - Multi-step logical reasoning
 * - World knowledge integration
 * - Boolean yes/no answers with proof
 * - Complex inference chains
 *
 * Run: node examples/04-strategyqa-questions.js
 */

import { ProofOfThought } from '../src/index.js';
import { ResourceManager } from '@legion/resource-manager';

// Sample questions from StrategyQA dataset
// Each question requires multi-step reasoning and world knowledge
const STRATEGY_QA_QUESTIONS = [
  {
    id: 1,
    question: "Are more people today related to Genghis Khan than Julius Caesar?",
    expectedAnswer: true,
    facts: [
      "Julius Caesar had 3 children",
      "Genghis Khan had 16 children",
      "1 in 200 men today have DNA traced to Genghis Khan"
    ]
  },
  {
    id: 2,
    question: "Could the members of The Police perform lawful arrests?",
    expectedAnswer: false,
    facts: [
      "The Police is a rock band",
      "Only law enforcement officers can perform lawful arrests"
    ]
  },
  {
    id: 3,
    question: "Would a dog respond to bell before Grey seal?",
    expectedAnswer: true,
    facts: [
      "Grey seals have no ear flaps",
      "Dogs have sensitive ears that can hear distant sounds",
      "Grey seals rely more on visual and tactile senses"
    ]
  },
  {
    id: 4,
    question: "Is shrimp scampi definitely free of plastic?",
    expectedAnswer: false,
    facts: [
      "Shrimp scampi is made with shrimp",
      "Shrimp have been found to contain microplastics",
      "Microplastics are prevalent in ocean ecosystems"
    ]
  },
  {
    id: 5,
    question: "Do the anchors on Rede Globo speak Chinese?",
    expectedAnswer: false,
    facts: [
      "Rede Globo is a Brazilian television network",
      "Brazil's official language is Portuguese",
      "TV anchors typically speak in their country's primary language"
    ]
  },
  {
    id: 6,
    question: "Would a Monoamine Oxidase candy bar cheer up a depressed friend?",
    expectedAnswer: false,
    facts: [
      "Depression is caused by low levels of neurotransmitters",
      "Monoamine Oxidase breaks down neurotransmitters",
      "Breaking down neurotransmitters would worsen depression"
    ]
  },
  {
    id: 7,
    question: "Can you write a book in a single day?",
    expectedAnswer: false,
    facts: [
      "Average book length is 50000 to 100000 words",
      "Average writing speed is 40 words per minute",
      "A day has 24 hours",
      "Sustained writing requires breaks"
    ]
  },
  {
    id: 8,
    question: "Would a vegan eat a hamburger made from impossible meat?",
    expectedAnswer: true,
    facts: [
      "Vegans do not eat animal products",
      "Impossible meat is plant-based",
      "Impossible meat contains no animal products"
    ]
  }
];

async function askQuestion(pot, questionData, index, total) {
  console.log('\n' + '='.repeat(80));
  console.log(`QUESTION ${index + 1} of ${total}`);
  console.log('='.repeat(80));

  console.log(`\nQ: ${questionData.question}`);

  if (questionData.facts) {
    console.log('\nRelevant Facts:');
    questionData.facts.forEach(f => console.log(`  • ${f}`));
  }

  console.log('\nProcessing...');

  const startTime = Date.now();
  const result = await pot.query(questionData.question);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\nAnswer: ${result.answer}`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`Processing Time: ${duration}s`);

  if (questionData.expectedAnswer !== undefined) {
    const expectedAnswerStr = questionData.expectedAnswer ? 'Yes' : 'No';
    const correct = result.answer === expectedAnswerStr;
    console.log(`Expected: ${expectedAnswerStr}`);
    console.log(`Correct: ${correct ? '✅ YES' : '❌ NO'}`);
  }

  if (result.explanation) {
    console.log(`\nExplanation: ${result.explanation}`);
  }

  return {
    question: questionData.question,
    answer: result.answer,
    expected: questionData.expectedAnswer ? 'Yes' : 'No',
    correct: result.answer === (questionData.expectedAnswer ? 'Yes' : 'No'),
    confidence: result.confidence,
    duration
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log('ProofOfThought - StrategyQA Questions');
  console.log('='.repeat(80));
  console.log('\nThese questions test multi-step reasoning and world knowledge.');
  console.log(`Total questions: ${STRATEGY_QA_QUESTIONS.length}`);

  try {
    // Initialize
    console.log('\nInitializing ProofOfThought...');
    const resourceManager = await ResourceManager.getInstance();
    const llmClient = await resourceManager.get('llmClient');
    const pot = new ProofOfThought(llmClient);

    // Process questions
    const results = [];
    for (let i = 0; i < STRATEGY_QA_QUESTIONS.length; i++) {
      const result = await askQuestion(pot, STRATEGY_QA_QUESTIONS[i], i, STRATEGY_QA_QUESTIONS.length);
      results.push(result);
    }

    // Summary statistics
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    const correct = results.filter(r => r.correct).length;
    const accuracy = (correct / results.length * 100).toFixed(1);
    const avgConfidence = (results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100).toFixed(1);
    const avgDuration = (results.reduce((sum, r) => sum + parseFloat(r.duration), 0) / results.length).toFixed(2);

    console.log(`\nTotal Questions: ${results.length}`);
    console.log(`Correct Answers: ${correct}`);
    console.log(`Accuracy: ${accuracy}%`);
    console.log(`Average Confidence: ${avgConfidence}%`);
    console.log(`Average Duration: ${avgDuration}s`);

    console.log('\nResults by Question:');
    results.forEach((r, i) => {
      const mark = r.correct ? '✅' : '❌';
      console.log(`  ${i + 1}. ${mark} ${r.answer} (expected: ${r.expected}) - ${(r.confidence * 100).toFixed(0)}% confidence`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('EVALUATION COMPLETE');
    console.log('='.repeat(80));
    console.log('\nKey Takeaways:');
    console.log('  • ProofOfThought handles complex multi-step reasoning');
    console.log('  • Integrates world knowledge with logical inference');
    console.log('  • Provides confidence scores for each answer');
    console.log('  • Generates formal proofs for reasoning chains');

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('ERROR');
    console.error('='.repeat(80));
    console.error(`\n${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the example
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

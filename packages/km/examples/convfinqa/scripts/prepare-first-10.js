/**
 * Prepare First 10 Conversations from ConvFinQA Dev Set
 *
 * Extracts the first 10 conversations from dev.json and generates
 * a summary report for analysis.
 */

import fs from 'fs';
import path from 'path';

async function main() {
  console.log('='.repeat(80));
  console.log('Preparing First 10 ConvFinQA Conversations');
  console.log('='.repeat(80));
  console.log();

  // Load dev.json
  const dataPath = path.join(import.meta.dirname, '../data/dev.json');
  console.log(`📂 Loading dev.json from: ${path.basename(dataPath)}`);

  const allData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`   Loaded ${allData.length} total conversations`);
  console.log();

  // Extract first 10
  const first10 = allData.slice(0, 10);
  console.log(`✂️  Extracted first 10 conversations`);
  console.log();

  // Generate summary report
  console.log('📊 SUMMARY OF FIRST 10 CONVERSATIONS');
  console.log('─'.repeat(80));
  console.log();

  const summary = {
    totalConversations: first10.length,
    totalQuestions: 0,
    conversations: [],
    companies: new Set(),
    years: new Set(),
    complexityMetrics: {
      totalPrograms: 0,
      multiStepPrograms: 0,
      referenceResolution: 0,
      arithmeticOps: {
        add: 0,
        subtract: 0,
        multiply: 0,
        divide: 0,
        other: 0
      }
    }
  };

  for (let i = 0; i < first10.length; i++) {
    const conv = first10[i];
    const annotation = conv.annotation;
    const questions = annotation.dialogue_break || [];
    const programs = annotation.turn_program || [];

    // Extract metadata
    const filename = conv.filename || conv.id || `conversation-${i + 1}`;
    const parts = filename.split('/');
    const company = parts[0] || 'Unknown';
    const year = parts[1] || 'Unknown';

    summary.companies.add(company);
    summary.years.add(year);
    summary.totalQuestions += questions.length;

    // Analyze program complexity
    let multiStepCount = 0;
    let hasReferences = 0;

    for (const program of programs) {
      summary.complexityMetrics.totalPrograms++;

      // Multi-step programs contain commas
      if (program.includes(',')) {
        multiStepCount++;
        summary.complexityMetrics.multiStepPrograms++;
      }

      // Check for operations
      if (program.includes('add') || program.includes('sum')) {
        summary.complexityMetrics.arithmeticOps.add++;
      }
      if (program.includes('subtract') || program.includes('minus')) {
        summary.complexityMetrics.arithmeticOps.subtract++;
      }
      if (program.includes('multiply') || program.includes('times')) {
        summary.complexityMetrics.arithmeticOps.multiply++;
      }
      if (program.includes('divide')) {
        summary.complexityMetrics.arithmeticOps.divide++;
      }
      if (program.includes('exp') || program.includes('greater')) {
        summary.complexityMetrics.arithmeticOps.other++;
      }
    }

    // Check for reference resolution needs
    for (const question of questions) {
      if (question.match(/\b(it|that|this|these|those|and what|what about)\b/i)) {
        hasReferences++;
      }
    }

    summary.complexityMetrics.referenceResolution += hasReferences;

    summary.conversations.push({
      id: conv.id || filename,
      company,
      year,
      filename,
      questionCount: questions.length,
      multiStepPrograms: multiStepCount,
      referenceQuestions: hasReferences
    });

    // Print conversation details
    console.log(`${i + 1}. ${filename}`);
    console.log(`   Company: ${company}, Year: ${year}`);
    console.log(`   Questions: ${questions.length}`);
    console.log(`   Multi-step programs: ${multiStepCount}`);
    console.log(`   Questions with references: ${hasReferences}`);
    console.log();
  }

  // Print summary statistics
  console.log('='.repeat(80));
  console.log('OVERALL STATISTICS');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total Conversations: ${summary.totalConversations}`);
  console.log(`Total Questions: ${summary.totalQuestions}`);
  console.log(`Average Questions/Conversation: ${(summary.totalQuestions / summary.totalConversations).toFixed(1)}`);
  console.log();
  console.log(`Unique Companies: ${Array.from(summary.companies).join(', ')}`);
  console.log(`Unique Years: ${Array.from(summary.years).sort().join(', ')}`);
  console.log();
  console.log('Complexity Metrics:');
  console.log(`  Total Programs: ${summary.complexityMetrics.totalPrograms}`);
  console.log(`  Multi-step Programs: ${summary.complexityMetrics.multiStepPrograms} (${(100 * summary.complexityMetrics.multiStepPrograms / summary.complexityMetrics.totalPrograms).toFixed(1)}%)`);
  console.log(`  Questions with References: ${summary.complexityMetrics.referenceResolution} (${(100 * summary.complexityMetrics.referenceResolution / summary.totalQuestions).toFixed(1)}%)`);
  console.log();
  console.log('Arithmetic Operations:');
  console.log(`  Add/Sum: ${summary.complexityMetrics.arithmeticOps.add}`);
  console.log(`  Subtract/Minus: ${summary.complexityMetrics.arithmeticOps.subtract}`);
  console.log(`  Multiply/Times: ${summary.complexityMetrics.arithmeticOps.multiply}`);
  console.log(`  Divide: ${summary.complexityMetrics.arithmeticOps.divide}`);
  console.log(`  Other (exp, greater): ${summary.complexityMetrics.arithmeticOps.other}`);
  console.log();

  // Save first 10 conversations
  const outputPath = path.join(import.meta.dirname, '../data/first-10-conversations.json');
  fs.writeFileSync(outputPath, JSON.stringify(first10, null, 2));
  console.log(`💾 Saved first 10 conversations to: ${path.basename(outputPath)}`);

  // Save summary report
  const summaryPath = path.join(import.meta.dirname, '../data/first-10-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`💾 Saved summary report to: ${path.basename(summaryPath)}`);

  console.log();
  console.log('='.repeat(80));
  console.log('✅ Preprocessing complete!');
  console.log('='.repeat(80));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Generate Report Script
 * 
 * Creates comprehensive compliance and test reports
 * 
 * Usage:
 *   node scripts/generate-report.js                # Generate JSON report
 *   node scripts/generate-report.js --format html  # Generate HTML report
 *   node scripts/generate-report.js --format all   # Generate all formats
 *   node scripts/generate-report.js --history      # Include trend analysis
 */

import { ResourceManager } from '@legion/resource-manager';
import { TestRunner, ReportGenerator } from '../src/verification/index.js';
import { DatabaseStorage } from '../src/core/DatabaseStorage.js';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    format: args.includes('--format') ? args[args.indexOf('--format') + 1] || 'json' : 'json',
    history: args.includes('--history'),
    verbose: args.includes('--verbose'),
    outputDir: args.includes('--output') ? args[args.indexOf('--output') + 1] : './reports',
    runTests: !args.includes('--no-tests'),
    includeIntegration: args.includes('--integration')
  };
  
  console.log('📊 Legion Compliance Report Generator\n');
  
  try {
    // Initialize ResourceManager
    const resourceManager = await ResourceManager.getInstance();
    
    // Initialize DatabaseStorage if needed
    let databaseStorage = null;
    try {
      databaseStorage = new DatabaseStorage();
      await databaseStorage.initialize();
    } catch (error) {
      console.warn('⚠️  Database not available, running without persistence');
    }
    
    // Create ReportGenerator
    const reportGenerator = new ReportGenerator({
      format: options.format,
      outputDir: options.outputDir,
      includeHistory: options.history,
      includeDetails: true,
      includeRecommendations: true
    });
    
    // Load history if requested
    if (options.history) {
      await reportGenerator.loadHistory();
      console.log('📜 Loaded report history\n');
    }
    
    let report;
    
    if (options.runTests) {
      // Create TestRunner and run full pipeline
      const testRunner = new TestRunner({
        resourceManager,
        databaseStorage,
        verbose: options.verbose,
        includePerformance: true,
        includeIntegration: options.includeIntegration
      });
      
      // Set custom report generator
      testRunner.reportGenerator = reportGenerator;
      
      // Listen to progress events
      let currentPhase = '';
      testRunner.on('phase:start', (data) => {
        currentPhase = data.phase;
        console.log(`⏳ ${currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1)}...`);
      });
      
      testRunner.on('phase:complete', (data) => {
        console.log(`✅ ${data.phase.charAt(0).toUpperCase() + data.phase.slice(1)} complete\n`);
      });
      
      // Run complete pipeline
      console.log('🚀 Running complete verification pipeline...\n');
      report = await testRunner.runCompletePipeline();
      
    } else {
      // Load existing data from database or files
      console.log('📁 Loading existing test data...\n');
      
      // Try to load from recent reports
      const reportsDir = path.resolve(options.outputDir);
      const files = await fs.readdir(reportsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
      
      if (jsonFiles.length > 0) {
        const latestReport = path.join(reportsDir, jsonFiles[0]);
        const data = await fs.readFile(latestReport, 'utf-8');
        report = JSON.parse(data);
        console.log(`✅ Loaded data from ${jsonFiles[0]}\n`);
      } else {
        console.error('❌ No existing reports found. Please run tests first.');
        process.exit(1);
      }
    }
    
    // Display summary
    console.log('📈 Report Summary:\n');
    console.log(`  Compliance Score: ${report.summary.complianceScore}%`);
    console.log(`  Test Success Rate: ${report.summary.successRate}%`);
    console.log(`  Test Coverage: ${report.summary.testCoverage}%`);
    console.log(`  Total Modules: ${report.summary.totalModules}`);
    console.log(`  Total Tools: ${report.summary.totalTools}`);
    console.log(`  Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`  Warnings: ${report.summary.warnings}\n`);
    
    // Show compliance breakdown
    const complianceStatus = (score) => {
      if (score >= 95) return '🟢 Excellent';
      if (score >= 80) return '🟡 Good';
      if (score >= 60) return '🟠 Fair';
      if (score >= 40) return '🔴 Poor';
      return '⚫ Critical';
    };
    
    console.log('📊 Compliance Status: ' + complianceStatus(report.summary.complianceScore) + '\n');
    
    // Show top issues
    if (report.recommendations && report.recommendations.length > 0) {
      console.log('🔍 Top Issues:\n');
      
      const topIssues = report.recommendations.slice(0, 5);
      for (const issue of topIssues) {
        const icon = issue.priority === 'critical' ? '🔴' :
                    issue.priority === 'high' ? '🟠' :
                    issue.priority === 'medium' ? '🟡' : '🟢';
        console.log(`  ${icon} ${issue.issue}`);
        if (issue.module) console.log(`     Module: ${issue.module}`);
        if (issue.tool) console.log(`     Tool: ${issue.tool}`);
        console.log(`     Fix: ${issue.solution}`);
        if (issue.autoFixable) console.log(`     ✨ Auto-fixable`);
        console.log();
      }
    }
    
    // Show trends if history available
    if (options.history && report.trends) {
      console.log('📈 Trends:\n');
      
      const showTrend = (current, previous) => {
        if (!previous) return '';
        const diff = current - previous;
        if (diff > 0) return `↗️ +${diff}%`;
        if (diff < 0) return `↘️ ${diff}%`;
        return '→ 0%';
      };
      
      const latestHistory = reportGenerator.getLatestReport();
      if (latestHistory) {
        console.log(`  Compliance: ${report.summary.complianceScore}% ${showTrend(report.summary.complianceScore, latestHistory.summary.complianceScore)}`);
        console.log(`  Success Rate: ${report.summary.successRate}% ${showTrend(report.summary.successRate, latestHistory.summary.successRate)}`);
        console.log(`  Coverage: ${report.summary.testCoverage}% ${showTrend(report.summary.testCoverage, latestHistory.summary.testCoverage)}\n`);
        
        // Compare with previous report
        if (latestHistory) {
          const comparison = reportGenerator.compareReports(latestHistory, report);
          
          if (comparison.complianceScoreChange > 0) {
            console.log(`  ✅ Compliance improved by ${comparison.complianceScoreChange}%`);
          } else if (comparison.complianceScoreChange < 0) {
            console.log(`  ⚠️  Compliance decreased by ${Math.abs(comparison.complianceScoreChange)}%`);
          }
          
          if (comparison.issuesChange.critical < 0) {
            console.log(`  ✅ Fixed ${Math.abs(comparison.issuesChange.critical)} critical issues`);
          } else if (comparison.issuesChange.critical > 0) {
            console.log(`  ⚠️  ${comparison.issuesChange.critical} new critical issues`);
          }
          
          console.log();
        }
      }
    }
    
    // Generate reports in requested formats
    console.log(`📄 Generating ${options.format} report...\n`);
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    
    if (options.format === 'json' || options.format === 'all') {
      const jsonPath = path.join(options.outputDir, `report_${timestamp}.json`);
      console.log(`✅ JSON report saved to ${jsonPath}`);
    }
    
    if (options.format === 'html' || options.format === 'all') {
      const htmlPath = path.join(options.outputDir, `report_${timestamp}.html`);
      console.log(`✅ HTML report saved to ${htmlPath}`);
      console.log(`   Open in browser: file://${path.resolve(htmlPath)}`);
    }
    
    if (options.format === 'markdown' || options.format === 'all') {
      const mdPath = path.join(options.outputDir, `report_${timestamp}.md`);
      console.log(`✅ Markdown report saved to ${mdPath}`);
    }
    
    // Save history
    if (options.history) {
      await reportGenerator.saveHistory();
      console.log('\n📜 Updated report history');
    }
    
    // Final assessment
    console.log('\n' + '='.repeat(50));
    
    if (report.summary.complianceScore >= 80 && report.summary.successRate >= 90) {
      console.log('\n🎉 Excellent! Your tool registry meets quality standards.');
    } else if (report.summary.complianceScore >= 60) {
      console.log('\n⚠️  Your tool registry needs some improvements.');
      console.log('   Run: npm run verify:fix to auto-fix issues');
    } else {
      console.log('\n❌ Your tool registry requires significant improvements.');
      console.log('   1. Run: npm run verify:fix to auto-fix issues');
      console.log('   2. Review the detailed report for manual fixes');
      console.log('   3. Run tests again after fixes');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error generating report:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
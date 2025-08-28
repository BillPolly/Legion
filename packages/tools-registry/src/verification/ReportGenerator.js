/**
 * ReportGenerator - Generates comprehensive compliance and test reports
 * 
 * Creates detailed reports in multiple formats (JSON, HTML, Markdown)
 */

import { createValidator } from '@legion/schema';
import { ComplianceReportSchema } from './schemas/index.js';
import { Logger } from '../utils/Logger.js';
import fs from 'fs/promises';
import path from 'path';

export class ReportGenerator {
  constructor(options = {}) {
    this.options = {
      format: options.format || 'json', // json, html, markdown, all
      outputDir: options.outputDir || './reports',
      includeDetails: options.includeDetails !== false,
      includeRecommendations: options.includeRecommendations !== false,
      includeHistory: options.includeHistory || false,
      verbose: false,
      ...options
    };
    
    this.reportValidator = createValidator(ComplianceReportSchema);
    this.reportHistory = [];
    this.logger = Logger.create('ReportGenerator', { verbose: this.options.verbose });
  }
  
  /**
   * Generate comprehensive report from test results
   * @param {Object} data - Test result data
   * @returns {Object} Generated report
   */
  async generateComprehensiveReport(data) {
    const report = {
      timestamp: data.timestamp || new Date().toISOString(),
      duration: data.duration || 0,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      summary: this.generateSummary(data),
      modules: this.generateModuleReport(data),
      validation: this.generateValidationReport(data.validation),
      tests: this.generateTestReport(data.tests),
      integration: this.generateIntegrationReport(data.integration),
      recommendations: this.generateRecommendations(data),
      trends: this.options.includeHistory ? this.generateTrends() : undefined
    };
    
    // Validate report structure
    const validation = this.reportValidator.validate(report);
    if (!validation.valid) {
      this.logger.warn(`Generated report does not match schema: ${validation.errors.map(e => e.message).join(', ')}`);
    }
    
    // Store in history
    this.reportHistory.push({
      timestamp: report.timestamp,
      summary: report.summary
    });
    
    // Save report to file
    await this.saveReport(report);
    
    return report;
  }
  
  /**
   * Generate summary section
   * @private
   */
  generateSummary(data) {
    const summary = {
      totalModules: data.modules?.length || 0,
      totalTools: 0,
      complianceScore: 0,
      testCoverage: 0,
      successRate: 0,
      criticalIssues: 0,
      warnings: 0,
      performance: {
        avgExecutionTime: 0,
        avgMemoryUsage: 0
      }
    };
    
    // Count tools and calculate compliance
    if (data.validation) {
      summary.totalTools = data.validation.summary?.totalTools || 0;
      summary.complianceScore = Math.round(
        ((data.validation.summary?.averageModuleScore || 0) + 
         (data.validation.summary?.averageToolScore || 0)) / 2
      );
      
      // Count issues
      if (data.validation.modules) {
        for (const module of data.validation.modules) {
          if (module.validation) {
            summary.criticalIssues += module.validation.errors?.length || 0;
            summary.warnings += module.validation.warnings?.length || 0;
          }
        }
      }
      
      if (data.validation.tools) {
        for (const tool of data.validation.tools) {
          if (tool.metadata) {
            summary.criticalIssues += tool.metadata.errors?.length || 0;
            summary.warnings += tool.metadata.warnings?.length || 0;
          }
        }
      }
    }
    
    // Calculate test metrics
    if (data.tests && data.tests.length > 0) {
      let totalTests = 0;
      let passedTests = 0;
      let totalExecutionTime = 0;
      let totalMemoryUsage = 0;
      let performanceCount = 0;
      
      for (const test of data.tests) {
        if (test.summary) {
          totalTests += test.summary.total || 0;
          passedTests += test.summary.passed || 0;
          
          if (test.summary.avgExecutionTime) {
            totalExecutionTime += test.summary.avgExecutionTime;
            performanceCount++;
          }
          if (test.summary.avgMemoryUsed) {
            totalMemoryUsage += test.summary.avgMemoryUsed;
          }
        }
      }
      
      if (totalTests > 0) {
        summary.successRate = Math.round((passedTests / totalTests) * 100);
        summary.testCoverage = Math.round((data.tests.length / summary.totalTools) * 100);
      }
      
      if (performanceCount > 0) {
        summary.performance.avgExecutionTime = Math.round(totalExecutionTime / performanceCount);
        summary.performance.avgMemoryUsage = Math.round(totalMemoryUsage / performanceCount);
      }
    }
    
    return summary;
  }
  
  /**
   * Generate module report section
   * @private
   */
  generateModuleReport(data) {
    if (!data.modules) return [];
    
    return data.modules.map(module => ({
      name: module.name,
      path: module.path,
      packageName: module.packageName,
      status: module.status || 'discovered',
      discoveredAt: module.discoveredAt
    }));
  }
  
  /**
   * Generate validation report section
   * @private
   */
  generateValidationReport(validation) {
    if (!validation) return null;
    
    const report = {
      summary: validation.summary,
      modules: [],
      tools: []
    };
    
    // Module validation details
    if (validation.modules) {
      report.modules = validation.modules.map(m => ({
        name: m.name,
        score: m.validation?.score || 0,
        valid: m.validation?.valid || false,
        errors: m.validation?.errors || [],
        warnings: m.validation?.warnings || [],
        status: this.getComplianceStatus(m.validation?.score || 0)
      }));
    }
    
    // Tool validation details
    if (validation.tools) {
      report.tools = validation.tools.map(t => ({
        module: t.module,
        name: t.name,
        score: Math.round(t.combinedScore || 0),
        metadata: {
          valid: t.metadata?.valid || false,
          score: t.metadata?.score || 0,
          errors: t.metadata?.errors || [],
          warnings: t.metadata?.warnings || []
        },
        interface: {
          valid: t.interface?.valid || false,
          errors: t.interface?.errors || [],
          warnings: t.interface?.warnings || []
        },
        schemas: {
          valid: t.schemas?.valid || false,
          errors: t.schemas?.errors || []
        }
      }));
    }
    
    return report;
  }
  
  /**
   * Generate test report section
   * @private
   */
  generateTestReport(tests) {
    if (!tests || tests.length === 0) return null;
    
    const report = {
      summary: {
        totalTools: tests.length,
        totalTests: 0,
        passed: 0,
        failed: 0,
        errors: 0,
        successRate: 0
      },
      tools: []
    };
    
    for (const test of tests) {
      if (test.summary) {
        report.summary.totalTests += test.summary.total || 0;
        report.summary.passed += test.summary.passed || 0;
        report.summary.failed += test.summary.failed || 0;
        report.summary.errors += test.summary.errors || 0;
      }
      
      const toolReport = {
        module: test.module,
        tool: test.tool,
        summary: test.summary,
        testsByType: test.report?.testsByType
      };
      
      // Include performance if available
      if (test.report?.performance) {
        toolReport.performance = {
          valid: test.report.performance.valid,
          metrics: test.report.performance.metrics
        };
      }
      
      // Include failed test details if requested
      if (this.options.includeDetails && test.results) {
        toolReport.failedTests = test.results
          .filter(r => r.status === 'failed' || r.status === 'error')
          .map(r => ({
            name: r.testName,
            status: r.status,
            error: r.error?.message
          }));
      }
      
      report.tools.push(toolReport);
    }
    
    if (report.summary.totalTests > 0) {
      report.summary.successRate = Math.round(
        (report.summary.passed / report.summary.totalTests) * 100
      );
    }
    
    return report;
  }
  
  /**
   * Generate integration report section
   * @private
   */
  generateIntegrationReport(integration) {
    if (!integration || integration.length === 0) return null;
    
    const report = {
      summary: {
        totalTests: integration.length,
        compatible: 0,
        incompatible: 0
      },
      chains: []
    };
    
    for (const test of integration) {
      if (test.result?.compatible) {
        report.summary.compatible++;
      } else {
        report.summary.incompatible++;
      }
      
      report.chains.push({
        tools: test.chain,
        compatible: test.result?.compatible || false,
        errors: test.result?.errors || []
      });
    }
    
    return report;
  }
  
  /**
   * Generate recommendations
   * @private
   */
  generateRecommendations(data) {
    if (!this.options.includeRecommendations) return [];
    
    const recommendations = [];
    
    // Analyze compliance scores
    const summary = data.summary || this.generateSummary(data);
    
    if (summary.complianceScore < 80) {
      recommendations.push({
        priority: 'critical',
        category: 'compliance',
        issue: `Overall compliance score is ${summary.complianceScore}%`,
        solution: 'Review and fix metadata issues in modules and tools',
        autoFixable: true
      });
    }
    
    if (summary.successRate < 90) {
      recommendations.push({
        priority: 'high',
        category: 'testing',
        issue: `Test success rate is only ${summary.successRate}%`,
        solution: 'Fix failing tests and improve error handling',
        autoFixable: false
      });
    }
    
    if (summary.testCoverage < 80) {
      recommendations.push({
        priority: 'medium',
        category: 'coverage',
        issue: `Test coverage is ${summary.testCoverage}%`,
        solution: 'Add more test cases for uncovered tools',
        autoFixable: true
      });
    }
    
    if (summary.criticalIssues > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'validation',
        issue: `${summary.criticalIssues} critical validation issues found`,
        solution: 'Address validation errors immediately',
        autoFixable: false
      });
    }
    
    // Tool-specific recommendations
    if (data.validation?.tools) {
      for (const tool of data.validation.tools) {
        if (tool.combinedScore < 70) {
          recommendations.push({
            priority: 'high',
            category: 'tool',
            module: tool.module,
            tool: tool.name,
            issue: `Tool compliance score is ${Math.round(tool.combinedScore)}%`,
            solution: 'Improve tool metadata and fix validation issues',
            autoFixable: true
          });
        }
      }
    }
    
    // Performance recommendations
    if (summary.performance?.avgExecutionTime > 1000) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        issue: `Average tool execution time is ${summary.performance.avgExecutionTime}ms`,
        solution: 'Optimize tool implementations for better performance',
        autoFixable: false
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  /**
   * Generate trend analysis
   * @private
   */
  generateTrends() {
    if (this.reportHistory.length < 2) return null;
    
    const trends = {
      complianceScore: [],
      successRate: [],
      testCoverage: [],
      issueCount: []
    };
    
    for (const report of this.reportHistory.slice(-10)) {
      trends.complianceScore.push({
        timestamp: report.timestamp,
        value: report.summary.complianceScore
      });
      
      trends.successRate.push({
        timestamp: report.timestamp,
        value: report.summary.successRate
      });
      
      trends.testCoverage.push({
        timestamp: report.timestamp,
        value: report.summary.testCoverage
      });
      
      trends.issueCount.push({
        timestamp: report.timestamp,
        value: report.summary.criticalIssues + report.summary.warnings
      });
    }
    
    return trends;
  }
  
  /**
   * Get compliance status from score
   * @private
   */
  getComplianceStatus(score) {
    if (score >= 95) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }
  
  /**
   * Save report to file
   * @private
   */
  async saveReport(report) {
    // Ensure output directory exists
    await fs.mkdir(this.options.outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const baseFilename = `report_${timestamp}`;
    
    // Save based on format
    if (this.options.format === 'json' || this.options.format === 'all') {
      await this.saveJsonReport(report, baseFilename);
    }
    
    if (this.options.format === 'html' || this.options.format === 'all') {
      await this.saveHtmlReport(report, baseFilename);
    }
    
    if (this.options.format === 'markdown' || this.options.format === 'all') {
      await this.saveMarkdownReport(report, baseFilename);
    }
  }
  
  /**
   * Save report as JSON
   * @private
   */
  async saveJsonReport(report, filename) {
    const filepath = path.join(this.options.outputDir, `${filename}.json`);
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    this.logger.verbose(`Report saved to: ${filepath}`);
  }
  
  /**
   * Save report as HTML
   * @private
   */
  async saveHtmlReport(report, filename) {
    const html = this.generateHtmlReport(report);
    const filepath = path.join(this.options.outputDir, `${filename}.html`);
    await fs.writeFile(filepath, html);
    this.logger.verbose(`HTML report saved to: ${filepath}`);
  }
  
  /**
   * Generate HTML report
   * @private
   */
  generateHtmlReport(report) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tool Registry Compliance Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .metric {
      background: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .metric-value {
      font-size: 2em;
      font-weight: bold;
      color: #2563eb;
    }
    
    .metric-label {
      color: #666;
      font-size: 0.9em;
    }
    
    .status-excellent { color: #10b981; }
    .status-good { color: #3b82f6; }
    .status-fair { color: #f59e0b; }
    .status-poor { color: #ef4444; }
    .status-critical { color: #dc2626; }
    
    .section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    
    h1, h2, h3 {
      margin-top: 0;
      color: #1f2937;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    
    th, td {
      text-align: left;
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    th {
      background: #f9fafb;
      font-weight: 600;
    }
    
    .recommendation {
      padding: 10px;
      margin: 10px 0;
      border-left: 4px solid;
      background: #f9fafb;
      border-radius: 4px;
    }
    
    .priority-critical {
      border-left-color: #dc2626;
      background: #fee2e2;
    }
    
    .priority-high {
      border-left-color: #f59e0b;
      background: #fef3c7;
    }
    
    .priority-medium {
      border-left-color: #3b82f6;
      background: #dbeafe;
    }
    
    .priority-low {
      border-left-color: #10b981;
      background: #d1fae5;
    }
    
    .progress-bar {
      width: 100%;
      height: 20px;
      background: #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
      margin: 10px 0;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #10b981);
      transition: width 0.3s ease;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Tool Registry Compliance Report</h1>
    <p>Generated: ${report.timestamp}</p>
    <p>Duration: ${Math.round(report.duration / 1000)}s</p>
  </div>
  
  <div class="summary">
    <div class="metric">
      <div class="metric-value">${report.summary.complianceScore}%</div>
      <div class="metric-label">Compliance Score</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${report.summary.complianceScore}%"></div>
      </div>
    </div>
    
    <div class="metric">
      <div class="metric-value">${report.summary.successRate}%</div>
      <div class="metric-label">Test Success Rate</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${report.summary.successRate}%"></div>
      </div>
    </div>
    
    <div class="metric">
      <div class="metric-value">${report.summary.testCoverage}%</div>
      <div class="metric-label">Test Coverage</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${report.summary.testCoverage}%"></div>
      </div>
    </div>
    
    <div class="metric">
      <div class="metric-value">${report.summary.totalModules}</div>
      <div class="metric-label">Total Modules</div>
    </div>
    
    <div class="metric">
      <div class="metric-value">${report.summary.totalTools}</div>
      <div class="metric-label">Total Tools</div>
    </div>
    
    <div class="metric">
      <div class="metric-value">${report.summary.criticalIssues}</div>
      <div class="metric-label">Critical Issues</div>
    </div>
  </div>
  
  ${this.generateRecommendationsHtml(report.recommendations)}
  ${this.generateModulesHtml(report.modules)}
  ${this.generateTestsHtml(report.tests)}
</body>
</html>`;
  }
  
  /**
   * Generate recommendations HTML section
   * @private
   */
  generateRecommendationsHtml(recommendations) {
    if (!recommendations || recommendations.length === 0) return '';
    
    return `
    <div class="section">
      <h2>Recommendations</h2>
      ${recommendations.map(r => `
        <div class="recommendation priority-${r.priority}">
          <strong>${r.priority.toUpperCase()}</strong>: ${r.issue}
          <br>Solution: ${r.solution}
          ${r.autoFixable ? '<br><em>Auto-fixable</em>' : ''}
        </div>
      `).join('')}
    </div>`;
  }
  
  /**
   * Generate modules HTML section
   * @private
   */
  generateModulesHtml(modules) {
    if (!modules || modules.length === 0) return '';
    
    return `
    <div class="section">
      <h2>Modules</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Package</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${modules.map(m => `
            <tr>
              <td>${m.name}</td>
              <td>${m.packageName}</td>
              <td>${m.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  }
  
  /**
   * Generate tests HTML section
   * @private
   */
  generateTestsHtml(tests) {
    if (!tests) return '';
    
    return `
    <div class="section">
      <h2>Test Results</h2>
      <p>Total Tests: ${tests.summary.totalTests}</p>
      <p>Passed: ${tests.summary.passed}</p>
      <p>Failed: ${tests.summary.failed}</p>
      <p>Success Rate: ${tests.summary.successRate}%</p>
    </div>`;
  }
  
  /**
   * Save report as Markdown
   * @private
   */
  async saveMarkdownReport(report, filename) {
    const markdown = this.generateMarkdownReport(report);
    const filepath = path.join(this.options.outputDir, `${filename}.md`);
    await fs.writeFile(filepath, markdown);
    this.logger.verbose(`Markdown report saved to: ${filepath}`);
  }
  
  /**
   * Generate Markdown report
   * @private
   */
  generateMarkdownReport(report) {
    let md = `# Tool Registry Compliance Report

Generated: ${report.timestamp}
Duration: ${Math.round(report.duration / 1000)}s

## Summary

- **Compliance Score**: ${report.summary.complianceScore}%
- **Test Success Rate**: ${report.summary.successRate}%
- **Test Coverage**: ${report.summary.testCoverage}%
- **Total Modules**: ${report.summary.totalModules}
- **Total Tools**: ${report.summary.totalTools}
- **Critical Issues**: ${report.summary.criticalIssues}
- **Warnings**: ${report.summary.warnings}

## Performance Metrics

- **Average Execution Time**: ${report.summary.performance.avgExecutionTime}ms
- **Average Memory Usage**: ${report.summary.performance.avgMemoryUsage}MB
`;
    
    // Add recommendations
    if (report.recommendations && report.recommendations.length > 0) {
      md += '\n## Recommendations\n\n';
      for (const rec of report.recommendations) {
        md += `### ${rec.priority.toUpperCase()}: ${rec.issue}\n\n`;
        md += `**Solution**: ${rec.solution}\n`;
        if (rec.module) md += `**Module**: ${rec.module}\n`;
        if (rec.tool) md += `**Tool**: ${rec.tool}\n`;
        if (rec.autoFixable) md += `**Auto-fixable**: Yes\n`;
        md += '\n';
      }
    }
    
    // Add module list
    if (report.modules && report.modules.length > 0) {
      md += '\n## Modules\n\n';
      md += '| Name | Package | Status |\n';
      md += '|------|---------|--------|\n';
      for (const module of report.modules) {
        md += `| ${module.name} | ${module.packageName} | ${module.status} |\n`;
      }
    }
    
    // Add test results
    if (report.tests) {
      md += '\n## Test Results\n\n';
      md += `- Total Tests: ${report.tests.summary.totalTests}\n`;
      md += `- Passed: ${report.tests.summary.passed}\n`;
      md += `- Failed: ${report.tests.summary.failed}\n`;
      md += `- Errors: ${report.tests.summary.errors}\n`;
      md += `- Success Rate: ${report.tests.summary.successRate}%\n`;
    }
    
    return md;
  }
  
  /**
   * Load report history from file
   */
  async loadHistory() {
    try {
      const historyPath = path.join(this.options.outputDir, 'history.json');
      const data = await fs.readFile(historyPath, 'utf-8');
      this.reportHistory = JSON.parse(data);
    } catch (error) {
      // No history file yet
      this.reportHistory = [];
    }
  }
  
  /**
   * Save report history to file
   */
  async saveHistory() {
    const historyPath = path.join(this.options.outputDir, 'history.json');
    await fs.writeFile(historyPath, JSON.stringify(this.reportHistory, null, 2));
  }
  
  /**
   * Get latest report
   * @returns {Object|null} Latest report or null
   */
  getLatestReport() {
    return this.reportHistory[this.reportHistory.length - 1] || null;
  }
  
  /**
   * Compare two reports
   * @param {Object} report1 - First report
   * @param {Object} report2 - Second report
   * @returns {Object} Comparison results
   */
  compareReports(report1, report2) {
    return {
      complianceScoreChange: report2.summary.complianceScore - report1.summary.complianceScore,
      successRateChange: report2.summary.successRate - report1.summary.successRate,
      testCoverageChange: report2.summary.testCoverage - report1.summary.testCoverage,
      issuesChange: {
        critical: (report2.summary.criticalIssues || 0) - (report1.summary.criticalIssues || 0),
        warnings: (report2.summary.warnings || 0) - (report1.summary.warnings || 0)
      },
      performanceChange: {
        executionTime: (report2.summary.performance?.avgExecutionTime || 0) - 
                      (report1.summary.performance?.avgExecutionTime || 0),
        memoryUsage: (report2.summary.performance?.avgMemoryUsage || 0) - 
                     (report1.summary.performance?.avgMemoryUsage || 0)
      }
    };
  }
}

export default ReportGenerator;
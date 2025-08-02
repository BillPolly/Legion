#!/usr/bin/env node

/**
 * Umbilical Testing Framework CLI
 * Command-line interface for running Umbilical tests on components
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { UmbilicalTestingFramework } from '../UmbilicalTestingFramework.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// CLI configuration
class UmbilicalCLI {
  constructor() {
    this.args = process.argv.slice(2);
    this.options = {
      verboseLogging: false,
      watch: false,
      outputFormat: 'console',
      outputFile: null,
      configFile: null,
      failFast: false,
      detectOnly: null,
      minGrade: null,
      showRecommendations: true,
      showBugDetails: true,
      parallelExecution: false,
      timeout: 30000
    };
    this.framework = null;
    this.results = [];
  }

  /**
   * Parse command-line arguments
   */
  parseArgs() {
    const help = this.args.includes('--help') || this.args.includes('-h');
    if (help || this.args.length === 0) {
      this.showHelp();
      process.exit(0);
    }

    const version = this.args.includes('--version') || this.args.includes('-v');
    if (version) {
      this.showVersion();
      process.exit(0);
    }

    // Parse options
    for (let i = 0; i < this.args.length; i++) {
      const arg = this.args[i];
      const nextArg = this.args[i + 1];

      switch (arg) {
        case '--verbose':
        case '-V':
          this.options.verboseLogging = true;
          break;
        
        case '--watch':
        case '-w':
          this.options.watch = true;
          break;
        
        case '--output':
        case '-o':
          this.options.outputFormat = nextArg || 'console';
          i++;
          break;
        
        case '--output-file':
        case '-f':
          this.options.outputFile = nextArg;
          i++;
          break;
        
        case '--config':
        case '-c':
          this.options.configFile = nextArg;
          i++;
          break;
        
        case '--fail-fast':
          this.options.failFast = true;
          break;
        
        case '--detect':
          this.options.detectOnly = nextArg;
          i++;
          break;
        
        case '--min-grade':
          this.options.minGrade = nextArg;
          i++;
          break;
        
        case '--no-recommendations':
          this.options.showRecommendations = false;
          break;
        
        case '--no-bug-details':
          this.options.showBugDetails = false;
          break;
        
        case '--parallel':
        case '-p':
          this.options.parallelExecution = true;
          break;
        
        case '--timeout':
        case '-t':
          this.options.timeout = parseInt(nextArg) || 30000;
          i++;
          break;
      }
    }

    // Get file/directory paths
    this.paths = this.args.filter(arg => !arg.startsWith('-')).filter(arg => {
      return !['console', 'json', 'html', 'markdown'].includes(arg);
    });

    if (this.paths.length === 0) {
      this.paths = [process.cwd()];
    }
  }

  /**
   * Show help message
   */
  showHelp() {
    console.log(`
${colors.bright}${colors.blue}Umbilical Testing Framework CLI${colors.reset}
${colors.cyan}Automatically detect [object InputEvent] and other UI bugs${colors.reset}

${colors.bright}Usage:${colors.reset}
  umbilical [options] [files/directories...]

${colors.bright}Options:${colors.reset}
  ${colors.green}-h, --help${colors.reset}              Show this help message
  ${colors.green}-v, --version${colors.reset}           Show version information
  ${colors.green}-V, --verbose${colors.reset}           Enable verbose logging
  ${colors.green}-w, --watch${colors.reset}             Watch files for changes
  ${colors.green}-o, --output${colors.reset} <format>   Output format (console|json|html|markdown)
  ${colors.green}-f, --output-file${colors.reset} <file> Save output to file
  ${colors.green}-c, --config${colors.reset} <file>     Use configuration file
  ${colors.green}-p, --parallel${colors.reset}          Run tests in parallel
  ${colors.green}-t, --timeout${colors.reset} <ms>      Test timeout in milliseconds (default: 30000)
  ${colors.green}--fail-fast${colors.reset}             Stop on first failure
  ${colors.green}--detect${colors.reset} <type>         Detect specific bug type only
  ${colors.green}--min-grade${colors.reset} <grade>     Minimum acceptable quality grade
  ${colors.green}--no-recommendations${colors.reset}    Hide recommendations
  ${colors.green}--no-bug-details${colors.reset}        Hide detailed bug information

${colors.bright}Examples:${colors.reset}
  ${colors.dim}# Test a single component${colors.reset}
  umbilical src/components/SearchInput.js

  ${colors.dim}# Test all components in a directory${colors.reset}
  umbilical src/components/

  ${colors.dim}# Watch for changes and re-test${colors.reset}
  umbilical --watch src/

  ${colors.dim}# Generate JSON report${colors.reset}
  umbilical --output json --output-file report.json src/

  ${colors.dim}# Only check for [object InputEvent] bugs${colors.reset}
  umbilical --detect parameter-passing src/

  ${colors.dim}# Require minimum B grade${colors.reset}
  umbilical --min-grade B src/components/

${colors.bright}Bug Detection Types:${colors.reset}
  ${colors.yellow}parameter-passing${colors.reset}   [object InputEvent] and similar bugs
  ${colors.yellow}type-errors${colors.reset}         Type mismatches and violations
  ${colors.yellow}coordination${colors.reset}        State-DOM coordination issues
  ${colors.yellow}invariants${colors.reset}          Property and constraint violations

${colors.bright}Quality Grades:${colors.reset}
  ${colors.green}A+${colors.reset} = Perfect (95%+ pass, 0 bugs)
  ${colors.green}A${colors.reset}  = Excellent (95%+ pass, ≤1 bug)
  ${colors.cyan}B${colors.reset}  = Good (85%+ pass, ≤2 bugs)
  ${colors.yellow}C${colors.reset}  = Fair (70%+ pass, ≤5 bugs)
  ${colors.yellow}D${colors.reset}  = Poor (50%+ pass, ≤10 bugs)
  ${colors.red}F${colors.reset}  = Failing (Critical bugs or <50% pass)
    `);
  }

  /**
   * Show version information
   */
  showVersion() {
    console.log(`Umbilical Testing Framework v1.0.0`);
  }

  /**
   * Load configuration from file
   */
  async loadConfig() {
    if (!this.options.configFile) return;

    try {
      const configPath = path.resolve(this.options.configFile);
      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      // Merge config with options
      this.options = { ...this.options, ...config };
      
      if (this.options.verboseLogging) {
        console.log(`${colors.dim}Loaded config from ${configPath}${colors.reset}`);
      }
    } catch (error) {
      console.error(`${colors.red}Failed to load config: ${error.message}${colors.reset}`);
    }
  }

  /**
   * Find component files in directory
   */
  async findComponentFiles(dirPath) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules and hidden directories
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const subFiles = await this.findComponentFiles(fullPath);
            files.push(...subFiles);
          }
        } else if (entry.isFile()) {
          // Look for JavaScript files that might be components
          if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
            // Skip test files
            if (!entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
              files.push(fullPath);
            }
          }
        }
      }
    } catch (error) {
      console.error(`${colors.red}Error scanning directory ${dirPath}: ${error.message}${colors.reset}`);
    }
    
    return files;
  }

  /**
   * Load and validate a component file
   */
  async loadComponent(filePath) {
    try {
      const module = await import(filePath);
      
      // Check if it's a valid Umbilical component
      const component = module.default || module[Object.keys(module)[0]];
      
      if (component && typeof component.describe === 'function') {
        return component;
      }
      
      if (this.options.verboseLogging) {
        console.log(`${colors.dim}Skipping ${filePath} - not an Umbilical component${colors.reset}`);
      }
      
      return null;
    } catch (error) {
      console.error(`${colors.red}Failed to load ${filePath}: ${error.message}${colors.reset}`);
      return null;
    }
  }

  /**
   * Test a single component
   */
  async testComponent(component, filePath) {
    const startTime = Date.now();
    const fileName = path.basename(filePath);
    
    console.log(`\n${colors.bright}Testing: ${fileName}${colors.reset}`);
    console.log(`${colors.dim}Path: ${filePath}${colors.reset}`);
    
    try {
      const results = await this.framework.testComponent(component);
      const duration = Date.now() - startTime;
      
      // Store results
      this.results.push({
        file: filePath,
        component: component.name || fileName,
        results,
        duration
      });
      
      // Display results based on output format
      if (this.options.outputFormat === 'console') {
        this.displayConsoleResults(results, fileName);
      }
      
      // Check for failures
      if (this.options.failFast && results.analysis.bugAnalysis.totalBugs > 0) {
        throw new Error(`Component ${fileName} has ${results.analysis.bugAnalysis.totalBugs} bugs`);
      }
      
      // Check minimum grade
      if (this.options.minGrade) {
        const grade = results.analysis.qualityMetrics.grade;
        if (this.compareGrades(grade, this.options.minGrade) < 0) {
          throw new Error(`Component ${fileName} grade ${grade} is below minimum ${this.options.minGrade}`);
        }
      }
      
      return results;
    } catch (error) {
      console.error(`${colors.red}Test failed: ${error.message}${colors.reset}`);
      
      if (this.options.failFast) {
        process.exit(1);
      }
      
      return null;
    }
  }

  /**
   * Display results in console format
   */
  displayConsoleResults(results, fileName) {
    const bugs = results.analysis.bugAnalysis;
    const quality = results.analysis.qualityMetrics;
    const coverage = results.analysis.coverageAnalysis;
    
    // Summary line
    const gradeColor = quality.grade === 'F' ? colors.red :
                      quality.grade.startsWith('A') ? colors.green :
                      quality.grade === 'B' ? colors.cyan : colors.yellow;
    
    console.log(`\n${colors.bright}Results:${colors.reset}`);
    console.log(`  Grade: ${gradeColor}${quality.grade}${colors.reset} (Score: ${quality.overallQualityScore}/100)`);
    console.log(`  Tests: ${results.testResults.summary.passed}/${results.testResults.summary.totalTests} passed (${results.testResults.summary.passRate.toFixed(1)}%)`);
    console.log(`  Coverage: ${coverage.overallCoveragePercentage.toFixed(1)}%`);
    console.log(`  Duration: ${results.duration}ms`);
    
    // Bug detection
    if (bugs.totalBugs > 0) {
      console.log(`\n${colors.red}Bugs Found: ${bugs.totalBugs}${colors.reset}`);
      console.log(`  ${colors.red}High: ${bugs.bugsBySeverity.high}${colors.reset}`);
      console.log(`  ${colors.yellow}Medium: ${bugs.bugsBySeverity.medium}${colors.reset}`);
      console.log(`  ${colors.cyan}Low: ${bugs.bugsBySeverity.low}${colors.reset}`);
      
      if (bugs.wouldDetectOriginalBug) {
        console.log(`  ${colors.red}⚠️  [object InputEvent] bug detected!${colors.reset}`);
      }
      
      // Show bug details if enabled
      if (this.options.showBugDetails && this.options.detectOnly) {
        this.displayBugDetails(results.testResults.bugDetection);
      }
    } else {
      console.log(`\n${colors.green}✓ No bugs detected${colors.reset}`);
    }
    
    // Recommendations
    if (this.options.showRecommendations && results.report.actionItems.length > 0) {
      console.log(`\n${colors.bright}Recommendations:${colors.reset}`);
      results.report.actionItems.slice(0, 3).forEach((item, i) => {
        const priorityColor = item.priority === 'CRITICAL' ? colors.red :
                            item.priority === 'HIGH' ? colors.yellow : colors.cyan;
        console.log(`  ${i + 1}. ${priorityColor}[${item.priority}]${colors.reset} ${item.action}`);
      });
    }
  }

  /**
   * Display detailed bug information
   */
  displayBugDetails(bugDetection) {
    const bugTypes = {
      parameterBugs: 'Parameter Passing Bugs',
      coordinationBugs: 'Coordination Bugs',
      typeErrors: 'Type Errors',
      invariantViolations: 'Invariant Violations'
    };
    
    for (const [key, label] of Object.entries(bugTypes)) {
      const bugs = bugDetection[key];
      if (bugs && bugs.length > 0) {
        console.log(`\n  ${colors.yellow}${label}:${colors.reset}`);
        bugs.slice(0, 3).forEach((bug, i) => {
          console.log(`    ${i + 1}. ${bug.message || bug.issue || bug.error}`);
        });
      }
    }
  }

  /**
   * Compare quality grades
   */
  compareGrades(grade1, grade2) {
    const gradeOrder = ['F', 'D', 'C', 'B', 'A', 'A+'];
    const index1 = gradeOrder.indexOf(grade1);
    const index2 = gradeOrder.indexOf(grade2);
    return index1 - index2;
  }

  /**
   * Generate output in different formats
   */
  async generateOutput() {
    if (this.results.length === 0) return;
    
    let output;
    
    switch (this.options.outputFormat) {
      case 'json':
        output = this.generateJSONOutput();
        break;
      case 'html':
        output = this.generateHTMLOutput();
        break;
      case 'markdown':
        output = this.generateMarkdownOutput();
        break;
      default:
        return; // Console output already displayed
    }
    
    if (this.options.outputFile) {
      await fs.writeFile(this.options.outputFile, output, 'utf8');
      console.log(`\n${colors.green}Output saved to ${this.options.outputFile}${colors.reset}`);
    } else {
      console.log(output);
    }
  }

  /**
   * Generate JSON output
   */
  generateJSONOutput() {
    const summary = {
      timestamp: new Date().toISOString(),
      totalComponents: this.results.length,
      totalBugs: this.results.reduce((sum, r) => sum + r.results.analysis.bugAnalysis.totalBugs, 0),
      components: this.results.map(r => ({
        file: r.file,
        component: r.component,
        grade: r.results.analysis.qualityMetrics.grade,
        score: r.results.analysis.qualityMetrics.overallQualityScore,
        bugs: r.results.analysis.bugAnalysis.totalBugs,
        wouldDetectInputEventBug: r.results.analysis.bugAnalysis.wouldDetectOriginalBug,
        passRate: r.results.testResults.summary.passRate,
        duration: r.duration
      })),
      fullResults: this.options.verboseLogging ? this.results : undefined
    };
    
    return JSON.stringify(summary, null, 2);
  }

  /**
   * Generate HTML output
   */
  generateHTMLOutput() {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Umbilical Testing Results</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .component { border: 1px solid #ddd; margin: 10px 0; padding: 10px; border-radius: 5px; }
    .grade-A { background: #d4f4dd; }
    .grade-B { background: #d4e4f4; }
    .grade-C { background: #fff4d4; }
    .grade-D { background: #ffe4d4; }
    .grade-F { background: #ffd4d4; }
    .bugs { color: #d00; font-weight: bold; }
    .pass { color: #0a0; }
    .fail { color: #d00; }
  </style>
</head>
<body>
  <h1>Umbilical Testing Results</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  <div class="summary">
    <h2>Summary</h2>
    <p>Total Components: ${this.results.length}</p>
    <p>Total Bugs: ${this.results.reduce((sum, r) => sum + r.results.analysis.bugAnalysis.totalBugs, 0)}</p>
  </div>
  <div class="components">
    <h2>Components</h2>
    ${this.results.map(r => `
      <div class="component grade-${r.results.analysis.qualityMetrics.grade[0]}">
        <h3>${r.component}</h3>
        <p>File: ${r.file}</p>
        <p>Grade: <strong>${r.results.analysis.qualityMetrics.grade}</strong> (${r.results.analysis.qualityMetrics.overallQualityScore}/100)</p>
        <p>Tests: ${r.results.testResults.summary.passed}/${r.results.testResults.summary.totalTests} passed</p>
        ${r.results.analysis.bugAnalysis.totalBugs > 0 ? 
          `<p class="bugs">Bugs: ${r.results.analysis.bugAnalysis.totalBugs}</p>` : 
          '<p class="pass">✓ No bugs</p>'}
        ${r.results.analysis.bugAnalysis.wouldDetectOriginalBug ? 
          '<p class="bugs">⚠️ [object InputEvent] bug detected!</p>' : ''}
      </div>
    `).join('')}
  </div>
</body>
</html>`;
    
    return html;
  }

  /**
   * Generate Markdown output
   */
  generateMarkdownOutput() {
    const md = `# Umbilical Testing Results

Generated: ${new Date().toLocaleString()}

## Summary

- **Total Components:** ${this.results.length}
- **Total Bugs:** ${this.results.reduce((sum, r) => sum + r.results.analysis.bugAnalysis.totalBugs, 0)}

## Components

${this.results.map(r => `
### ${r.component}

- **File:** \`${r.file}\`
- **Grade:** ${r.results.analysis.qualityMetrics.grade} (${r.results.analysis.qualityMetrics.overallQualityScore}/100)
- **Tests:** ${r.results.testResults.summary.passed}/${r.results.testResults.summary.totalTests} passed (${r.results.testResults.summary.passRate.toFixed(1)}%)
- **Bugs:** ${r.results.analysis.bugAnalysis.totalBugs}
${r.results.analysis.bugAnalysis.wouldDetectOriginalBug ? '- **⚠️ [object InputEvent] bug detected!**' : ''}

${r.results.analysis.bugAnalysis.totalBugs > 0 ? `
#### Bug Breakdown
- High: ${r.results.analysis.bugAnalysis.bugsBySeverity.high}
- Medium: ${r.results.analysis.bugAnalysis.bugsBySeverity.medium}
- Low: ${r.results.analysis.bugAnalysis.bugsBySeverity.low}
` : '✓ No bugs detected'}
`).join('\n---\n')}
`;
    
    return md;
  }

  /**
   * Watch mode implementation
   */
  async watchFiles() {
    console.log(`${colors.cyan}Watching for changes...${colors.reset}`);
    
    const { watch } = await import('fs');
    const watchers = new Map();
    
    for (const filePath of this.paths) {
      const watcher = watch(filePath, async (eventType, filename) => {
        if (eventType === 'change') {
          console.log(`\n${colors.yellow}File changed: ${filename}${colors.reset}`);
          
          const fullPath = path.join(filePath, filename);
          const component = await this.loadComponent(fullPath);
          
          if (component) {
            await this.testComponent(component, fullPath);
          }
        }
      });
      
      watchers.set(filePath, watcher);
    }
    
    // Keep process alive
    process.stdin.resume();
    
    // Cleanup on exit
    process.on('SIGINT', () => {
      console.log(`\n${colors.cyan}Stopping watch mode...${colors.reset}`);
      watchers.forEach(w => w.close());
      process.exit(0);
    });
  }

  /**
   * Main execution
   */
  async run() {
    console.log(`${colors.bright}${colors.blue}🎯 Umbilical Testing Framework${colors.reset}`);
    console.log(`${colors.cyan}Detecting [object InputEvent] and other UI bugs${colors.reset}\n`);
    
    // Parse arguments
    this.parseArgs();
    
    // Load configuration
    await this.loadConfig();
    
    // Initialize framework
    this.framework = new UmbilicalTestingFramework({
      verboseLogging: this.options.verboseLogging,
      parallelExecution: this.options.parallelExecution,
      testTimeout: this.options.timeout,
      detectParameterBugs: !this.options.detectOnly || this.options.detectOnly === 'parameter-passing',
      detectCoordinationBugs: !this.options.detectOnly || this.options.detectOnly === 'coordination',
      includeInvariantTests: !this.options.detectOnly || this.options.detectOnly === 'invariants'
    });
    
    // Find all component files
    const componentFiles = [];
    for (const p of this.paths) {
      const stat = await fs.stat(p).catch(() => null);
      
      if (!stat) {
        console.error(`${colors.red}Path not found: ${p}${colors.reset}`);
        continue;
      }
      
      if (stat.isDirectory()) {
        const files = await this.findComponentFiles(p);
        componentFiles.push(...files);
      } else if (stat.isFile()) {
        componentFiles.push(p);
      }
    }
    
    if (componentFiles.length === 0) {
      console.error(`${colors.red}No component files found${colors.reset}`);
      process.exit(1);
    }
    
    console.log(`Found ${componentFiles.length} potential component file(s)\n`);
    
    // Test each component
    let tested = 0;
    for (const filePath of componentFiles) {
      const component = await this.loadComponent(filePath);
      
      if (component) {
        await this.testComponent(component, filePath);
        tested++;
      }
    }
    
    if (tested === 0) {
      console.error(`${colors.red}No valid Umbilical components found${colors.reset}`);
      process.exit(1);
    }
    
    // Generate output
    await this.generateOutput();
    
    // Summary
    console.log(`\n${colors.bright}${colors.blue}Summary:${colors.reset}`);
    console.log(`  Components tested: ${tested}`);
    
    const totalBugs = this.results.reduce((sum, r) => sum + r.results.analysis.bugAnalysis.totalBugs, 0);
    const inputEventBugs = this.results.filter(r => r.results.analysis.bugAnalysis.wouldDetectOriginalBug).length;
    
    if (totalBugs > 0) {
      console.log(`  ${colors.red}Total bugs found: ${totalBugs}${colors.reset}`);
      if (inputEventBugs > 0) {
        console.log(`  ${colors.red}[object InputEvent] bugs: ${inputEventBugs}${colors.reset}`);
      }
    } else {
      console.log(`  ${colors.green}✓ No bugs found${colors.reset}`);
    }
    
    // Watch mode
    if (this.options.watch) {
      await this.watchFiles();
    } else {
      // Exit with error code if bugs found
      process.exit(totalBugs > 0 ? 1 : 0);
    }
  }
}

// Run CLI
const cli = new UmbilicalCLI();
cli.run().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  if (cli.options.verboseLogging) {
    console.error(error.stack);
  }
  process.exit(1);
});
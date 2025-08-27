/**
 * ChangeTracker - Intelligent change detection and categorization
 * 
 * Analyzes file changes, categorizes them by type (code, tests, config),
 * and provides change impact analysis for intelligent commit management.
 */

import EventEmitter from 'events';
import { spawn } from 'child_process';
import path from 'path';

class ChangeTracker extends EventEmitter {
  constructor(repositoryManager, config) {
    super();
    
    this.repositoryManager = repositoryManager;
    this.config = config;
    this.initialized = false;
    
    // Change tracking configuration
    this.trackingConfig = {
      detectRenames: config.detectRenames !== false,
      renameThreshold: config.renameThreshold || 50,
      contextLines: config.contextLines || 3,
      ignoreWhitespace: config.ignoreWhitespace || false,
      categorizeChanges: config.categorizeChanges !== false
    };
    
    // Change categories
    this.categories = {
      code: {
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rs'],
        patterns: ['/src/', '/lib/', '/app/'],
        priority: 'high'
      },
      test: {
        extensions: ['.test.js', '.spec.js', '.test.ts', '.spec.ts'],
        patterns: ['/test/', '/__tests__/', '/tests/', '.test.', '.spec.'],
        priority: 'medium'
      },
      config: {
        extensions: ['.json', '.yml', '.yaml', '.toml', '.ini', '.env'],
        patterns: ['/config/', 'package.json', 'tsconfig.json', '.eslintrc'],
        priority: 'medium'
      },
      documentation: {
        extensions: ['.md', '.rst', '.txt'],
        patterns: ['/docs/', 'README', 'CHANGELOG', 'LICENSE'],
        priority: 'low'
      },
      style: {
        extensions: ['.css', '.scss', '.sass', '.less'],
        patterns: ['/styles/', '/css/'],
        priority: 'low'
      },
      asset: {
        extensions: ['.png', '.jpg', '.svg', '.gif', '.ico'],
        patterns: ['/assets/', '/images/', '/public/'],
        priority: 'low'
      }
    };
    
    // Change statistics
    this.changeStats = {
      totalChanges: 0,
      categorizedChanges: {},
      impactScore: 0,
      lastAnalysis: null
    };
    
    // Current change state
    this.currentChanges = new Map();
    this.changeHistory = [];
  }
  
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (!this.repositoryManager.isInitialized()) {
      throw new Error('RepositoryManager must be initialized first');
    }
    
    // Initialize category stats
    for (const category of Object.keys(this.categories)) {
      this.changeStats.categorizedChanges[category] = 0;
    }
    
    this.initialized = true;
    this.emit('initialized', {
      trackingConfig: this.trackingConfig,
      categories: Object.keys(this.categories)
    });
  }
  
  /**
   * Analyze all current changes in the repository
   */
  async analyzeChanges(options = {}) {
    this.currentChanges.clear();
    
    try {
      // Get unstaged changes
      const unstagedChanges = await this.getUnstagedChanges();
      
      // Get staged changes
      const stagedChanges = await this.getStagedChanges();
      
      // Get untracked files
      const untrackedFiles = await this.getUntrackedFiles();
      
      // Combine and analyze all changes
      const allChanges = {
        unstaged: unstagedChanges,
        staged: stagedChanges,
        untracked: untrackedFiles
      };
      
      // Categorize changes
      const categorizedChanges = await this.categorizeAllChanges(allChanges);
      
      // Calculate impact
      const impactAnalysis = this.analyzeChangeImpact(categorizedChanges);
      
      // Update stats
      this.updateChangeStats(categorizedChanges, impactAnalysis);
      
      this.emit('changesAnalyzed', {
        totalChanges: this.currentChanges.size,
        categorized: categorizedChanges,
        impact: impactAnalysis
      });
      
      return {
        changes: categorizedChanges,
        impact: impactAnalysis,
        stats: this.changeStats
      };
      
    } catch (error) {
      this.emit('error', new Error(`Failed to analyze changes: ${error.message}`));
      throw error;
    }
  }
  
  /**
   * Get unstaged changes
   */
  async getUnstagedChanges() {
    const diffArgs = ['diff', '--name-status'];
    
    if (this.trackingConfig.detectRenames) {
      diffArgs.push(`-M${this.trackingConfig.renameThreshold}%`);
    }
    
    const output = await this.executeGitCommand(diffArgs);
    return this.parseDiffOutput(output, 'unstaged');
  }
  
  /**
   * Get staged changes
   */
  async getStagedChanges() {
    const diffArgs = ['diff', '--cached', '--name-status'];
    
    if (this.trackingConfig.detectRenames) {
      diffArgs.push(`-M${this.trackingConfig.renameThreshold}%`);
    }
    
    const output = await this.executeGitCommand(diffArgs);
    return this.parseDiffOutput(output, 'staged');
  }
  
  /**
   * Get untracked files
   */
  async getUntrackedFiles() {
    const output = await this.executeGitCommand(['ls-files', '--others', '--exclude-standard']);
    const files = output.trim().split('\n').filter(f => f);
    
    return files.map(file => ({
      file,
      status: 'untracked',
      type: 'A' // Treat as added
    }));
  }
  
  /**
   * Parse diff output
   */
  parseDiffOutput(output, stage) {
    const changes = [];
    const lines = output.trim().split('\n').filter(line => line);
    
    for (const line of lines) {
      const parts = line.split('\t');
      const status = parts[0];
      
      let change;
      if (status.startsWith('R')) {
        // Rename
        const similarity = parseInt(status.substring(1));
        change = {
          type: 'R',
          file: parts[2],
          oldFile: parts[1],
          similarity,
          status: stage
        };
      } else {
        change = {
          type: status,
          file: parts[1],
          status: stage
        };
      }
      
      changes.push(change);
      this.currentChanges.set(change.file, change);
    }
    
    return changes;
  }
  
  /**
   * Categorize all changes
   */
  async categorizeAllChanges(allChanges) {
    const categorized = {
      code: [],
      test: [],
      config: [],
      documentation: [],
      style: [],
      asset: [],
      other: []
    };
    
    // Process all change types
    const changes = [
      ...allChanges.unstaged,
      ...allChanges.staged,
      ...allChanges.untracked
    ];
    
    for (const change of changes) {
      const category = this.categorizeFile(change.file);
      
      const categorizedChange = {
        ...change,
        category,
        priority: this.categories[category]?.priority || 'low'
      };
      
      if (categorized[category]) {
        categorized[category].push(categorizedChange);
      } else {
        categorized.other.push(categorizedChange);
      }
    }
    
    // Get detailed change information for important files
    if (this.config.analyzeContent !== false) {
      await this.analyzeChangeContent(categorized);
    }
    
    return categorized;
  }
  
  /**
   * Categorize a single file
   */
  categorizeFile(filePath) {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath);
    const dirPath = path.dirname(filePath);
    
    // Check each category
    for (const [category, rules] of Object.entries(this.categories)) {
      // Check extensions
      if (rules.extensions.some(e => fileName.endsWith(e) || ext === e)) {
        return category;
      }
      
      // Check patterns
      if (rules.patterns.some(p => filePath.includes(p) || fileName.includes(p))) {
        return category;
      }
    }
    
    return 'other';
  }
  
  /**
   * Analyze change content for important files
   */
  async analyzeChangeContent(categorized) {
    // Analyze code changes
    for (const change of categorized.code) {
      if (change.type === 'M' || change.type === 'A') {
        try {
          const analysis = await this.analyzeFileChange(change);
          change.analysis = analysis;
        } catch (error) {
          // Continue with other files
        }
      }
    }
    
    // Analyze test changes
    for (const change of categorized.test) {
      if (change.type === 'M' || change.type === 'A') {
        try {
          const analysis = await this.analyzeTestChange(change);
          change.analysis = analysis;
        } catch (error) {
          // Continue with other files
        }
      }
    }
  }
  
  /**
   * Analyze individual file change
   */
  async analyzeFileChange(change) {
    const diffArgs = ['diff'];
    
    if (change.status === 'staged') {
      diffArgs.push('--cached');
    }
    
    diffArgs.push('--', change.file);
    
    try {
      const diffOutput = await this.executeGitCommand(diffArgs);
      
      const analysis = {
        linesAdded: 0,
        linesRemoved: 0,
        functions: [],
        imports: [],
        exports: []
      };
      
      const lines = diffOutput.split('\n');
      for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          analysis.linesAdded++;
          
          // Detect function definitions
          const funcMatch = line.match(/^\+\s*(function|const|let|var|class)\s+(\w+)/);
          if (funcMatch) {
            analysis.functions.push(funcMatch[2]);
          }
          
          // Detect imports
          const importMatch = line.match(/^\+\s*import\s+.*from\s+['"](.+)['"]/);
          if (importMatch) {
            analysis.imports.push(importMatch[1]);
          }
          
          // Detect exports
          const exportMatch = line.match(/^\+\s*export\s+(default\s+)?(\w+)/);
          if (exportMatch) {
            analysis.exports.push(exportMatch[2]);
          }
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          analysis.linesRemoved++;
        }
      }
      
      return analysis;
      
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Analyze test change
   */
  async analyzeTestChange(change) {
    const analysis = await this.analyzeFileChange(change);
    
    if (analysis) {
      // Detect test patterns
      analysis.testPatterns = {
        describes: [],
        tests: []
      };
      
      const diffArgs = ['diff'];
      if (change.status === 'staged') {
        diffArgs.push('--cached');
      }
      diffArgs.push('--', change.file);
      
      try {
        const diffOutput = await this.executeGitCommand(diffArgs);
        const lines = diffOutput.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('+')) {
            // Detect describe blocks
            const describeMatch = line.match(/^\+.*describe\s*\(\s*['"`](.+?)['"`]/);
            if (describeMatch) {
              analysis.testPatterns.describes.push(describeMatch[1]);
            }
            
            // Detect test/it blocks
            const testMatch = line.match(/^\+.*(test|it)\s*\(\s*['"`](.+?)['"`]/);
            if (testMatch) {
              analysis.testPatterns.tests.push(testMatch[2]);
            }
          }
        }
      } catch (error) {
        // Continue without test pattern analysis
      }
    }
    
    return analysis;
  }
  
  /**
   * Analyze change impact
   */
  analyzeChangeImpact(categorizedChanges) {
    const impact = {
      score: 0,
      level: 'low',
      reasons: [],
      recommendations: []
    };
    
    // Calculate impact score based on categories and changes
    const categoryWeights = {
      code: 10,
      test: 8,
      config: 7,
      documentation: 3,
      style: 2,
      asset: 1,
      other: 5
    };
    
    for (const [category, changes] of Object.entries(categorizedChanges)) {
      if (changes.length > 0) {
        const weight = categoryWeights[category] || 1;
        impact.score += changes.length * weight;
        
        // Add reasons
        if (category === 'code' && changes.length > 0) {
          impact.reasons.push(`${changes.length} code file(s) modified`);
          
          // Check for breaking changes
          const hasDeletes = changes.some(c => c.type === 'D');
          const hasRenames = changes.some(c => c.type === 'R');
          
          if (hasDeletes || hasRenames) {
            impact.score += 20;
            impact.reasons.push('Potential breaking changes detected');
            impact.recommendations.push('Review deleted/renamed files for API compatibility');
          }
        }
        
        if (category === 'test' && changes.length > 0) {
          impact.reasons.push(`${changes.length} test file(s) modified`);
          impact.recommendations.push('Run test suite before committing');
        }
        
        if (category === 'config' && changes.length > 0) {
          impact.reasons.push(`${changes.length} configuration file(s) modified`);
          impact.recommendations.push('Verify configuration changes are backward compatible');
        }
      }
    }
    
    // Determine impact level
    if (impact.score >= 50) {
      impact.level = 'critical';
      impact.recommendations.unshift('Consider breaking changes into smaller commits');
    } else if (impact.score >= 30) {
      impact.level = 'high';
    } else if (impact.score >= 15) {
      impact.level = 'medium';
    }
    
    // Add general recommendations
    if (categorizedChanges.code.length > 0 && categorizedChanges.test.length === 0) {
      impact.recommendations.push('Consider adding tests for code changes');
    }
    
    if (categorizedChanges.code.length > 5) {
      impact.recommendations.push('Large number of files changed - ensure atomic commits');
    }
    
    return impact;
  }
  
  /**
   * Update change statistics
   */
  updateChangeStats(categorizedChanges, impactAnalysis) {
    this.changeStats.totalChanges = this.currentChanges.size;
    this.changeStats.impactScore = impactAnalysis.score;
    this.changeStats.lastAnalysis = new Date();
    
    // Update category counts
    for (const [category, changes] of Object.entries(categorizedChanges)) {
      this.changeStats.categorizedChanges[category] = changes.length;
    }
    
    // Add to history
    this.changeHistory.push({
      timestamp: new Date(),
      totalChanges: this.changeStats.totalChanges,
      categorized: { ...this.changeStats.categorizedChanges },
      impact: impactAnalysis
    });
    
    // Keep history limited
    if (this.changeHistory.length > 100) {
      this.changeHistory.shift();
    }
  }
  
  /**
   * Get change summary
   */
  getChangeSummary() {
    const summary = {
      total: this.currentChanges.size,
      byCategory: {},
      byStatus: {
        staged: 0,
        unstaged: 0,
        untracked: 0
      },
      byType: {
        added: 0,
        modified: 0,
        deleted: 0,
        renamed: 0
      }
    };
    
    // Count by category
    for (const [file, change] of this.currentChanges) {
      const category = this.categorizeFile(file);
      summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
      
      // Count by status
      summary.byStatus[change.status]++;
      
      // Count by type
      switch (change.type) {
        case 'A':
          summary.byType.added++;
          break;
        case 'M':
          summary.byType.modified++;
          break;
        case 'D':
          summary.byType.deleted++;
          break;
        case 'R':
          summary.byType.renamed++;
          break;
      }
    }
    
    return summary;
  }
  
  /**
   * Get recommendations for current changes
   */
  getChangeRecommendations() {
    const recommendations = [];
    const summary = this.getChangeSummary();
    
    // Recommend staging strategy
    if (summary.total > 10) {
      recommendations.push({
        type: 'staging',
        message: 'Consider staging related changes together for atomic commits',
        priority: 'high'
      });
    }
    
    // Check for mixed concerns
    const significantCategories = Object.entries(summary.byCategory)
      .filter(([cat, count]) => count > 0 && cat !== 'other')
      .map(([cat]) => cat);
    
    if (significantCategories.length > 2) {
      recommendations.push({
        type: 'separation',
        message: 'Multiple change types detected - consider separate commits',
        priority: 'medium',
        categories: significantCategories
      });
    }
    
    // Check for missing tests
    if (summary.byCategory.code > 0 && summary.byCategory.test === 0) {
      recommendations.push({
        type: 'testing',
        message: 'Code changes without test updates detected',
        priority: 'medium'
      });
    }
    
    // Check for configuration changes
    if (summary.byCategory.config > 0) {
      recommendations.push({
        type: 'validation',
        message: 'Configuration changes detected - validate before committing',
        priority: 'high'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Execute Git command
   */
  async executeGitCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn('git', args, {
        cwd: this.repositoryManager.workingDirectory,
        stdio: 'pipe',
        ...options
      });
      
      let stdout = '';
      let stderr = '';
      
      gitProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      gitProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      gitProcess.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git command failed: ${stderr || stdout}`));
        }
      });
      
      gitProcess.on('error', (error) => {
        reject(new Error(`Failed to execute git command: ${error.message}`));
      });
    });
  }
  
  /**
   * Get tracker status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      trackingConfig: this.trackingConfig,
      currentChanges: this.currentChanges.size,
      stats: this.changeStats,
      historySize: this.changeHistory.length
    };
  }
  
  /**
   * Check if tracker is initialized
   */
  isInitialized() {
    return this.initialized;
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    this.currentChanges.clear();
    this.changeHistory = [];
    this.initialized = false;
    this.emit('cleanup');
  }
}

export default ChangeTracker;
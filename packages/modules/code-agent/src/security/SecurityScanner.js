/**
 * SecurityScanner - Security validation for generated code
 * 
 * Provides:
 * - Vulnerability scanning
 * - Dependency security checks
 * - Code pattern analysis
 * - Secret detection
 * - Security best practices validation
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Security rule definitions
 */
const SECURITY_RULES = {
  // Dangerous patterns
  dangerousPatterns: [
    { pattern: /eval\s*\(/, severity: 'critical', message: 'eval() usage detected' },
    { pattern: /Function\s*\(/, severity: 'critical', message: 'Function constructor detected' },
    { pattern: /innerHTML\s*=/, severity: 'high', message: 'innerHTML assignment detected' },
    { pattern: /document\.write/, severity: 'high', message: 'document.write detected' },
    { pattern: /\.exec\s*\(/, severity: 'medium', message: 'exec() usage detected' },
    { pattern: /require\s*\(\s*[^'"]/,  severity: 'high', message: 'Dynamic require detected' }
  ],
  
  // SQL injection patterns
  sqlInjection: [
    { pattern: /query\s*\(\s*['"`].*\+/, severity: 'critical', message: 'Potential SQL injection' },
    { pattern: /query\s*\(\s*`[^`]*\$\{/, severity: 'critical', message: 'Template string in SQL query' }
  ],
  
  // XSS patterns
  xssPatterns: [
    { pattern: /dangerouslySetInnerHTML/, severity: 'high', message: 'React dangerouslySetInnerHTML' },
    { pattern: /v-html/, severity: 'high', message: 'Vue v-html directive' },
    { pattern: /\$\{.*\}.*<script/, severity: 'critical', message: 'Script injection risk' }
  ],
  
  // Sensitive data patterns
  secretPatterns: [
    { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/, severity: 'critical', message: 'API key detected' },
    { pattern: /password\s*[:=]\s*['"][^'"]+['"]/, severity: 'critical', message: 'Hardcoded password' },
    { pattern: /secret\s*[:=]\s*['"][^'"]+['"]/, severity: 'critical', message: 'Hardcoded secret' },
    { pattern: /token\s*[:=]\s*['"][^'"]+['"]/, severity: 'high', message: 'Hardcoded token' },
    { pattern: /private[_-]?key\s*[:=]/, severity: 'critical', message: 'Private key detected' }
  ],
  
  // Insecure protocols
  insecureProtocols: [
    { pattern: /http:\/\/(?!localhost|127\.0\.0\.1)/, severity: 'medium', message: 'HTTP protocol used' },
    { pattern: /ftp:\/\//, severity: 'high', message: 'FTP protocol detected' },
    { pattern: /telnet:\/\//, severity: 'high', message: 'Telnet protocol detected' }
  ]
};

/**
 * Security scanner for code validation
 */
class SecurityScanner extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableDependencyCheck: true,
      enableSecretScanning: true,
      enablePatternAnalysis: true,
      enableBestPractices: true,
      customRules: [],
      ignorePaths: ['node_modules', '.git', 'coverage', 'dist', 'build'],
      secretsWhitelist: [],
      ...config
    };
    
    this.findings = [];
    this.scannedFiles = 0;
    this.startTime = null;
  }

  /**
   * Scan a project for security issues
   */
  async scanProject(projectPath) {
    this.findings = [];
    this.scannedFiles = 0;
    this.startTime = Date.now();
    
    this.emit('scan:started', {
      projectPath,
      config: this.config
    });
    
    try {
      // Scan code patterns
      if (this.config.enablePatternAnalysis) {
        await this.scanCodePatterns(projectPath);
      }
      
      // Scan for secrets
      if (this.config.enableSecretScanning) {
        await this.scanForSecrets(projectPath);
      }
      
      // Check dependencies
      if (this.config.enableDependencyCheck) {
        await this.checkDependencies(projectPath);
      }
      
      // Validate best practices
      if (this.config.enableBestPractices) {
        await this.validateBestPractices(projectPath);
      }
      
      // Generate report
      const report = this.generateReport();
      
      this.emit('scan:completed', {
        duration: Date.now() - this.startTime,
        filesScanned: this.scannedFiles,
        findingsCount: this.findings.length,
        report
      });
      
      return report;
      
    } catch (error) {
      this.emit('error', {
        message: `Security scan failed: ${error.message}`,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Scan code for dangerous patterns
   */
  async scanCodePatterns(projectPath) {
    const files = await this.getFilesToScan(projectPath);
    
    for (const file of files) {
      if (this.shouldSkipFile(file)) continue;
      
      try {
        const content = await fs.readFile(file, 'utf8');
        this.scannedFiles++;
        
        // Check all security rules
        for (const [category, rules] of Object.entries(SECURITY_RULES)) {
          for (const rule of rules) {
            const matches = content.match(new RegExp(rule.pattern, 'gi'));
            if (matches) {
              this.addFinding({
                type: 'pattern',
                category,
                severity: rule.severity,
                file: path.relative(projectPath, file),
                message: rule.message,
                matches: matches.length,
                pattern: rule.pattern.toString()
              });
            }
          }
        }
        
        // Check custom rules
        for (const customRule of this.config.customRules) {
          const matches = content.match(new RegExp(customRule.pattern, 'gi'));
          if (matches) {
            this.addFinding({
              type: 'custom',
              severity: customRule.severity || 'medium',
              file: path.relative(projectPath, file),
              message: customRule.message,
              matches: matches.length
            });
          }
        }
        
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  /**
   * Scan for hardcoded secrets
   */
  async scanForSecrets(projectPath) {
    const files = await this.getFilesToScan(projectPath);
    
    for (const file of files) {
      if (this.shouldSkipFile(file)) continue;
      
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for high entropy strings (potential secrets)
        const highEntropyStrings = this.findHighEntropyStrings(content);
        
        for (const string of highEntropyStrings) {
          if (!this.isWhitelisted(string)) {
            this.addFinding({
              type: 'secret',
              severity: 'high',
              file: path.relative(projectPath, file),
              message: 'Potential secret detected (high entropy)',
              entropy: string.entropy
            });
          }
        }
        
        // Check for common secret patterns
        const lines = content.split('\n');
        lines.forEach((line, lineNum) => {
          // AWS keys
          if (/AKIA[0-9A-Z]{16}/.test(line)) {
            this.addFinding({
              type: 'secret',
              severity: 'critical',
              file: path.relative(projectPath, file),
              line: lineNum + 1,
              message: 'AWS access key detected'
            });
          }
          
          // Private keys
          if (/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(line)) {
            this.addFinding({
              type: 'secret',
              severity: 'critical',
              file: path.relative(projectPath, file),
              line: lineNum + 1,
              message: 'Private key detected'
            });
          }
        });
        
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  /**
   * Check dependencies for vulnerabilities
   */
  async checkDependencies(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      // Check for known vulnerable packages (simplified)
      const vulnerablePackages = {
        'event-stream': { severity: 'critical', message: 'Known malicious package' },
        'flatmap-stream': { severity: 'critical', message: 'Known malicious package' },
        'eslint-scope@3.7.2': { severity: 'high', message: 'Known vulnerable version' }
      };
      
      for (const [pkg, version] of Object.entries(allDeps)) {
        const pkgWithVersion = `${pkg}@${version}`;
        
        if (vulnerablePackages[pkg] || vulnerablePackages[pkgWithVersion]) {
          const vuln = vulnerablePackages[pkg] || vulnerablePackages[pkgWithVersion];
          this.addFinding({
            type: 'dependency',
            severity: vuln.severity,
            package: pkg,
            version,
            message: vuln.message
          });
        }
        
        // Check for git dependencies (security risk)
        if (version.includes('git')) {
          this.addFinding({
            type: 'dependency',
            severity: 'medium',
            package: pkg,
            version,
            message: 'Git dependency detected - potential security risk'
          });
        }
      }
      
    } catch (error) {
      // No package.json or can't read it
    }
  }

  /**
   * Validate security best practices
   */
  async validateBestPractices(projectPath) {
    // Check for .env in .gitignore
    await this.checkGitignore(projectPath);
    
    // Check for HTTPS in APIs
    await this.checkHTTPS(projectPath);
    
    // Check for proper error handling
    await this.checkErrorHandling(projectPath);
    
    // Check for input validation
    await this.checkInputValidation(projectPath);
    
    // Check for authentication
    await this.checkAuthentication(projectPath);
  }

  /**
   * Check if sensitive files are in .gitignore
   */
  async checkGitignore(projectPath) {
    const gitignorePath = path.join(projectPath, '.gitignore');
    
    try {
      const gitignore = await fs.readFile(gitignorePath, 'utf8');
      const requiredEntries = ['.env', '*.key', '*.pem', 'config/secrets'];
      
      for (const entry of requiredEntries) {
        if (!gitignore.includes(entry)) {
          this.addFinding({
            type: 'configuration',
            severity: 'high',
            file: '.gitignore',
            message: `Missing entry: ${entry}`
          });
        }
      }
    } catch (error) {
      this.addFinding({
        type: 'configuration',
        severity: 'high',
        message: 'Missing .gitignore file'
      });
    }
  }

  /**
   * Check for HTTPS usage
   */
  async checkHTTPS(projectPath) {
    const files = await this.getFilesToScan(projectPath, ['.js', '.ts', '.jsx', '.tsx']);
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for HTTP URLs in API calls
        const httpAPIs = content.match(/(?:fetch|axios|request)\s*\(\s*['"]http:\/\//gi);
        if (httpAPIs) {
          this.addFinding({
            type: 'protocol',
            severity: 'medium',
            file: path.relative(projectPath, file),
            message: 'HTTP protocol used in API calls',
            count: httpAPIs.length
          });
        }
      } catch (error) {
        // Skip
      }
    }
  }

  /**
   * Check for proper error handling
   */
  async checkErrorHandling(projectPath) {
    const files = await this.getFilesToScan(projectPath, ['.js', '.ts']);
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for empty catch blocks
        const emptyCatch = content.match(/catch\s*\([^)]*\)\s*{\s*}/g);
        if (emptyCatch) {
          this.addFinding({
            type: 'practice',
            severity: 'medium',
            file: path.relative(projectPath, file),
            message: 'Empty catch block detected',
            count: emptyCatch.length
          });
        }
        
        // Check for console.log in production code
        if (!file.includes('test') && !file.includes('spec')) {
          const consoleLogs = content.match(/console\.(log|error|warn)/g);
          if (consoleLogs) {
            this.addFinding({
              type: 'practice',
              severity: 'low',
              file: path.relative(projectPath, file),
              message: 'Console statements in production code',
              count: consoleLogs.length
            });
          }
        }
      } catch (error) {
        // Skip
      }
    }
  }

  /**
   * Check for input validation
   */
  async checkInputValidation(projectPath) {
    const files = await this.getFilesToScan(projectPath, ['.js', '.ts']);
    
    for (const file of files) {
      if (!file.includes('route') && !file.includes('api')) continue;
      
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for request body usage without validation
        if (content.includes('req.body') && !content.includes('validate')) {
          this.addFinding({
            type: 'validation',
            severity: 'high',
            file: path.relative(projectPath, file),
            message: 'Request body used without validation'
          });
        }
        
        // Check for SQL queries without parameterization
        if (content.includes('query') && content.includes('+')) {
          this.addFinding({
            type: 'validation',
            severity: 'critical',
            file: path.relative(projectPath, file),
            message: 'Potential SQL injection - use parameterized queries'
          });
        }
      } catch (error) {
        // Skip
      }
    }
  }

  /**
   * Check for authentication
   */
  async checkAuthentication(projectPath) {
    const files = await this.getFilesToScan(projectPath, ['.js', '.ts']);
    
    for (const file of files) {
      if (!file.includes('route') && !file.includes('api')) continue;
      
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for routes without authentication
        const routes = content.match(/app\.(get|post|put|delete|patch)\s*\(/g);
        const authChecks = content.match(/(?:auth|authenticate|requireAuth|isAuthenticated)/gi);
        
        if (routes && routes.length > 0) {
          const authRatio = (authChecks?.length || 0) / routes.length;
          
          if (authRatio < 0.5) {
            this.addFinding({
              type: 'authentication',
              severity: 'medium',
              file: path.relative(projectPath, file),
              message: 'Many routes without authentication checks',
              routes: routes.length,
              authChecks: authChecks?.length || 0
            });
          }
        }
      } catch (error) {
        // Skip
      }
    }
  }

  /**
   * Calculate string entropy
   */
  calculateEntropy(str) {
    const freq = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const len = str.length;
    
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  /**
   * Find high entropy strings
   */
  findHighEntropyStrings(content) {
    const strings = content.match(/['"][^'"]{20,}['"]/g) || [];
    const highEntropyStrings = [];
    
    for (const str of strings) {
      const cleaned = str.slice(1, -1); // Remove quotes
      const entropy = this.calculateEntropy(cleaned);
      
      if (entropy > 4.5) { // High entropy threshold
        highEntropyStrings.push({
          string: cleaned.substring(0, 20) + '...',
          entropy: entropy.toFixed(2)
        });
      }
    }
    
    return highEntropyStrings;
  }

  /**
   * Check if string is whitelisted
   */
  isWhitelisted(str) {
    return this.config.secretsWhitelist.some(pattern => 
      str.string.includes(pattern)
    );
  }

  /**
   * Get files to scan
   */
  async getFilesToScan(projectPath, extensions = ['.js', '.ts', '.jsx', '.tsx', '.json', '.env']) {
    const files = [];
    
    async function walk(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    }
    
    await walk(projectPath);
    return files;
  }

  /**
   * Check if file should be skipped
   */
  shouldSkipFile(file) {
    return this.config.ignorePaths.some(ignorePath => 
      file.includes(ignorePath)
    );
  }

  /**
   * Add finding
   */
  addFinding(finding) {
    this.findings.push({
      ...finding,
      timestamp: Date.now()
    });
    
    this.emit('finding', finding);
  }

  /**
   * Generate security report
   */
  generateReport() {
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    const typeCounts = {};
    
    for (const finding of this.findings) {
      severityCounts[finding.severity]++;
      typeCounts[finding.type] = (typeCounts[finding.type] || 0) + 1;
    }
    
    return {
      summary: {
        totalFindings: this.findings.length,
        critical: severityCounts.critical,
        high: severityCounts.high,
        medium: severityCounts.medium,
        low: severityCounts.low,
        filesScanned: this.scannedFiles,
        duration: Date.now() - this.startTime
      },
      byType: typeCounts,
      findings: this.findings.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.findings.some(f => f.type === 'secret')) {
      recommendations.push({
        priority: 'high',
        message: 'Remove all hardcoded secrets and use environment variables'
      });
    }
    
    if (this.findings.some(f => f.type === 'dependency')) {
      recommendations.push({
        priority: 'high',
        message: 'Update vulnerable dependencies and use npm audit regularly'
      });
    }
    
    if (this.findings.some(f => f.category === 'sqlInjection')) {
      recommendations.push({
        priority: 'critical',
        message: 'Use parameterized queries to prevent SQL injection'
      });
    }
    
    if (this.findings.some(f => f.type === 'authentication')) {
      recommendations.push({
        priority: 'medium',
        message: 'Implement proper authentication middleware for all routes'
      });
    }
    
    return recommendations;
  }
}

export { SecurityScanner };
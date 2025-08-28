/**
 * GitSecurityManager - Security and audit features for Git integration
 * 
 * Provides comprehensive security validation, token management,
 * permission checking, and audit logging for Git operations.
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

class GitSecurityManager extends EventEmitter {
  constructor(resourceManager, config = {}) {
    super();
    
    this.resourceManager = resourceManager;
    this.config = {
      enableTokenValidation: config.enableTokenValidation !== false,
      enablePermissionChecking: config.enablePermissionChecking !== false,
      enableAuditLogging: config.enableAuditLogging !== false,
      enableEncryption: config.enableEncryption !== false,
      tokenRefreshThreshold: config.tokenRefreshThreshold || 3600000, // 1 hour
      maxTokenAge: config.maxTokenAge || 86400000, // 24 hours
      allowedOperations: config.allowedOperations || [],
      blockedOperations: config.blockedOperations || [],
      sensitivePatterns: config.sensitivePatterns || [],
      auditRetentionDays: config.auditRetentionDays || 90,
      ...config
    };
    
    // Security state
    this.tokenInfo = null;
    this.permissions = new Map();
    this.auditLog = [];
    this.encryptionKey = null;
    
    // Default sensitive patterns
    this.defaultSensitivePatterns = [
      /password\s*[:=]\s*["'].*["']/gi,
      /api[_-]?key\s*[:=]\s*["'].*["']/gi,
      /secret\s*[:=]\s*["'].*["']/gi,
      /token\s*[:=]\s*["'].*["']/gi,
      /private[_-]?key/gi,
      /-----BEGIN.*PRIVATE KEY-----/gi,
      /ghp_[a-zA-Z0-9]{36}/gi, // GitHub Personal Access Token
      /ghs_[a-zA-Z0-9]{36}/gi, // GitHub App Installation Token
      /ghu_[a-zA-Z0-9]{36}/gi, // GitHub App User-to-Server Token
    ];
    
    // Audit event types
    this.auditEventTypes = {
      TOKEN_VALIDATION: 'token-validation',
      PERMISSION_CHECK: 'permission-check',
      OPERATION_BLOCKED: 'operation-blocked',
      SENSITIVE_DATA_DETECTED: 'sensitive-data-detected',
      SECURITY_VIOLATION: 'security-violation',
      TOKEN_REFRESH: 'token-refresh',
      ENCRYPTION_OPERATION: 'encryption-operation'
    };
    
    this.initialized = false;
  }
  
  /**
   * Initialize the security manager
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    try {
      // Initialize encryption key if encryption is enabled
      if (this.config.enableEncryption) {
        await this.initializeEncryption();
      }
      
      // Validate GitHub token
      if (this.config.enableTokenValidation) {
        await this.validateGitHubToken();
      }
      
      // Load permissions
      if (this.config.enablePermissionChecking) {
        await this.loadPermissions();
      }
      
      this.initialized = true;
      
      this.emit('initialized', {
        tokenValidation: this.config.enableTokenValidation,
        permissionChecking: this.config.enablePermissionChecking,
        auditLogging: this.config.enableAuditLogging,
        encryption: this.config.enableEncryption,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      this.emit('initialization-failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
  
  /**
   * Validate GitHub token
   */
  async validateGitHubToken() {
    const token = this.resourceManager.GITHUB_PAT;
    
    if (!token) {
      throw new Error('GitHub token not found in resource manager');
    }
    
    // Basic token format validation
    if (!this.isValidTokenFormat(token)) {
      this.auditLog.push({
        type: this.auditEventTypes.TOKEN_VALIDATION,
        result: 'invalid-format',
        timestamp: new Date().toISOString()
      });
      throw new Error('Invalid GitHub token format');
    }
    
    try {
      // Validate token with GitHub API
      const tokenInfo = await this.validateTokenWithGitHub(token);
      
      this.tokenInfo = {
        ...tokenInfo,
        lastValidated: new Date(),
        expiresAt: tokenInfo.expires_at ? new Date(tokenInfo.expires_at) : null
      };
      
      this.auditLog.push({
        type: this.auditEventTypes.TOKEN_VALIDATION,
        result: 'valid',
        scopes: tokenInfo.scopes,
        expiresAt: this.tokenInfo.expiresAt,
        timestamp: new Date().toISOString()
      });
      
      return this.tokenInfo;
      
    } catch (error) {
      this.auditLog.push({
        type: this.auditEventTypes.TOKEN_VALIDATION,
        result: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
  
  /**
   * Check if token format is valid
   */
  isValidTokenFormat(token) {
    // GitHub Personal Access Token format
    const ghpPattern = /^ghp_[a-zA-Z0-9]{36}$/;
    // GitHub App Installation Token format
    const ghsPattern = /^ghs_[a-zA-Z0-9]{36}$/;
    // GitHub App User-to-Server Token format
    const ghuPattern = /^ghu_[a-zA-Z0-9]{36}$/;
    
    return ghpPattern.test(token) || ghsPattern.test(token) || ghuPattern.test(token);
  }
  
  /**
   * Validate token with GitHub API
   */
  async validateTokenWithGitHub(token) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'CodeAgent-Security/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API validation failed: ${response.status} ${response.statusText}`);
    }
    
    const userData = await response.json();
    
    // Get token scopes from headers
    const scopes = response.headers.get('x-oauth-scopes')?.split(', ') || [];
    
    return {
      user: userData.login,
      scopes,
      app_id: response.headers.get('x-github-app-id'),
      installation_id: response.headers.get('x-github-installation-id'),
      expires_at: response.headers.get('github-authentication-token-expiration')
    };
  }
  
  /**
   * Check if token needs refresh
   */
  shouldRefreshToken() {
    if (!this.tokenInfo || !this.tokenInfo.lastValidated) {
      return true;
    }
    
    const timeSinceValidation = Date.now() - this.tokenInfo.lastValidated.getTime();
    
    if (timeSinceValidation > this.config.tokenRefreshThreshold) {
      return true;
    }
    
    if (this.tokenInfo.expiresAt) {
      const timeUntilExpiration = this.tokenInfo.expiresAt.getTime() - Date.now();
      return timeUntilExpiration < this.config.tokenRefreshThreshold;
    }
    
    return false;
  }
  
  /**
   * Load permissions for the current user
   */
  async loadPermissions() {
    if (!this.tokenInfo) {
      await this.validateGitHubToken();
    }
    
    const organization = this.resourceManager.GITHUB_AGENT_ORG || 'AgentResults';
    
    try {
      const permissions = await this.getOrganizationPermissions(organization);
      
      this.permissions.set('organization', permissions);
      
      this.auditLog.push({
        type: this.auditEventTypes.PERMISSION_CHECK,
        result: 'loaded',
        organization,
        permissions: Object.keys(permissions),
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      this.auditLog.push({
        type: this.auditEventTypes.PERMISSION_CHECK,
        result: 'failed',
        organization,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
  
  /**
   * Get organization permissions
   */
  async getOrganizationPermissions(organization) {
    const fetch = (await import('node-fetch')).default;
    const token = this.resourceManager.GITHUB_PAT;
    
    const response = await fetch(`https://api.github.com/orgs/${organization}/members/${this.tokenInfo.user}`, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'CodeAgent-Security/1.0'
      }
    });
    
    if (response.status === 404) {
      // User is not a member of the organization
      return {
        member: false,
        admin: false,
        canCreateRepos: false,
        canDeleteRepos: false
      };
    }
    
    if (!response.ok) {
      throw new Error(`Failed to check organization membership: ${response.status}`);
    }
    
    // Check if user is an admin
    const adminResponse = await fetch(`https://api.github.com/orgs/${organization}/memberships/${this.tokenInfo.user}`, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'CodeAgent-Security/1.0'
      }
    });
    
    let isAdmin = false;
    if (adminResponse.ok) {
      const membershipData = await adminResponse.json();
      isAdmin = membershipData.role === 'admin';
    }
    
    return {
      member: true,
      admin: isAdmin,
      canCreateRepos: true, // Members can typically create repos
      canDeleteRepos: isAdmin // Only admins can delete repos
    };
  }
  
  /**
   * Check if operation is allowed
   */
  async checkOperationPermission(operation, context = {}) {
    if (!this.config.enablePermissionChecking) {
      return { allowed: true, reason: 'permission-checking-disabled' };
    }
    
    // Check if operation is explicitly blocked
    if (this.config.blockedOperations.includes(operation)) {
      this.auditLog.push({
        type: this.auditEventTypes.OPERATION_BLOCKED,
        operation,
        reason: 'explicitly-blocked',
        context,
        timestamp: new Date().toISOString()
      });
      
      return { allowed: false, reason: 'operation-blocked' };
    }
    
    // Check if operation is in allowed list (if specified)
    if (this.config.allowedOperations.length > 0 && 
        !this.config.allowedOperations.includes(operation)) {
      this.auditLog.push({
        type: this.auditEventTypes.OPERATION_BLOCKED,
        operation,
        reason: 'not-in-allowed-list',
        context,
        timestamp: new Date().toISOString()
      });
      
      return { allowed: false, reason: 'operation-not-allowed' };
    }
    
    // Check specific operation permissions
    const permissionCheck = await this.checkSpecificPermission(operation, context);
    
    if (!permissionCheck.allowed) {
      this.auditLog.push({
        type: this.auditEventTypes.OPERATION_BLOCKED,
        operation,
        reason: permissionCheck.reason,
        context,
        timestamp: new Date().toISOString()
      });
    }
    
    return permissionCheck;
  }
  
  /**
   * Check specific operation permissions
   */
  async checkSpecificPermission(operation, context) {
    const orgPermissions = this.permissions.get('organization');
    
    if (!orgPermissions) {
      return { allowed: false, reason: 'permissions-not-loaded' };
    }
    
    switch (operation) {
      case 'create-repository':
        return {
          allowed: orgPermissions.canCreateRepos,
          reason: orgPermissions.canCreateRepos ? 'permission-granted' : 'insufficient-permissions'
        };
        
      case 'delete-repository':
        return {
          allowed: orgPermissions.canDeleteRepos,
          reason: orgPermissions.canDeleteRepos ? 'permission-granted' : 'admin-required'
        };
        
      case 'push-to-main':
        // Additional check for pushing to main branch
        return {
          allowed: orgPermissions.member && (context.branchProtection !== 'strict'),
          reason: orgPermissions.member ? 'permission-granted' : 'organization-member-required'
        };
        
      default:
        return {
          allowed: orgPermissions.member,
          reason: orgPermissions.member ? 'permission-granted' : 'organization-member-required'
        };
    }
  }
  
  /**
   * Scan content for sensitive data
   */
  scanForSensitiveData(content, filename = 'unknown') {
    const allPatterns = [...this.defaultSensitivePatterns, ...this.config.sensitivePatterns];
    const violations = [];
    
    for (const pattern of allPatterns) {
      const matches = content.matchAll(pattern);
      
      for (const match of matches) {
        violations.push({
          pattern: pattern.source,
          match: match[0].substring(0, 50) + '...', // Truncate for security
          line: this.getLineNumber(content, match.index),
          column: this.getColumnNumber(content, match.index),
          severity: this.getSeverityForPattern(pattern)
        });
      }
    }
    
    if (violations.length > 0) {
      this.auditLog.push({
        type: this.auditEventTypes.SENSITIVE_DATA_DETECTED,
        filename,
        violations: violations.map(v => ({
          pattern: v.pattern,
          line: v.line,
          severity: v.severity
        })),
        timestamp: new Date().toISOString()
      });
      
      this.emit('sensitive-data-detected', {
        filename,
        violations,
        timestamp: new Date().toISOString()
      });
    }
    
    return violations;
  }
  
  /**
   * Initialize encryption
   */
  async initializeEncryption() {
    this.encryptionKey = crypto.randomBytes(32);
    
    this.auditLog.push({
      type: this.auditEventTypes.ENCRYPTION_OPERATION,
      operation: 'key-generated',
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Encrypt sensitive data
   */
  encrypt(data) {
    if (!this.config.enableEncryption || !this.encryptionKey) {
      return data;
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    cipher.setAAD(Buffer.from('CodeAgent-Security'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData) {
    if (!this.config.enableEncryption || !this.encryptionKey) {
      return encryptedData;
    }
    
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAAD(Buffer.from('CodeAgent-Security'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * Get security audit log
   */
  getAuditLog(filters = {}) {
    let log = [...this.auditLog];
    
    if (filters.type) {
      log = log.filter(entry => entry.type === filters.type);
    }
    
    if (filters.since) {
      const sinceDate = new Date(filters.since);
      log = log.filter(entry => new Date(entry.timestamp) >= sinceDate);
    }
    
    if (filters.limit) {
      log = log.slice(-filters.limit);
    }
    
    return log;
  }
  
  /**
   * Generate security report
   */
  generateSecurityReport() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentAuditLog = this.auditLog.filter(entry => 
      new Date(entry.timestamp) >= dayAgo
    );
    
    const eventCounts = {};
    for (const entry of recentAuditLog) {
      eventCounts[entry.type] = (eventCounts[entry.type] || 0) + 1;
    }
    
    const securityViolations = recentAuditLog.filter(entry => 
      [this.auditEventTypes.OPERATION_BLOCKED, 
       this.auditEventTypes.SENSITIVE_DATA_DETECTED,
       this.auditEventTypes.SECURITY_VIOLATION].includes(entry.type)
    );
    
    return {
      reportGeneratedAt: now.toISOString(),
      period: {
        start: dayAgo.toISOString(),
        end: now.toISOString()
      },
      tokenInfo: this.tokenInfo ? {
        user: this.tokenInfo.user,
        lastValidated: this.tokenInfo.lastValidated,
        scopes: this.tokenInfo.scopes,
        needsRefresh: this.shouldRefreshToken()
      } : null,
      permissions: Object.fromEntries(this.permissions),
      auditSummary: {
        totalEvents: recentAuditLog.length,
        eventCounts,
        securityViolations: securityViolations.length
      },
      securityViolations: securityViolations.map(violation => ({
        type: violation.type,
        timestamp: violation.timestamp,
        details: violation.operation || violation.filename || 'unknown'
      })),
      recommendations: this.generateSecurityRecommendations()
    };
  }
  
  /**
   * Generate security recommendations
   */
  generateSecurityRecommendations() {
    const recommendations = [];
    
    if (this.shouldRefreshToken()) {
      recommendations.push({
        type: 'token-refresh',
        priority: 'high',
        message: 'GitHub token should be refreshed'
      });
    }
    
    if (!this.config.enableEncryption) {
      recommendations.push({
        type: 'encryption',
        priority: 'medium',
        message: 'Consider enabling encryption for sensitive data'
      });
    }
    
    const recentViolations = this.auditLog.filter(entry => 
      entry.type === this.auditEventTypes.SENSITIVE_DATA_DETECTED &&
      new Date(entry.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    
    if (recentViolations.length > 0) {
      recommendations.push({
        type: 'sensitive-data',
        priority: 'high',
        message: `${recentViolations.length} sensitive data violations detected in the last 7 days`
      });
    }
    
    return recommendations;
  }
  
  // Utility methods
  
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }
  
  getColumnNumber(content, index) {
    const lines = content.substring(0, index).split('\n');
    return lines[lines.length - 1].length + 1;
  }
  
  getSeverityForPattern(pattern) {
    const patternStr = pattern.source.toLowerCase();
    
    if (patternStr.includes('private') || patternStr.includes('secret')) {
      return 'critical';
    }
    
    if (patternStr.includes('password') || patternStr.includes('token')) {
      return 'high';
    }
    
    return 'medium';
  }
  
  /**
   * Clean up old audit logs
   */
  cleanupAuditLog() {
    const cutoffDate = new Date(Date.now() - this.config.auditRetentionDays * 24 * 60 * 60 * 1000);
    
    const initialLength = this.auditLog.length;
    this.auditLog = this.auditLog.filter(entry => 
      new Date(entry.timestamp) >= cutoffDate
    );
    
    const removed = initialLength - this.auditLog.length;
    
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} old audit log entries`);
    }
  }
  
  /**
   * Cleanup security manager
   */
  async cleanup() {
    this.cleanupAuditLog();
    this.removeAllListeners();
    
    if (this.encryptionKey) {
      this.encryptionKey.fill(0); // Clear encryption key from memory
      this.encryptionKey = null;
    }
  }
}

export default GitSecurityManager;
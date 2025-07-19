/**
 * GitHubAuthentication - Handles GitHub authentication and token management
 * 
 * Provides authentication, token validation, and GitHub API access
 * using the Resource Manager pattern for configuration access.
 */

import https from 'https';

class GitHubAuthentication {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.token = null;
    this.userInfo = null;
    this.rateLimitInfo = null;
  }
  
  /**
   * Initialize GitHub authentication
   * Loads and validates the GitHub token
   */
  async initialize() {
    // Get token from Resource Manager
    try {
      this.token = this.resourceManager.get('GITHUB_PAT');
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new Error('GitHub PAT not found in environment variables');
      }
      throw error;
    }
    
    if (!this.token) {
      throw new Error('GitHub PAT not found in environment variables');
    }
    
    // Validate token format
    if (!this.token.startsWith('ghp_') && !this.token.startsWith('github_pat_')) {
      throw new Error('Invalid GitHub PAT format');
    }
  }
  
  /**
   * Validate the GitHub token with GitHub API
   * @returns {boolean} True if token is valid
   */
  async validateToken() {
    try {
      const response = await this.makeAuthenticatedRequest('/user');
      return response.statusCode === 200;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get user information from GitHub API
   * @returns {Object} User information
   */
  async getUserInfo() {
    if (this.userInfo) {
      return this.userInfo;
    }
    
    const response = await this.makeAuthenticatedRequest('/user');
    
    if (response.statusCode !== 200) {
      throw new Error(`Failed to get user info: ${response.statusCode}`);
    }
    
    this.userInfo = JSON.parse(response.data);
    return this.userInfo;
  }
  
  /**
   * Verify access to a GitHub organization
   * @param {string} orgName - Organization name
   * @returns {boolean} True if user has access to organization
   */
  async verifyOrganizationAccess(orgName) {
    try {
      const response = await this.makeAuthenticatedRequest(`/orgs/${orgName}/members`);
      return response.statusCode === 200;
    } catch (error) {
      // If we can't access the members list, try to check if org exists
      try {
        const orgResponse = await this.makeAuthenticatedRequest(`/orgs/${orgName}`);
        return orgResponse.statusCode === 200;
      } catch (orgError) {
        return false;
      }
    }
  }
  
  /**
   * Get authentication headers for GitHub API requests
   * @returns {Object} Headers object
   */
  getAuthHeaders() {
    if (!this.token) {
      throw new Error('GitHub authentication not initialized');
    }
    
    return {
      'Authorization': `token ${this.token}`,
      'User-Agent': 'jsenvoy-code-agent',
      'Accept': 'application/vnd.github.v3+json'
    };
  }
  
  /**
   * Get current rate limit information
   * @returns {Object} Rate limit information
   */
  async getRateLimitInfo() {
    const response = await this.makeAuthenticatedRequest('/rate_limit');
    
    if (response.statusCode !== 200) {
      throw new Error(`Failed to get rate limit info: ${response.statusCode}`);
    }
    
    const data = JSON.parse(response.data);
    this.rateLimitInfo = data.rate;
    return this.rateLimitInfo;
  }
  
  /**
   * Make an authenticated request to GitHub API
   * @param {string} path - API path
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @returns {Promise<Object>} Response object
   */
  async makeAuthenticatedRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: path,
        method: method,
        headers: this.getAuthHeaders()
      };
      
      if (data) {
        const jsonData = JSON.stringify(data);
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = jsonData.length;
      }
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }
  
  /**
   * Check if authentication is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this.token !== null;
  }
  
  /**
   * Get the current token (for debugging - don't log this)
   * @returns {string} Masked token
   */
  getMaskedToken() {
    if (!this.token) return null;
    return `${this.token.substring(0, 7)}...${this.token.substring(this.token.length - 4)}`;
  }
}

export default GitHubAuthentication;
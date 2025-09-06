import { NetworkError, AuthenticationError, ValidationError } from './StorageError.js';

/**
 * GitHub API client for repository operations
 * Handles authentication, rate limiting, and error recovery
 */
export class GitHubClient {
  constructor(options = {}) {
    this.token = options.token || process.env.GITHUB_TOKEN;
    this.baseUrl = options.baseUrl || 'https://api.github.com';
    this.userAgent = options.userAgent || 'KnowledgeGraph-Storage/1.0';
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    // Rate limiting
    this.rateLimit = {
      remaining: 5000,
      reset: Date.now() + 3600000, // 1 hour from now
      used: 0
    };
    
    this._validateConfig();
  }

  /**
   * Validate client configuration
   */
  _validateConfig() {
    if (!this.token) {
      throw new AuthenticationError('GitHub token is required');
    }
    
    if (!this.token.startsWith('ghp_') && !this.token.startsWith('github_pat_')) {
      console.warn('GitHub token format may be invalid. Expected format: ghp_* or github_pat_*');
    }
  }

  /**
   * Make authenticated request to GitHub API
   */
  async request(method, path, data = null, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': this.userAgent,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const requestOptions = {
      method,
      headers,
      ...options
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestOptions.body = JSON.stringify(data);
    }

    // Check rate limit before making request
    await this._checkRateLimit();

    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        requestOptions.signal = controller.signal;
        
        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);
        
        // Update rate limit info from headers
        if (response && response.headers) {
          this._updateRateLimit(response.headers);
        }
        
        if (!response.ok) {
          await this._handleErrorResponse(response);
        }
        
        // Return response for different content types
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return await response.json();
        } else {
          return await response.text();
        }
        
      } catch (error) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          lastError = new NetworkError(`Request timeout after ${this.timeout}ms`);
        }
        
        // Don't retry on authentication errors
        if (error instanceof AuthenticationError) {
          throw error;
        }
        
        // Don't retry on validation errors
        if (error instanceof ValidationError) {
          throw error;
        }
        
        // Retry on network errors with exponential backoff
        if (attempt < this.retries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this._sleep(delay);
          continue;
        }
      }
    }
    
    throw lastError || new NetworkError('Request failed after all retries');
  }

  /**
   * Get file content from repository
   */
  async getFile(owner, repo, path, ref = 'main') {
    try {
      const response = await this.request('GET', `/repos/${owner}/${repo}/contents/${path}`, null, {
        headers: { 'Accept': 'application/vnd.github.v3.raw' }
      });
      
      return {
        content: response,
        sha: null // Raw content doesn't include SHA
      };
    } catch (error) {
      if (error.status === 404) {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  /**
   * Get file metadata (including SHA)
   */
  async getFileMetadata(owner, repo, path, ref = 'main') {
    try {
      const response = await this.request('GET', `/repos/${owner}/${repo}/contents/${path}`, null, {
        params: { ref }
      });
      
      return {
        sha: response.sha,
        size: response.size,
        downloadUrl: response.download_url
      };
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create or update file in repository
   */
  async putFile(owner, repo, path, content, message, sha = null, branch = 'main') {
    const data = {
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch
    };
    
    if (sha) {
      data.sha = sha;
    }
    
    const response = await this.request('PUT', `/repos/${owner}/${repo}/contents/${path}`, data);
    
    return {
      sha: response.content.sha,
      commit: response.commit
    };
  }

  /**
   * Delete file from repository
   */
  async deleteFile(owner, repo, path, message, sha, branch = 'main') {
    const data = {
      message,
      sha,
      branch
    };
    
    const response = await this.request('DELETE', `/repos/${owner}/${repo}/contents/${path}`, data);
    
    return {
      commit: response.commit
    };
  }

  /**
   * Get repository information
   */
  async getRepository(owner, repo) {
    return await this.request('GET', `/repos/${owner}/${repo}`);
  }

  /**
   * List branches in repository
   */
  async getBranches(owner, repo) {
    return await this.request('GET', `/repos/${owner}/${repo}/branches`);
  }

  /**
   * Create a new branch
   */
  async createBranch(owner, repo, branchName, fromBranch = 'main') {
    // Get the SHA of the source branch
    const refResponse = await this.request('GET', `/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`);
    const sha = refResponse.object.sha;
    
    // Create new branch
    const data = {
      ref: `refs/heads/${branchName}`,
      sha
    };
    
    return await this.request('POST', `/repos/${owner}/${repo}/git/refs`, data);
  }

  /**
   * Get current rate limit status
   */
  async getRateLimit() {
    const response = await this.request('GET', '/rate_limit');
    this.rateLimit = {
      remaining: response.rate.remaining,
      reset: response.rate.reset * 1000, // Convert to milliseconds
      used: response.rate.used
    };
    return this.rateLimit;
  }

  /**
   * Check if we're approaching rate limit and wait if necessary
   */
  async _checkRateLimit() {
    if (this.rateLimit.remaining <= 10) {
      const waitTime = this.rateLimit.reset - Date.now();
      if (waitTime > 0) {
        console.warn(`GitHub rate limit nearly exceeded. Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await this._sleep(waitTime);
        // Refresh rate limit after waiting
        await this.getRateLimit();
      }
    }
  }

  /**
   * Update rate limit info from response headers
   */
  _updateRateLimit(headers) {
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    const used = headers.get('x-ratelimit-used');
    
    if (remaining !== null) {
      this.rateLimit.remaining = parseInt(remaining, 10);
    }
    if (reset !== null) {
      this.rateLimit.reset = parseInt(reset, 10) * 1000; // Convert to milliseconds
    }
    if (used !== null) {
      this.rateLimit.used = parseInt(used, 10);
    }
  }

  /**
   * Handle error responses from GitHub API
   */
  async _handleErrorResponse(response) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }
    
    const error = new Error(errorData.message || 'GitHub API error');
    error.status = response.status;
    error.response = errorData;
    
    switch (response.status) {
      case 401:
        throw new AuthenticationError(`GitHub authentication failed: ${errorData.message}`);
      case 403:
        if (errorData.message && errorData.message.includes('rate limit')) {
          // Update rate limit and throw network error for retry
          this._updateRateLimit(response.headers);
          throw new NetworkError(`GitHub rate limit exceeded: ${errorData.message}`);
        }
        throw new AuthenticationError(`GitHub access forbidden: ${errorData.message}`);
      case 404:
        throw new ValidationError(`GitHub resource not found: ${errorData.message}`);
      case 422:
        throw new ValidationError(`GitHub validation error: ${errorData.message}`);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new NetworkError(`GitHub server error (${response.status}): ${errorData.message}`);
      default:
        throw new NetworkError(`GitHub API error (${response.status}): ${errorData.message}`);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get client metadata
   */
  getMetadata() {
    return {
      type: 'github-client',
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      retries: this.retries,
      rateLimit: { ...this.rateLimit },
      hasToken: !!this.token
    };
  }
}

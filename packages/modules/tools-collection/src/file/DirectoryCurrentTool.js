import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for getting the current working directory
 */
class DirectoryCurrentTool extends Tool {
  constructor({ basePath }) {
    if (!basePath) {
      throw new Error('basePath is required');
    }
    
    super({
      name: 'directory_current',
      shortName: 'pwd',
      description: 'Returns the current working directory',
      schema: {
        input: {
          type: 'object',
          properties: {
            relative: {
              type: 'boolean',
              description: 'Whether to return path relative to base path (default: false)',
              default: false
            },
            includeMetadata: {
              type: 'boolean',
              description: 'Whether to include directory metadata (default: false)',
              default: false
            },
            analyzeComponents: {
              type: 'boolean',
              description: 'Whether to analyze path components (default: false)',
              default: false
            },
            calculateDepth: {
              type: 'boolean',
              description: 'Whether to calculate depth from base path (default: false)',
              default: false
            },
            detectType: {
              type: 'boolean',
              description: 'Whether to detect directory type/purpose (default: false)',
              default: false
            },
            format: {
              type: 'string',
              enum: ['unix', 'windows', 'native'],
              description: 'Path format to use (default: native)',
              default: 'native'
            },
            checkPermissions: {
              type: 'boolean',
              description: 'Whether to check directory permissions (default: false)',
              default: false
            },
            validateExists: {
              type: 'boolean',
              description: 'Whether to validate directory still exists (default: false)',
              default: false
            }
          }
        },
        output: {
          type: 'object',
          properties: {
            currentPath: {
              type: 'string',
              description: 'The current working directory path'
            },
            basePath: {
              type: 'string',
              description: 'The base path (when relative=true)'
            },
            relativePath: {
              type: 'string',
              description: 'Path relative to base (when relative=true)'
            },
            formattedPath: {
              type: 'string',
              description: 'Formatted path (when format specified)'
            },
            metadata: {
              type: 'object',
              description: 'Directory metadata (when includeMetadata=true)'
            },
            components: {
              type: 'array',
              items: { type: 'string' },
              description: 'Path components (when analyzeComponents=true)'
            },
            depth: {
              type: 'number',
              description: 'Depth from base path (when calculateDepth=true)'
            },
            directoryType: {
              type: 'string',
              description: 'Detected directory type (when detectType=true)'
            },
            indicators: {
              type: 'array',
              items: { type: 'string' },
              description: 'Type indicators found (when detectType=true)'
            },
            permissions: {
              type: 'object',
              description: 'Directory permissions (when checkPermissions=true)'
            },
            exists: {
              type: 'boolean',
              description: 'Whether directory exists (when validateExists=true)'
            }
          },
          required: ['currentPath']
        }
      }
    });

    this.basePath = basePath;
  }

  /**
   * Execute the directory current tool
   * @param {Object} args - The arguments for getting current directory
   * @returns {Promise<Object>} The result containing current directory information
   */
  async execute(args = {}) {
    try {
      const {
        relative = false,
        includeMetadata = false,
        analyzeComponents = false,
        calculateDepth = false,
        detectType = false,
        format = 'native',
        checkPermissions = false,
        validateExists = false
      } = args;

      const currentPath = process.cwd();
      const result = { currentPath };

      // Add relative path information
      if (relative) {
        result.basePath = this.basePath;
        // Resolve symlinks to handle /private prefix issues on macOS
        const realBase = await fs.realpath(this.basePath);
        const realCurrent = await fs.realpath(currentPath);
        result.relativePath = path.relative(realBase, realCurrent) || '.';
      }

      // Format path according to requested format
      if (format !== 'native') {
        result.formattedPath = this.formatPath(currentPath, format);
      }

      // Include directory metadata
      if (includeMetadata) {
        result.metadata = await this.getDirectoryMetadata(currentPath);
      }

      // Analyze path components
      if (analyzeComponents) {
        result.components = this.analyzePathComponents(currentPath);
      }

      // Calculate depth from base path
      if (calculateDepth) {
        result.depth = await this.calculateDepthFromBase(currentPath);
      }

      // Detect directory type/purpose
      if (detectType) {
        const typeInfo = await this.detectDirectoryType(currentPath);
        result.directoryType = typeInfo.type;
        result.indicators = typeInfo.indicators;
      }

      // Check permissions
      if (checkPermissions) {
        result.permissions = await this.checkDirectoryPermissions(currentPath);
      }

      // Validate existence
      if (validateExists) {
        result.exists = await this.validateDirectoryExists(currentPath);
      }

      return result;
    } catch (error) {
      throw new Error(error.message || 'Failed to get current directory', {
        cause: {
          errorType: 'current_error',
          details: error.stack
        }
      });
    }
  }

  /**
   * Format path according to specified format
   * @param {string} pathStr - The path to format
   * @param {string} format - The format to use
   * @returns {string} The formatted path
   */
  formatPath(pathStr, format) {
    switch (format) {
      case 'unix':
        return pathStr.replace(/\\/g, '/');
      case 'windows':
        return pathStr.replace(/\//g, '\\');
      default:
        return pathStr;
    }
  }

  /**
   * Get directory metadata
   * @param {string} dirPath - The directory path
   * @returns {Promise<Object>} Directory metadata
   */
  async getDirectoryMetadata(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return {
        exists: true,
        readable: true, // We can access it
        writable: await this.isWritable(dirPath),
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString()
      };
    } catch (error) {
      return {
        exists: false,
        readable: false,
        writable: false,
        error: error.message
      };
    }
  }

  /**
   * Check if directory is writable
   * @param {string} dirPath - The directory path
   * @returns {Promise<boolean>} True if writable
   */
  async isWritable(dirPath) {
    try {
      await fs.access(dirPath, fs.constants.W_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Analyze path components
   * @param {string} pathStr - The path to analyze
   * @returns {Array<string>} Array of path components
   */
  analyzePathComponents(pathStr) {
    const normalized = path.normalize(pathStr);
    return normalized.split(path.sep).filter(component => component !== '');
  }

  /**
   * Calculate depth from base path
   * @param {string} currentPath - The current path
   * @returns {number} Depth from base path
   */
  async calculateDepthFromBase(currentPath) {
    // Resolve symlinks to handle /private prefix issues on macOS
    const realBase = await fs.realpath(this.basePath);
    const realCurrent = await fs.realpath(currentPath);
    const relativePath = path.relative(realBase, realCurrent);
    if (relativePath === '' || relativePath === '.') return 0;
    return relativePath.split(path.sep).length;
  }

  /**
   * Detect directory type based on contents
   * @param {string} dirPath - The directory path
   * @returns {Promise<Object>} Directory type information
   */
  async detectDirectoryType(dirPath) {
    const indicators = [];
    let type = 'unknown';

    try {
      const entries = await fs.readdir(dirPath);
      
      // Check for common project indicators
      if (entries.includes('package.json')) {
        indicators.push('package.json');
        type = 'nodejs-project';
      }
      
      if (entries.includes('Cargo.toml')) {
        indicators.push('Cargo.toml');
        type = 'rust-project';
      }
      
      if (entries.includes('pom.xml') || entries.includes('build.gradle')) {
        indicators.push(entries.includes('pom.xml') ? 'pom.xml' : 'build.gradle');
        type = 'java-project';
      }
      
      if (entries.includes('requirements.txt') || entries.includes('setup.py') || entries.includes('pyproject.toml')) {
        indicators.push('python-files');
        type = 'python-project';
      }
      
      if (entries.includes('.git')) {
        indicators.push('.git');
        type = type === 'unknown' ? 'git-repository' : type;
      }
      
      if (entries.includes('src') && entries.includes('tests')) {
        indicators.push('src+tests');
        type = type === 'unknown' ? 'source-project' : type;
      }
      
      if (entries.includes('node_modules')) {
        indicators.push('node_modules');
      }
      
      if (entries.includes('target') && type === 'rust-project') {
        indicators.push('target');
      }
      
      if (type === 'unknown' && entries.length === 0) {
        type = 'empty-directory';
      } else if (type === 'unknown') {
        type = 'regular-directory';
      }
      
    } catch (error) {
      type = 'inaccessible';
      indicators.push(`error: ${error.message}`);
    }

    return { type, indicators };
  }

  /**
   * Check directory permissions
   * @param {string} dirPath - The directory path
   * @returns {Promise<Object>} Permission information
   */
  async checkDirectoryPermissions(dirPath) {
    const permissions = {
      read: false,
      write: false,
      execute: false
    };

    try {
      await fs.access(dirPath, fs.constants.R_OK);
      permissions.read = true;
    } catch (error) {
      // Read permission denied
    }

    try {
      await fs.access(dirPath, fs.constants.W_OK);
      permissions.write = true;
    } catch (error) {
      // Write permission denied
    }

    try {
      await fs.access(dirPath, fs.constants.X_OK);
      permissions.execute = true;
    } catch (error) {
      // Execute permission denied
    }

    return permissions;
  }

  /**
   * Validate that directory still exists
   * @param {string} dirPath - The directory path
   * @returns {Promise<boolean>} True if exists
   */
  async validateDirectoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }
}

export default DirectoryCurrentTool;
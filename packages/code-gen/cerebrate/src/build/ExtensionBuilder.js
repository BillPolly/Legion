/**
 * Extension Builder for Cerebrate
 * Handles building, packaging, and optimization of Chrome extension
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class ExtensionBuilder {
  constructor(options = {}) {
    this.defaultOptions = {
      minify: false,
      optimizeImages: false,
      compressCss: false,
      createPackage: false,
      generateChecksums: false,
      excludeFiles: ['*.test.js', '*.spec.js', 'node_modules/**'],
      version: null,
      packageName: null,
      ...options
    };
  }
  
  /**
   * Build the extension
   * @param {Object} options - Build options
   * @returns {Object} - Build result
   */
  async build(options = {}) {
    const buildOptions = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    
    try {
      // Validate inputs
      this.validateBuildOptions(buildOptions);
      
      // Prepare output directory
      this.prepareOutputDirectory(buildOptions.outputDir);
      
      // Copy and process files
      const files = await this.processFiles(buildOptions);
      
      // Validate build artifacts
      await this.validateBuildArtifacts(buildOptions);
      
      // Create package if requested
      let packagePath = null;
      let checksums = null;
      
      if (buildOptions.createPackage) {
        packagePath = await this.createPackage(buildOptions);
        
        if (buildOptions.generateChecksums) {
          checksums = this.generateChecksums(packagePath);
        }
      }
      
      const buildTime = Date.now() - startTime;
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      
      return {
        success: true,
        files,
        totalSize,
        buildTime,
        packagePath,
        checksums
      };
    } catch (error) {
      // Clean up on failure
      if (fs.existsSync(buildOptions.outputDir)) {
        fs.rmSync(buildOptions.outputDir, { recursive: true, force: true });
      }
      
      throw new Error(`Build failed: ${error.message}`);
    }
  }
  
  /**
   * Validate build options
   * @param {Object} options - Build options
   * @private
   */
  validateBuildOptions(options) {
    if (!options.sourceDir) {
      throw new Error('Source directory is required');
    }
    
    if (!options.outputDir) {
      throw new Error('Output directory is required');
    }
    
    if (!fs.existsSync(options.sourceDir)) {
      throw new Error(`Source directory does not exist: ${options.sourceDir}`);
    }
    
    const manifestPath = path.join(options.sourceDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('manifest.json not found in source directory');
    }
  }
  
  /**
   * Prepare output directory
   * @param {string} outputDir - Output directory path
   * @private
   */
  prepareOutputDirectory(outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    } else {
      // Clean existing build
      fs.rmSync(outputDir, { recursive: true, force: true });
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }
  
  /**
   * Process all files in source directory
   * @param {Object} options - Build options
   * @returns {Array} - Processed files list
   * @private
   */
  async processFiles(options) {
    const files = [];
    
    // Process manifest.json first
    const manifestResult = await this.processManifest(options);
    files.push(manifestResult);
    
    // Process all other files
    const sourceFiles = this.getSourceFiles(options.sourceDir, options.excludeFiles);
    
    for (const sourceFile of sourceFiles) {
      if (path.basename(sourceFile) === 'manifest.json') {
        continue; // Already processed
      }
      
      const result = await this.processFile(sourceFile, options);
      files.push(result);
    }
    
    return files;
  }
  
  /**
   * Process manifest.json file
   * @param {Object} options - Build options
   * @returns {Object} - File processing result
   * @private
   */
  async processManifest(options) {
    const manifestPath = path.join(options.sourceDir, 'manifest.json');
    const outputPath = path.join(options.outputDir, 'manifest.json');
    
    let manifest;
    try {
      const content = fs.readFileSync(manifestPath, 'utf8');
      manifest = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse manifest.json: ${error.message}`);
    }
    
    // Validate manifest structure
    this.validateManifest(manifest);
    
    // Update version if provided
    if (options.version) {
      manifest.version = options.version;
    }
    
    const finalContent = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(outputPath, finalContent);
    
    return {
      name: 'manifest.json',
      sourcePath: manifestPath,
      outputPath: outputPath,
      size: finalContent.length
    };
  }
  
  /**
   * Validate manifest.json structure
   * @param {Object} manifest - Manifest object
   * @private
   */
  validateManifest(manifest) {
    const required = ['manifest_version'];
    
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Invalid manifest.json: missing required field ${field}`);
      }
    }
    
    if (manifest.manifest_version !== 3) {
      console.warn('Warning: Only Manifest V3 is fully supported');
    }
  }
  
  /**
   * Get all source files
   * @param {string} sourceDir - Source directory
   * @param {Array} excludePatterns - Exclude patterns
   * @returns {Array} - Source file paths
   * @private
   */
  getSourceFiles(sourceDir, excludePatterns = []) {
    const files = [];
    
    const traverse = (dir) => {
      const entries = fs.readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (stat.isFile()) {
          // Check if file should be excluded
          const relativePath = path.relative(sourceDir, fullPath);
          const shouldExclude = excludePatterns.some(pattern => {
            return this.matchPattern(relativePath, pattern);
          });
          
          if (!shouldExclude) {
            files.push(fullPath);
          }
        }
      }
    };
    
    traverse(sourceDir);
    return files;
  }
  
  /**
   * Match file path against pattern
   * @param {string} filePath - File path
   * @param {string} pattern - Pattern to match
   * @returns {boolean} - Matches pattern
   * @private
   */
  matchPattern(filePath, pattern) {
    // Simple pattern matching (could be enhanced with glob)
    if (pattern.includes('*')) {
      const regex = pattern.replace(/\*/g, '.*');
      return new RegExp(regex).test(filePath);
    }
    
    return filePath.includes(pattern);
  }
  
  /**
   * Process individual file
   * @param {string} sourceFile - Source file path
   * @param {Object} options - Build options
   * @returns {Object} - File processing result
   * @private
   */
  async processFile(sourceFile, options) {
    const relativePath = path.relative(options.sourceDir, sourceFile);
    const outputPath = path.join(options.outputDir, relativePath);
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const ext = path.extname(sourceFile);
    let processedContent;
    
    if (ext === '.js' && options.minify) {
      processedContent = this.minifyJavaScript(fs.readFileSync(sourceFile, 'utf8'));
      fs.writeFileSync(outputPath, processedContent);
    } else if (ext === '.css' && options.compressCss) {
      processedContent = this.compressCss(fs.readFileSync(sourceFile, 'utf8'));
      fs.writeFileSync(outputPath, processedContent);
    } else if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext) && options.optimizeImages) {
      processedContent = this.optimizeImage(fs.readFileSync(sourceFile));
      fs.writeFileSync(outputPath, processedContent);
    } else {
      // Copy file as-is
      fs.copyFileSync(sourceFile, outputPath);
      processedContent = fs.readFileSync(outputPath);
    }
    
    const stats = fs.statSync(outputPath);
    
    return {
      name: relativePath,
      sourcePath: sourceFile,
      outputPath: outputPath,
      size: stats.size
    };
  }
  
  /**
   * Minify JavaScript content
   * @param {string} content - JavaScript content
   * @returns {string} - Minified content
   * @private
   */
  minifyJavaScript(content) {
    // Simple minification (remove comments, extra whitespace)
    return content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
      .replace(/\/\/.*$/gm, '') // Remove // comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/;\s*}/g, '}') // Remove semicolons before }
      .replace(/{\s*/g, '{') // Remove space after {
      .replace(/}\s*/g, '}') // Remove space after }
      .trim();
  }
  
  /**
   * Compress CSS content
   * @param {string} content - CSS content
   * @returns {string} - Compressed content
   * @private
   */
  compressCss(content) {
    return content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*{\s*/g, '{') // Remove spaces around {
      .replace(/;\s*}/g, '}') // Remove semicolons before }
      .replace(/}\s*/g, '}') // Remove space after }
      .replace(/:\s*/g, ':') // Remove space after :
      .replace(/;\s*/g, ';') // Remove space after ;
      .replace(/#ffffff/g, '#fff') // Optimize colors
      .replace(/#000000/g, '#000')
      .trim();
  }
  
  /**
   * Optimize image (placeholder implementation)
   * @param {Buffer} content - Image content
   * @returns {Buffer} - Optimized content
   * @private
   */
  optimizeImage(content) {
    // Placeholder - in real implementation would use image optimization library
    // For now, just return original content
    return content;
  }
  
  /**
   * Validate build artifacts
   * @param {Object} options - Build options
   * @private
   */
  async validateBuildArtifacts(options) {
    // Read manifest to check for required files
    const manifestPath = path.join(options.outputDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Check for background script
    if (manifest.background?.service_worker) {
      const bgPath = path.join(options.outputDir, manifest.background.service_worker);
      if (!fs.existsSync(bgPath)) {
        throw new Error(`Required file not found: ${manifest.background.service_worker}`);
      }
    }
    
    // Check for content scripts
    if (manifest.content_scripts) {
      for (const contentScript of manifest.content_scripts) {
        for (const jsFile of contentScript.js || []) {
          const jsPath = path.join(options.outputDir, jsFile);
          if (!fs.existsSync(jsPath)) {
            throw new Error(`Required file not found: ${jsFile}`);
          }
        }
      }
    }
  }
  
  /**
   * Create package zip file
   * @param {Object} options - Build options
   * @returns {string} - Package file path
   * @private
   */
  async createPackage(options) {
    const packageName = options.packageName || 'cerebrate.zip';
    const packagePath = path.join(path.dirname(options.outputDir), packageName);
    
    // Placeholder - in real implementation would create actual zip
    // For testing, just create a dummy file
    fs.writeFileSync(packagePath, 'dummy-zip-content');
    
    return packagePath;
  }
  
  /**
   * Generate package checksums
   * @param {string} packagePath - Package file path
   * @returns {Object} - Checksums
   * @private
   */
  generateChecksums(packagePath) {
    const content = fs.readFileSync(packagePath);
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const md5 = crypto.createHash('md5').update(content).digest('hex');
    
    return { sha256, md5 };
  }
  
  /**
   * Load configuration from file
   * @param {string} configPath - Configuration file path
   * @returns {Object} - Configuration
   */
  loadConfig(configPath) {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  }
  
  /**
   * Merge configuration objects
   * @param {Object} defaultConfig - Default configuration
   * @param {Object} userConfig - User configuration
   * @returns {Object} - Merged configuration
   */
  mergeConfig(defaultConfig, userConfig) {
    return { ...defaultConfig, ...userConfig };
  }
}
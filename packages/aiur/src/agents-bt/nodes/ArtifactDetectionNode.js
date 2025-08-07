/**
 * ArtifactDetectionNode - Detects and extracts artifacts from content
 * 
 * Analyzes text, code, or structured data to identify and extract
 * artifacts like code blocks, configurations, documentation, etc.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class ArtifactDetectionNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'artifact_detection';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.contentSource = config.contentSource || 'message'; // message, context, parameter
    this.contentKey = config.contentKey || 'content';
    this.artifactTypes = config.artifactTypes || ['code', 'config', 'documentation'];
    this.autoLabel = config.autoLabel !== false;
    this.storeDetected = config.storeDetected !== false;
  }

  async executeNode(context) {
    try {
      // Get content to analyze
      const content = this.getContentToAnalyze(context);
      if (!content) {
        return this.createFailureResult('No content available for artifact detection');
      }

      // Detect artifacts in content
      const detectedArtifacts = await this.detectArtifacts(content, context);
      
      // Store artifacts if requested
      if (this.storeDetected && detectedArtifacts.length > 0) {
        await this.storeArtifacts(detectedArtifacts, context);
      }

      return this.createSuccessResult({
        contentAnalyzed: true,
        artifactsDetected: detectedArtifacts.length,
        artifacts: detectedArtifacts,
        storedArtifacts: this.storeDetected,
        detectionTypes: this.artifactTypes
      });

    } catch (error) {
      return this.createFailureResult(`Artifact detection failed: ${error.message}`, error);
    }
  }

  /**
   * Get content to analyze from context
   */
  getContentToAnalyze(context) {
    switch (this.contentSource) {
      case 'message':
        return context.message?.content || context.message?.text;
        
      case 'context':
        return context[this.contentKey];
        
      case 'parameter':
        return this.config[this.contentKey];
        
      default:
        // Try multiple sources
        return context.message?.content || 
               context.content ||
               context[this.contentKey];
    }
  }

  /**
   * Detect artifacts in content
   */
  async detectArtifacts(content, context) {
    const artifacts = [];
    
    // Detect code blocks
    if (this.artifactTypes.includes('code')) {
      artifacts.push(...this.detectCodeBlocks(content));
    }
    
    // Detect configuration files
    if (this.artifactTypes.includes('config')) {
      artifacts.push(...this.detectConfigFiles(content));
    }
    
    // Detect documentation
    if (this.artifactTypes.includes('documentation')) {
      artifacts.push(...this.detectDocumentation(content));
    }
    
    // Detect JSON/XML structures
    if (this.artifactTypes.includes('data')) {
      artifacts.push(...this.detectDataStructures(content));
    }
    
    // Detect file references
    if (this.artifactTypes.includes('files')) {
      artifacts.push(...this.detectFileReferences(content));
    }

    // Auto-label artifacts
    if (this.autoLabel) {
      artifacts.forEach(artifact => this.generateArtifactLabel(artifact));
    }

    return artifacts;
  }

  /**
   * Detect code blocks in content
   */
  detectCodeBlocks(content) {
    const artifacts = [];
    
    // Match fenced code blocks
    const fencedRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = fencedRegex.exec(content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();
      
      if (code.length > 0) {
        artifacts.push({
          type: 'code',
          language,
          content: code,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          metadata: {
            hasLanguage: !!match[1],
            lineCount: code.split('\n').length,
            size: code.length
          }
        });
      }
    }
    
    // Match inline code (if no fenced blocks found)
    if (artifacts.length === 0) {
      const inlineRegex = /`([^`\n]+)`/g;
      while ((match = inlineRegex.exec(content)) !== null) {
        const code = match[1];
        if (code.length > 10) { // Only capture substantial inline code
          artifacts.push({
            type: 'code',
            language: 'text',
            content: code,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            metadata: {
              inline: true,
              size: code.length
            }
          });
        }
      }
    }
    
    return artifacts;
  }

  /**
   * Detect configuration files
   */
  detectConfigFiles(content) {
    const artifacts = [];
    
    // Detect JSON configurations
    try {
      const jsonRegex = /\{[\s\S]*\}/g;
      let match;
      
      while ((match = jsonRegex.exec(content)) !== null) {
        try {
          const parsed = JSON.parse(match[0]);
          if (this.looksLikeConfig(parsed)) {
            artifacts.push({
              type: 'config',
              format: 'json',
              content: match[0],
              parsed,
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              metadata: {
                keys: Object.keys(parsed).length,
                nested: this.hasNestedObjects(parsed)
              }
            });
          }
        } catch (e) {
          // Not valid JSON, skip
        }
      }
    } catch (error) {
      // JSON detection failed, continue with other formats
    }
    
    // Detect YAML-like configurations
    const yamlRegex = /^[\w-]+:\s*.+$/gm;
    const yamlMatches = content.match(yamlRegex);
    if (yamlMatches && yamlMatches.length > 2) {
      artifacts.push({
        type: 'config',
        format: 'yaml',
        content: yamlMatches.join('\n'),
        metadata: {
          lines: yamlMatches.length,
          approximateYaml: true
        }
      });
    }
    
    return artifacts;
  }

  /**
   * Detect documentation sections
   */
  detectDocumentation(content) {
    const artifacts = [];
    
    // Detect markdown sections
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings = [];
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2],
        index: match.index
      });
    }
    
    if (headings.length > 0) {
      artifacts.push({
        type: 'documentation',
        format: 'markdown',
        content: content,
        metadata: {
          headings: headings.length,
          structure: headings.map(h => ({ level: h.level, text: h.text })),
          estimatedReadingTime: Math.ceil(content.split(' ').length / 200)
        }
      });
    }
    
    return artifacts;
  }

  /**
   * Detect data structures (JSON, XML, etc.)
   */
  detectDataStructures(content) {
    const artifacts = [];
    
    // JSON structures
    try {
      const jsonRegex = /\{[\s\S]*\}|\[[\s\S]*\]/g;
      let match;
      
      while ((match = jsonRegex.exec(content)) !== null) {
        try {
          const parsed = JSON.parse(match[0]);
          artifacts.push({
            type: 'data',
            format: 'json',
            content: match[0],
            parsed,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            metadata: {
              isArray: Array.isArray(parsed),
              size: JSON.stringify(parsed).length
            }
          });
        } catch (e) {
          // Not valid JSON
        }
      }
    } catch (error) {
      // JSON detection failed
    }
    
    return artifacts;
  }

  /**
   * Detect file references
   */
  detectFileReferences(content) {
    const artifacts = [];
    
    // File path patterns
    const pathRegex = /(?:^|\s)([./]?[\w-]+(?:\/[\w.-]+)*\.[\w]+)/g;
    let match;
    
    while ((match = pathRegex.exec(content)) !== null) {
      const path = match[1];
      if (this.looksLikeFilePath(path)) {
        artifacts.push({
          type: 'file_reference',
          content: path,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          metadata: {
            extension: this.getFileExtension(path),
            isRelative: path.startsWith('./') || path.startsWith('../'),
            isAbsolute: path.startsWith('/')
          }
        });
      }
    }
    
    return artifacts;
  }

  /**
   * Check if object looks like a configuration
   */
  looksLikeConfig(obj) {
    if (typeof obj !== 'object' || !obj) return false;
    
    const configKeys = ['config', 'settings', 'options', 'name', 'version', 'scripts', 'dependencies'];
    const keys = Object.keys(obj);
    
    return keys.some(key => configKeys.includes(key.toLowerCase()));
  }

  /**
   * Check if object has nested objects
   */
  hasNestedObjects(obj) {
    return Object.values(obj).some(value => 
      typeof value === 'object' && value !== null && !Array.isArray(value)
    );
  }

  /**
   * Check if string looks like a file path
   */
  looksLikeFilePath(path) {
    const commonExtensions = ['.js', '.ts', '.json', '.md', '.txt', '.py', '.java', '.go', '.rs'];
    return commonExtensions.some(ext => path.toLowerCase().endsWith(ext));
  }

  /**
   * Get file extension from path
   */
  getFileExtension(path) {
    const match = path.match(/\.(\w+)$/);
    return match ? match[1] : null;
  }

  /**
   * Generate automatic label for artifact
   */
  generateArtifactLabel(artifact) {
    if (artifact.label) return; // Already has label
    
    switch (artifact.type) {
      case 'code':
        artifact.label = `${artifact.language || 'code'} snippet`;
        if (artifact.metadata?.lineCount) {
          artifact.label += ` (${artifact.metadata.lineCount} lines)`;
        }
        break;
        
      case 'config':
        artifact.label = `${artifact.format} configuration`;
        break;
        
      case 'documentation':
        artifact.label = `${artifact.format} documentation`;
        if (artifact.metadata?.headings) {
          artifact.label += ` (${artifact.metadata.headings} sections)`;
        }
        break;
        
      case 'data':
        artifact.label = `${artifact.format} data`;
        if (artifact.metadata?.isArray) {
          artifact.label += ' (array)';
        }
        break;
        
      case 'file_reference':
        artifact.label = `File reference: ${artifact.content}`;
        break;
        
      default:
        artifact.label = `${artifact.type} artifact`;
    }
    
    // Add ID
    artifact.id = this.generateArtifactId(artifact);
  }

  /**
   * Generate unique ID for artifact
   */
  generateArtifactId(artifact) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `${artifact.type}_${timestamp}_${random}`;
  }

  /**
   * Store detected artifacts
   */
  async storeArtifacts(artifacts, context) {
    if (!context.artifactManager) {
      console.warn('No artifact manager available for storing detected artifacts');
      return;
    }
    
    for (const artifact of artifacts) {
      try {
        await context.artifactManager.storeArtifact(artifact.id, {
          type: artifact.type,
          content: artifact.content,
          label: artifact.label || artifact.id,
          metadata: {
            ...artifact.metadata,
            detectedAt: new Date().toISOString(),
            detectionSource: 'ArtifactDetectionNode'
          }
        });
      } catch (error) {
        console.warn(`Failed to store artifact ${artifact.id}:`, error.message);
      }
    }
  }

  /**
   * Create success result
   */
  createSuccessResult(data) {
    return {
      status: NodeStatus.SUCCESS,
      data: {
        artifactDetection: true,
        ...data
      }
    };
  }

  /**
   * Create failure result
   */
  createFailureResult(message, error = null) {
    return {
      status: NodeStatus.FAILURE,
      data: {
        artifactDetection: false,
        error: message,
        details: error ? {
          message: error.message,
          stack: error.stack
        } : undefined
      }
    };
  }

  /**
   * Get node metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      nodeType: 'artifact_detection',
      purpose: 'Content analysis and artifact extraction',
      supportedTypes: this.artifactTypes,
      capabilities: [
        'code_detection',
        'config_detection',
        'documentation_parsing',
        'data_structure_extraction',
        'file_reference_detection'
      ]
    };
  }
}
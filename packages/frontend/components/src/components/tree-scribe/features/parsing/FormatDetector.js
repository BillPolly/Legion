/**
 * FormatDetector - Intelligent document format detection for TreeScribe
 * Analyzes content to determine the most likely document format
 */

export class FormatDetector {
  constructor() {
    // Format signatures with confidence scoring
    this.signatures = new Map([
      // YAML signatures
      ['yaml', [
        { pattern: /^---\s*$/m, confidence: 0.9, weight: 10 },
        { pattern: /^%YAML/m, confidence: 0.95, weight: 15 },
        { pattern: /^\w+:\s*$/m, confidence: 0.6, weight: 5 },
        { pattern: /^\w+:\s+\S/m, confidence: 0.7, weight: 7 },
        { pattern: /^\s*-\s+\w/m, confidence: 0.6, weight: 6 },
        { pattern: /^\w+:\s*\|/m, confidence: 0.8, weight: 8 },
        { pattern: /^\w+:\s*>/m, confidence: 0.8, weight: 8 },
        { pattern: /^title:\s+/m, confidence: 0.7, weight: 6 },
        { pattern: /^children:\s*$/m, confidence: 0.9, weight: 12 }
      ]],
      
      // JSON signatures
      ['json', [
        { pattern: /^\s*\{/, confidence: 0.8, weight: 8 },
        { pattern: /^\s*\[/, confidence: 0.7, weight: 7 },
        { pattern: /\}\s*$/, confidence: 0.6, weight: 5 },
        { pattern: /\]\s*$/, confidence: 0.5, weight: 4 },
        { pattern: /"\w+":\s*"/, confidence: 0.8, weight: 8 },
        { pattern: /"\w+":\s*\d/, confidence: 0.7, weight: 7 },
        { pattern: /"\w+":\s*\{/, confidence: 0.8, weight: 8 },
        { pattern: /"\w+":\s*\[/, confidence: 0.7, weight: 7 },
        { pattern: /,\s*"/, confidence: 0.6, weight: 5 }
      ]],
      
      // Markdown signatures
      ['markdown', [
        { pattern: /^#{1,6}\s+.+$/m, confidence: 0.9, weight: 10 },
        { pattern: /^.+\n={3,}$/m, confidence: 0.85, weight: 9 },
        { pattern: /^.+\n-{3,}$/m, confidence: 0.8, weight: 8 },
        { pattern: /^\*{1,3}[^*].*[^*]\*{1,3}/m, confidence: 0.7, weight: 6 },
        { pattern: /^_{1,3}[^_].*[^_]_{1,3}/m, confidence: 0.7, weight: 6 },
        { pattern: /^```/m, confidence: 0.8, weight: 8 },
        { pattern: /^\s*[-*+]\s+/m, confidence: 0.6, weight: 5 },
        { pattern: /^\s*\d+\.\s+/m, confidence: 0.6, weight: 5 },
        { pattern: /^\s*>\s+/m, confidence: 0.7, weight: 6 },
        { pattern: /\[.*\]\(.*\)/, confidence: 0.7, weight: 6 },
        { pattern: /!\[.*\]\(.*\)/, confidence: 0.7, weight: 6 }
      ]],
      
      // HTML signatures
      ['html', [
        { pattern: /^\s*<!DOCTYPE\s+html/i, confidence: 0.95, weight: 15 },
        { pattern: /^\s*<html[\s>]/i, confidence: 0.9, weight: 12 },
        { pattern: /^\s*<head[\s>]/i, confidence: 0.85, weight: 10 },
        { pattern: /^\s*<body[\s>]/i, confidence: 0.85, weight: 10 },
        { pattern: /<\w+[^>]*>/, confidence: 0.7, weight: 6 },
        { pattern: /<\/\w+>/, confidence: 0.7, weight: 6 },
        { pattern: /<\w+\s+[^>]*\/>/, confidence: 0.6, weight: 5 },
        { pattern: /&\w+;/, confidence: 0.6, weight: 4 }
      ]],
      
      // JavaScript signatures
      ['javascript', [
        { pattern: /^(import|export)\s+/m, confidence: 0.9, weight: 10 },
        { pattern: /^(function|class|const|let|var)\s+/m, confidence: 0.8, weight: 8 },
        { pattern: /=>\s*\{/, confidence: 0.7, weight: 6 },
        { pattern: /function\s*\(/, confidence: 0.8, weight: 7 },
        { pattern: /class\s+\w+/, confidence: 0.8, weight: 8 },
        { pattern: /console\.(log|error|warn)/, confidence: 0.7, weight: 6 },
        { pattern: /require\s*\(/, confidence: 0.7, weight: 6 },
        { pattern: /module\.exports/, confidence: 0.8, weight: 7 }
      ]],
      
      // XML signatures
      ['xml', [
        { pattern: /^\s*<\?xml/i, confidence: 0.95, weight: 15 },
        { pattern: /^\s*<\w+[\s>]/, confidence: 0.7, weight: 6 },
        { pattern: /<\/\w+>\s*$/, confidence: 0.6, weight: 5 },
        { pattern: /xmlns[:=]/, confidence: 0.8, weight: 8 },
        { pattern: /<\w+:\w+/, confidence: 0.7, weight: 6 }
      ]]
    ]);

    // File extension mappings
    this.extensionMap = new Map([
      ['yaml', ['yaml', 'yml']],
      ['json', ['json']],
      ['markdown', ['md', 'markdown', 'mdown', 'mkd']],
      ['html', ['html', 'htm']],
      ['javascript', ['js', 'mjs', 'ts', 'jsx', 'tsx']],
      ['xml', ['xml', 'xsd', 'xsl', 'xslt']]
    ]);

    // MIME type mappings
    this.mimeMap = new Map([
      ['application/x-yaml', 'yaml'],
      ['application/yaml', 'yaml'],
      ['text/yaml', 'yaml'],
      ['text/x-yaml', 'yaml'],
      ['application/json', 'json'],
      ['application/ld+json', 'json'],
      ['text/json', 'json'],
      ['text/markdown', 'markdown'],
      ['text/x-markdown', 'markdown'],
      ['application/markdown', 'markdown'],
      ['text/html', 'html'],
      ['application/xhtml+xml', 'html'],
      ['text/javascript', 'javascript'],
      ['application/javascript', 'javascript'],
      ['application/x-javascript', 'javascript'],
      ['text/xml', 'xml'],
      ['application/xml', 'xml']
    ]);
  }

  /**
   * Detect format from content and hints
   * @param {string} content - Document content
   * @param {Object} hints - Format hints (extension, mimeType, filename)
   * @returns {Object} Detection result with format and confidence
   */
  detect(content, hints = {}) {
    const results = [];

    // 1. Check explicit format hint
    if (hints.format) {
      return {
        format: hints.format.toLowerCase(),
        confidence: 1.0,
        source: 'hint',
        details: { providedFormat: hints.format }
      };
    }

    // 2. Check MIME type
    if (hints.mimeType) {
      const format = this.mimeMap.get(hints.mimeType.toLowerCase());
      if (format) {
        results.push({
          format,
          confidence: 0.9,
          source: 'mimeType',
          details: { mimeType: hints.mimeType }
        });
      }
    }

    // 3. Check file extension
    if (hints.filename || hints.extension) {
      const extension = hints.extension || this._extractExtension(hints.filename);
      if (extension) {
        for (const [format, extensions] of this.extensionMap) {
          if (extensions.includes(extension.toLowerCase())) {
            results.push({
              format,
              confidence: 0.8,
              source: 'filename',
              details: { extension, filename: hints.filename }
            });
            break;
          }
        }
      }
    }

    // 4. Analyze content
    if (content && typeof content === 'string' && content.trim()) {
      const contentResults = this._analyzeContent(content);
      results.push(...contentResults);
    }

    // 5. Determine best result
    if (results.length === 0) {
      return {
        format: 'plain',
        confidence: 0.3,
        source: 'default',
        details: { reason: 'No matching patterns found' }
      };
    }

    // Sort by confidence and return best match
    results.sort((a, b) => b.confidence - a.confidence);
    const best = results[0];

    return {
      ...best,
      alternatives: results.slice(1, 3), // Include top alternatives
      allResults: results
    };
  }

  /**
   * Analyze content for format signatures
   * @private
   */
  _analyzeContent(content) {
    const results = [];
    const contentLength = content.length;
    
    // Analyze each format's signatures
    for (const [format, signatures] of this.signatures) {
      let totalScore = 0;
      let totalWeight = 0;
      let matchCount = 0;
      const matches = [];

      for (const signature of signatures) {
        const match = signature.pattern.test(content);
        if (match) {
          totalScore += signature.confidence * signature.weight;
          totalWeight += signature.weight;
          matchCount++;
          matches.push({
            pattern: signature.pattern.toString(),
            confidence: signature.confidence,
            weight: signature.weight
          });
        }
      }

      if (matchCount > 0) {
        // Calculate weighted confidence
        let confidence = totalScore / Math.max(totalWeight, 1);
        
        // Boost confidence for multiple matches
        confidence *= Math.min(1 + (matchCount - 1) * 0.1, 1.5);
        
        // Adjust based on content characteristics
        confidence = this._adjustConfidenceForContent(format, content, confidence);
        
        results.push({
          format,
          confidence: Math.min(confidence, 0.95), // Cap at 95%
          source: 'content',
          details: {
            matchCount,
            totalWeight,
            matches: matches.slice(0, 3), // Top 3 matches
            contentLength
          }
        });
      }
    }

    return results;
  }

  /**
   * Adjust confidence based on content characteristics
   * @private
   */
  _adjustConfidenceForContent(format, content, baseConfidence) {
    const length = content.length;
    
    // Very short content is less reliable
    if (length < 50) {
      return baseConfidence * 0.7;
    }
    
    // Very long content with few matches might be less reliable
    if (length > 10000 && baseConfidence < 0.6) {
      return baseConfidence * 0.8;
    }

    // Format-specific adjustments
    switch (format) {
      case 'json':
        // JSON should be valid parseable
        try {
          JSON.parse(content);
          return Math.min(baseConfidence * 1.2, 0.95);
        } catch {
          return baseConfidence * 0.6;
        }
        
      case 'yaml':
        // YAML with TreeScribe structure gets bonus
        if (content.includes('title:') && content.includes('children:')) {
          return Math.min(baseConfidence * 1.15, 0.95);
        }
        break;
        
      case 'markdown':
        // Markdown with proper heading hierarchy gets bonus
        const headingMatches = content.match(/^#{1,6}\s+/gm);
        if (headingMatches && headingMatches.length > 2) {
          return Math.min(baseConfidence * 1.1, 0.95);
        }
        break;
        
      case 'html':
        // HTML should have proper tag structure
        const openTags = (content.match(/<\w+/g) || []).length;
        const closeTags = (content.match(/<\/\w+>/g) || []).length;
        if (openTags > 0 && Math.abs(openTags - closeTags) / openTags < 0.3) {
          return Math.min(baseConfidence * 1.1, 0.95);
        }
        break;
    }

    return baseConfidence;
  }

  /**
   * Extract file extension from filename
   * @private
   */
  _extractExtension(filename) {
    if (!filename || typeof filename !== 'string') {
      return null;
    }
    
    const match = filename.match(/\.([^.]+)$/);
    return match ? match[1] : null;
  }

  /**
   * Get confidence threshold for reliable detection
   * @returns {number} Confidence threshold (0-1)
   */
  getConfidenceThreshold() {
    return 0.6;
  }

  /**
   * Check if detection result is reliable
   * @param {Object} result - Detection result
   * @returns {boolean} Is reliable
   */
  isReliable(result) {
    return result.confidence >= this.getConfidenceThreshold();
  }

  /**
   * Get supported formats
   * @returns {string[]} Array of format identifiers
   */
  getSupportedFormats() {
    return Array.from(this.signatures.keys());
  }

  /**
   * Get format statistics from content analysis
   * @param {string} content - Document content
   * @param {Object} hints - Format hints
   * @returns {Object} Analysis statistics
   */
  analyzeContent(content, hints = {}) {
    if (!content || typeof content !== 'string') {
      return {
        length: 0,
        lines: 0,
        formats: {},
        characteristics: {}
      };
    }

    const lines = content.split('\n');
    const characteristics = {
      hasHeadings: /^#{1,6}\s+/m.test(content),
      hasList: /^\s*[-*+]\s+/m.test(content),
      hasCodeBlocks: /^```/m.test(content),
      hasJsonStructure: /^\s*[{\[]/.test(content.trim()),
      hasYamlStructure: /^\w+:\s*$/m.test(content),
      hasHtmlTags: /<\w+[^>]*>/.test(content),
      hasXmlDeclaration: /^\s*<\?xml/i.test(content)
    };

    // Get main detection result
    const mainResult = this.detect(content, hints);
    
    // Analyze all formats
    const formats = {};
    for (const format of this.getSupportedFormats()) {
      const result = this.detect(content, { format });
      formats[format] = {
        confidence: result.confidence,
        matchCount: result.details?.matchCount || 0
      };
    }
    
    // Count YAML indicators
    const yamlIndicators = [
      /^\w+:\s*$/m,
      /^\s*-\s+\w+/m,
      /^---/m,
      /\|\s*$/m,
      />\s*$/m
    ].filter(pattern => pattern.test(content)).length;

    return {
      format: mainResult.format,
      confidence: mainResult.confidence,
      source: mainResult.source,
      alternatives: mainResult.alternatives || [],
      length: content.length,
      lines: lines.length,
      formats,
      characteristics,
      features: {
        yamlIndicators,
        markdownIndicators: characteristics.hasHeadings || characteristics.hasList || characteristics.hasCodeBlocks ? 1 : 0,
        jsonIndicators: characteristics.hasJsonStructure ? 1 : 0
      },
      mostLikely: mainResult.format
    };
  }
}
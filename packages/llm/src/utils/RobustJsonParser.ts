import * as JSON5 from 'json5';

/**
 * Robust JSON parsing utility for LLM responses
 * Handles common issues with LLM-generated JSON including:
 * - Extra text before/after JSON
 * - Comments in JSON
 * - Trailing commas
 * - Single quotes instead of double quotes
 * - Malformed JSON structures
 */
export class RobustJsonParser {
  /**
   * Extract and parse JSON from LLM response text
   */
  static parseFromText(text: string): any {
    if (!text || typeof text !== 'string') {
      throw new Error('Input text is empty or not a string');
    }

    // Clean the text first
    const cleanedText = RobustJsonParser.cleanText(text);
    
    // Try multiple extraction strategies
    const extractionStrategies = [
      RobustJsonParser.extractJsonObject,
      RobustJsonParser.extractJsonArray,
      RobustJsonParser.extractCodeBlock,
      RobustJsonParser.extractBetweenMarkers
    ];

    let lastError: Error | null = null;

    for (const strategy of extractionStrategies) {
      try {
        const extracted = strategy(cleanedText);
        if (extracted) {
          // Try parsing with JSON5 first (more forgiving)
          try {
            return JSON5.parse(extracted);
          } catch (json5Error) {
            // Fallback to standard JSON
            try {
              return JSON.parse(extracted);
            } catch (jsonError) {
              lastError = jsonError as Error;
              continue;
            }
          }
        }
      } catch (error) {
        lastError = error as Error;
        continue;
      }
    }

    throw new Error(`Failed to parse JSON from text. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Clean the input text by removing common issues
   */
  private static cleanText(text: string): string {
    return text
      // Remove leading/trailing whitespace
      .trim()
      // Remove common markdown formatting
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      // Remove common prefixes
      .replace(/^(here's|here is|the json is|response:|answer:)\s*/gi, '')
      // Remove HTML entities
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }

  /**
   * Extract JSON object (starts with { and ends with })
   */
  private static extractJsonObject(text: string): string | null {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return RobustJsonParser.balanceJsonBraces(match[0], '{', '}');
    }
    return null;
  }

  /**
   * Extract JSON array (starts with [ and ends with ])
   */
  private static extractJsonArray(text: string): string | null {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      return RobustJsonParser.balanceJsonBraces(match[0], '[', ']');
    }
    return null;
  }

  /**
   * Extract JSON from code blocks
   */
  private static extractCodeBlock(text: string): string | null {
    // Look for ```json ... ``` blocks
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonBlockMatch) {
      return jsonBlockMatch[1].trim();
    }

    // Look for ``` ... ``` blocks that might contain JSON
    const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      const content = codeBlockMatch[1].trim();
      if (content.startsWith('{') || content.startsWith('[')) {
        return content;
      }
    }

    return null;
  }

  /**
   * Extract JSON between common markers
   */
  private static extractBetweenMarkers(text: string): string | null {
    // Look for JSON between common markers
    const markers = [
      { start: 'json:', end: '\n\n' },
      { start: 'response:', end: '\n\n' },
      { start: '```', end: '```' },
      { start: '{', end: '}' },
      { start: '[', end: ']' }
    ];

    for (const marker of markers) {
      const startIndex = text.toLowerCase().indexOf(marker.start.toLowerCase());
      if (startIndex !== -1) {
        const contentStart = startIndex + marker.start.length;
        let endIndex = text.indexOf(marker.end, contentStart);
        
        if (endIndex === -1 && (marker.start === '{' || marker.start === '[')) {
          // For braces/brackets, find the balanced end
          const balanced = RobustJsonParser.balanceJsonBraces(
            text.substring(startIndex), 
            marker.start, 
            marker.end
          );
          if (balanced) {
            return balanced;
          }
        } else if (endIndex !== -1) {
          const content = text.substring(contentStart, endIndex).trim();
          if (content.startsWith('{') || content.startsWith('[')) {
            return content;
          }
        }
      }
    }

    return null;
  }

  /**
   * Balance JSON braces/brackets to ensure valid structure
   */
  private static balanceJsonBraces(text: string, openChar: string, closeChar: string): string | null {
    let depth = 0;
    let start = -1;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === openChar) {
        if (depth === 0) {
          start = i;
        }
        depth++;
      } else if (char === closeChar) {
        depth--;
        if (depth === 0 && start !== -1) {
          return text.substring(start, i + 1);
        }
      }
    }

    return null;
  }

  /**
   * Validate that the parsed object has the expected structure
   */
  static validateStructure(obj: any, expectedKeys: string[]): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    return expectedKeys.every(key => key in obj);
  }

  /**
   * Parse and validate JSON with expected structure
   */
  static parseAndValidate(text: string, expectedKeys: string[]): any {
    const parsed = RobustJsonParser.parseFromText(text);
    
    if (!RobustJsonParser.validateStructure(parsed, expectedKeys)) {
      throw new Error(`Parsed JSON missing expected keys: ${expectedKeys.join(', ')}`);
    }

    return parsed;
  }
}

/**
 * json-parser.js - Robust JSON extraction and parsing
 * 
 * Extracts and parses JSON from LLM responses that may contain
 * additional text, markdown, or malformed JSON.
 * 
 * Only handles JSON parsing - BT validation is done by BTValidator.
 */

import JSON5 from 'json5';

/**
 * Extract and parse JSON from text response
 * @param {string} text - Text containing JSON
 * @returns {Object} Parsed JSON object
 * @throws {Error} If no valid JSON found
 */
export function extractJSON(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: expected non-empty string');
  }
  
  // Clean up common issues
  text = text.trim();
  
  // Try direct parse first (optimistic case)
  try {
    return JSON5.parse(text);
  } catch (e) {
    // Continue to extraction
  }
  
  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON5.parse(codeBlockMatch[1]);
    } catch (e) {
      // Continue to boundary search
    }
  }
  
  // Find JSON boundaries using brace counting
  const extracted = extractJSONByBraces(text);
  if (extracted) {
    try {
      return JSON5.parse(extracted);
    } catch (e) {
      throw new Error(`Failed to parse extracted JSON: ${e.message}`);
    }
  }
  
  throw new Error('No valid JSON object found in response');
}

/**
 * Extract JSON by finding matching braces
 * @param {string} text - Text to search
 * @returns {string|null} Extracted JSON string or null
 */
function extractJSONByBraces(text) {
  const start = text.indexOf('{');
  if (start === -1) {
    return null;
  }
  
  let depth = 0;
  let inString = false;
  let escape = false;
  
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    
    if (escape) {
      escape = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escape = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return text.substring(start, i + 1);
        }
      }
    }
  }
  
  // If we get here, braces are unmatched
  return null;
}
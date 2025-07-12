import { ResponseFormatter, ColorType } from './ResponseFormatter';
import { GeneratedResponse } from '../types';

export class DefaultResponseFormatter implements ResponseFormatter {
  formatResponse(response: GeneratedResponse): string {
    if (response.success) {
      return this.formatSuccessResponse(response);
    } else {
      return this.formatErrorResponse(response);
    }
  }

  formatSuccessResponse(response: GeneratedResponse): string {
    const parts: string[] = [];
    
    // Success icon and message
    const icon = this.colorize('✓', 'success');
    const message = response.message || 'Command completed successfully';
    parts.push(`${icon} ${message}`);
    
    // Timestamp
    const timestamp = this.formatTimestamp(response.timestamp);
    parts.push(this.colorize(`[${timestamp}]`, 'info'));
    
    // Data
    if (response.data) {
      const dataStr = this.formatData(response.data);
      if (dataStr) {
        parts.push('');
        parts.push(this.colorize('Data:', 'info'));
        parts.push(dataStr);
      }
    }
    
    // Suggestions
    const suggestions = this.formatSuggestions(response.suggestions);
    if (suggestions) {
      parts.push('');
      parts.push(suggestions);
    }
    
    // Metadata
    const metadata = this.formatMetadata(response.metadata);
    if (metadata) {
      parts.push('');
      parts.push(this.colorize('Details:', 'info'));
      parts.push(metadata);
    }
    
    return parts.join('\n');
  }

  formatErrorResponse(response: GeneratedResponse): string {
    const parts: string[] = [];
    
    // Error icon and message
    const icon = this.colorize('✗', 'error');
    const message = response.message || 'Command failed';
    parts.push(`${icon} ${this.colorize(message, 'error')}`);
    
    // Timestamp
    const timestamp = this.formatTimestamp(response.timestamp);
    parts.push(this.colorize(`[${timestamp}]`, 'info'));
    
    // Suggestions
    const suggestions = this.formatSuggestions(response.suggestions);
    if (suggestions) {
      parts.push('');
      parts.push(suggestions);
    }
    
    // Metadata
    const metadata = this.formatMetadata(response.metadata);
    if (metadata) {
      parts.push('');
      parts.push(this.colorize('Details:', 'info'));
      parts.push(metadata);
    }
    
    return parts.join('\n');
  }

  formatData(data: any): string {
    if (data === null || data === undefined) {
      return '';
    }
    
    try {
      if (Array.isArray(data)) {
        return this.formatArrayData(data);
      } else if (typeof data === 'object') {
        return this.formatObjectData(data);
      } else {
        return this.truncateData(String(data), 500);
      }
    } catch (error) {
      return this.colorize('Error formatting data', 'error');
    }
  }

  formatSuggestions(suggestions?: string[]): string {
    if (!suggestions || suggestions.length === 0) {
      return '';
    }
    
    const parts: string[] = [];
    parts.push(this.colorize('💡 Suggestions:', 'info'));
    
    for (const suggestion of suggestions) {
      parts.push(`  • ${suggestion}`);
    }
    
    return parts.join('\n');
  }

  formatMetadata(metadata: any): string {
    if (!metadata || typeof metadata !== 'object' || Object.keys(metadata).length === 0) {
      return '';
    }
    
    const parts: string[] = [];
    
    for (const [key, value] of Object.entries(metadata)) {
      const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
      const formattedValue = this.truncateData(value, 100);
      parts.push(`  ${formattedKey}: ${formattedValue}`);
    }
    
    return parts.join('\n');
  }

  formatTimestamp(timestamp: Date): string {
    return timestamp.toLocaleTimeString();
  }

  colorize(text: string, color: ColorType): string {
    const colors = {
      success: '\x1b[32m',  // Green
      error: '\x1b[31m',    // Red
      info: '\x1b[36m',     // Cyan
      warning: '\x1b[33m'   // Yellow
    };
    
    const reset = '\x1b[0m';
    const colorCode = colors[color];
    
    if (!colorCode) {
      return text;
    }
    
    return `${colorCode}${text}${reset}`;
  }

  truncateData(data: any, maxLength: number): string {
    let str: string;
    
    if (typeof data === 'string') {
      str = data;
    } else {
      str = JSON.stringify(data, null, 2);
    }
    
    if (str.length <= maxLength) {
      return str;
    }
    
    return str.substring(0, maxLength) + '...';
  }

  private formatArrayData(data: any[]): string {
    const maxItems = 10;
    const items = data.slice(0, maxItems);
    const parts: string[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = this.truncateData(items[i], 200);
      parts.push(`  [${i}] ${item}`);
    }
    
    if (data.length > maxItems) {
      parts.push(`  ... and ${data.length - maxItems} more items`);
    }
    
    return parts.join('\n');
  }

  private formatObjectData(data: object): string {
    const entries = Object.entries(data);
    const maxEntries = 20;
    const parts: string[] = [];
    
    for (let i = 0; i < Math.min(entries.length, maxEntries); i++) {
      const [key, value] = entries[i];
      const formattedValue = this.truncateData(value, 200);
      parts.push(`  ${key}: ${formattedValue}`);
    }
    
    if (entries.length > maxEntries) {
      parts.push(`  ... and ${entries.length - maxEntries} more properties`);
    }
    
    return parts.join('\n');
  }
}
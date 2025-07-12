import { GeneratedResponse } from '../types';

export type ColorType = 'success' | 'error' | 'info' | 'warning';

export interface ResponseFormatter {
  /**
   * Format a complete response for display
   */
  formatResponse(response: GeneratedResponse): string;

  /**
   * Format a successful response
   */
  formatSuccessResponse(response: GeneratedResponse): string;

  /**
   * Format an error response
   */
  formatErrorResponse(response: GeneratedResponse): string;

  /**
   * Format data for display
   */
  formatData(data: any): string;

  /**
   * Format suggestions for display
   */
  formatSuggestions(suggestions?: string[]): string;

  /**
   * Format metadata for display
   */
  formatMetadata(metadata: any): string;

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp: Date): string;

  /**
   * Apply color to text
   */
  colorize(text: string, color: ColorType): string;

  /**
   * Truncate data to reasonable display length
   */
  truncateData(data: any, maxLength: number): string;
}
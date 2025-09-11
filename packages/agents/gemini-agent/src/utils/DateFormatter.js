/**
 * Date formatting utilities
 */

export class DateFormatter {
  /**
   * Formats a date into ISO string with timezone
   * @param {Date} date - Date to format
   * @returns {string} Formatted date string
   */
  static toISOWithZone(date) {
    return date.toISOString();
  }

  /**
   * Formats a date into human readable format
   * @param {Date} date - Date to format 
   * @returns {string} Human readable date string
   */
  static toHumanReadable(date) {
    return date.toLocaleString();
  }

  /**
   * Calculates time difference between dates
   * @param {Date} start - Start date
   * @param {Date} end - End date
   * @returns {number} Difference in milliseconds
   */
  static getDifference(start, end) {
    return end.getTime() - start.getTime();
  }
}

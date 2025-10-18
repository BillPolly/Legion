/**
 * SentenceSplitter - Splits text into sentences
 */

export class SentenceSplitter {
  /**
   * Split text into sentences
   * @param {string} text - Input text
   * @returns {string[]} Array of sentences
   */
  split(text) {
    // Handle empty or whitespace-only text
    if (!text || !text.trim()) {
      return [];
    }

    // Normalize whitespace and newlines
    text = text.replace(/\s+/g, ' ').trim();

    // Split on sentence boundaries:
    // - Period, question mark, or exclamation followed by space and capital letter
    // - Or followed by end of string
    // But NOT if it's an abbreviation (single capital letter + period)
    const sentences = [];
    let current = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      const prevChar = text[i - 1];

      current += char;

      // Check if this is a sentence boundary
      if (char === '.' || char === '!' || char === '?') {
        const isEnd = i === text.length - 1;
        const nextIsSpace = nextChar === ' ';
        const afterSpaceIsCapital = i + 2 < text.length && text[i + 2] && text[i + 2].match(/[A-Z]/);

        // Check if this is an abbreviation (single capital letter before period)
        const isAbbreviation = char === '.' && prevChar && prevChar.match(/[A-Z]/) &&
                               (i < 2 || text[i - 2] === ' ' || text[i - 2] === '.');

        if (isEnd || (nextIsSpace && afterSpaceIsCapital && !isAbbreviation)) {
          // This is a sentence boundary
          sentences.push(current.trim());
          current = '';
          i++; // Skip the space
        }
      }
    }

    // Add any remaining text as the last sentence
    if (current.trim()) {
      sentences.push(current.trim());
    }

    return sentences.filter(s => s.length > 0);
  }
}

/**
 * WordNet Access Wrapper
 * Provides Promise-based access to WordNet data using the natural library
 */

import natural from 'natural';

export class WordNetAccess {
  constructor() {
    this.wordnet = new natural.WordNet();
  }

  async getSynset(offset, pos) {
    return new Promise((resolve, reject) => {
      this.wordnet.get(offset, pos, (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error(`Synset not found: ${offset}.${pos}`));
        }
      });
    });
  }

  async lookup(word) {
    return new Promise((resolve, reject) => {
      this.wordnet.lookup(word, (results) => {
        resolve(results || []);
      });
    });
  }

  /**
   * Get all synsets for a part of speech by reading index file directly
   * @param {string} pos - Part of speech (n, v, a, s, r)
   * @param {number|null} maxCount - Maximum number of synsets to return
   * @returns {Promise<Array>} Array of synset info objects
   */
  async getAllSynsets(pos, maxCount = null) {
    const fs = await import('fs');
    const readline = await import('readline');

    // Map pos to index file
    const posToFile = {
      'n': 'index.noun',
      'v': 'index.verb',
      'a': 'index.adj',
      's': 'index.adj', // Satellite adjectives in same file
      'r': 'index.adv'
    };

    const filename = posToFile[pos];
    if (!filename) {
      throw new Error(`Unknown POS: ${pos}`);
    }

    // Get index file path from wordnet instance
    const indexFilePath = this.wordnet.nounIndex.filePath.replace('index.noun', filename);

    const synsets = new Map();

    const fileStream = fs.createReadStream(indexFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineCount = 0;
    for await (const line of rl) {
      // Skip copyright header and empty lines
      if (line.trim() === '' || line.match(/^\s*\d+\s/)) {
        continue;
      }

      // Parse index line format: word pos sense_count ... offsets
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) continue;

      const word = parts[0];
      const wordPos = parts[1];
      const senseCount = parseInt(parts[2]);

      if (isNaN(senseCount) || senseCount === 0) continue;

      // Find offsets at end of line (8-digit numbers)
      const offsets = parts.slice(parts.length - senseCount).filter(p => /^\d{8}$/.test(p));

      // Add each synset
      for (const offset of offsets) {
        const offsetNum = parseInt(offset);
        const key = `${offsetNum}_${wordPos}`;

        if (!synsets.has(key)) {
          synsets.set(key, {
            offset: offsetNum,
            pos: wordPos,
            lemma: word
          });
        }

        if (maxCount && synsets.size >= maxCount) {
          rl.close();
          fileStream.destroy();
          console.log(`  Reached max count limit: ${maxCount}`);
          return Array.from(synsets.values());
        }
      }

      lineCount++;
      if (lineCount % 10000 === 0) {
        console.log(`  Processed ${lineCount} words, found ${synsets.size} unique synsets`);
      }
    }

    console.log(`  Total: ${lineCount} words, ${synsets.size} unique synsets for POS: ${pos}`);
    return Array.from(synsets.values());
  }
}

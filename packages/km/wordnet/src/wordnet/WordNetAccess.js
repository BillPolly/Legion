/**
 * WordNet Access Wrapper
 * Provides Promise-based access to WordNet data using the natural library
 */

import natural from 'natural';

export class WordNetAccess {
  constructor() {
    this.wordnet = natural.WordNet;
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

  async getValidForms(pos) {
    return new Promise((resolve) => {
      this.wordnet.validForms(pos, (forms) => {
        resolve(forms || []);
      });
    });
  }

  /**
   * Get all synsets for a part of speech
   * @param {string} pos - Part of speech (n, v, a, s, r)
   * @param {number|null} maxCount - Maximum number of synsets to return
   * @returns {Promise<Array>} Array of synset info objects
   */
  async getAllSynsets(pos, maxCount = null) {
    try {
      const forms = await this.getValidForms(pos);
      const synsets = new Map(); // Use Map to avoid duplicates
      let processedForms = 0;
      
      console.log(`Found ${forms.length} valid forms for POS: ${pos}`);
      
      for (const form of forms) {
        try {
          const results = await this.lookup(form);
          
          for (const result of results) {
            if (result.pos === pos) {
              const key = `${result.synsetOffset}_${result.pos}`;
              if (!synsets.has(key)) {
                synsets.set(key, {
                  offset: result.synsetOffset,
                  pos: result.pos,
                  lemma: form
                });
              }
            }
          }
          
          processedForms++;
          if (processedForms % 100 === 0) {
            console.log(`  Processed ${processedForms}/${forms.length} forms, found ${synsets.size} synsets`);
          }
          
          if (maxCount && synsets.size >= maxCount) {
            console.log(`  Reached max count limit: ${maxCount}`);
            break;
          }
          
        } catch (error) {
          console.warn(`  Warning: Could not process form "${form}": ${error.message}`);
        }
      }
      
      return Array.from(synsets.values());
      
    } catch (error) {
      console.error(`Error getting synsets for POS ${pos}:`, error);
      return [];
    }
  }
}

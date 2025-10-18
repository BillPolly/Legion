/**
 * Entity - Abstract discourse referent with canonical representation
 */
export class Entity {
  /**
   * @param {string} id - "x1", "x2", ...
   * @param {string} canonical - Canonical name
   * @param {Object} type - WordNet synset object with label, synonyms, definition, etc.
   * @param {string[]} mentions - Mention IDs that refer to this entity
   * @param {string} number - "SING" | "PLUR"
   * @param {string} gender - "MASC" | "FEM" | "NEUT" | "UNKNOWN"
   * @param {string} [kbId] - Optional WordNet synset ID
   */
  constructor(id, canonical, type, mentions, number, gender, kbId = null) {
    this.id = id;
    this.canonical = canonical;
    this.type = type;
    this.mentions = mentions;
    this.number = number;
    this.gender = gender;
    this.kbId = kbId;
  }
}

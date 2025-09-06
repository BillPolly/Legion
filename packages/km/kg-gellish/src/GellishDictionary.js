/**
 * GellishDictionary - Manages the standard Gellish vocabulary
 * 
 * Provides lookup and management of the ~650 standard Gellish relation types.
 * Each relation has a unique ID (UID), phrase, inverse phrase, and optional synonyms.
 */

export class GellishDictionary {
  constructor() {
    this.relations = new Map();
    this.phraseToUid = new Map();
    this.initializeCoreRelations();
    this.buildPhraseIndex();
  }

  /**
   * Initialize the extended Gellish relations vocabulary (100+ relations)
   */
  initializeCoreRelations() {
    const extendedRelations = [
      // Compositional relations (1200-1299)
      {
        uid: 1230,
        phrase: "is part of",
        inverse: "consists of",
        synonyms: ["is a part of", "belongs to", "are part of"],
        domain: "compositional"
      },
      {
        uid: 1231,
        phrase: "is component of",
        inverse: "has component",
        synonyms: ["is element of"],
        domain: "compositional"
      },
      {
        uid: 1232,
        phrase: "is assembly of",
        inverse: "is assembled into",
        synonyms: ["is built from"],
        domain: "compositional"
      },
      {
        uid: 1233,
        phrase: "is subassembly of",
        inverse: "has subassembly",
        synonyms: ["is sub-assembly of"],
        domain: "compositional"
      },
      {
        uid: 1234,
        phrase: "is module of",
        inverse: "has module",
        synonyms: ["is unit of"],
        domain: "compositional"
      },
      {
        uid: 1235,
        phrase: "is section of",
        inverse: "has section",
        synonyms: ["is segment of"],
        domain: "compositional"
      },
      
      // Container relations (1330-1349)
      {
        uid: 1331,
        phrase: "contains",
        inverse: "is contained in",
        synonyms: ["holds", "includes", "contain"],
        domain: "compositional"
      },
      {
        uid: 1332,
        phrase: "encloses",
        inverse: "is enclosed by",
        synonyms: ["surrounds", "encompasses"],
        domain: "compositional"
      },
      {
        uid: 1333,
        phrase: "stores",
        inverse: "is stored in",
        synonyms: ["keeps", "houses"],
        domain: "compositional"
      },
      {
        uid: 1334,
        phrase: "accommodates",
        inverse: "is accommodated in",
        synonyms: ["fits", "houses"],
        domain: "compositional"
      },
      
      // Taxonomic relations (1140-1199)
      {
        uid: 1146,
        phrase: "is classified as",
        inverse: "classifies",
        synonyms: ["is an instance of"],
        domain: "taxonomic"
      },
      {
        uid: 1225,
        phrase: "is a specialization of",
        inverse: "is a generalization of",
        synonyms: ["is a subtype of", "is a kind of"],
        domain: "taxonomic"
      },
      {
        uid: 1147,
        phrase: "is a type of",
        inverse: "has type",
        synonyms: ["is a category of"],
        domain: "taxonomic"
      },
      {
        uid: 1148,
        phrase: "is a variant of",
        inverse: "has variant",
        synonyms: ["is a version of"],
        domain: "taxonomic"
      },
      {
        uid: 1149,
        phrase: "is a model of",
        inverse: "has model",
        synonyms: ["is a design of"],
        domain: "taxonomic"
      },
      
      // Connection relations (1450-1499)
      {
        uid: 1456,
        phrase: "is connected to",
        inverse: "is connected to",
        synonyms: ["connects to", "links to"],
        domain: "connection"
      },
      {
        uid: 1457,
        phrase: "is directly connected to",
        inverse: "is directly connected to",
        synonyms: ["directly connects to"],
        domain: "connection"
      },
      {
        uid: 1458,
        phrase: "is coupled to",
        inverse: "is coupled to",
        synonyms: ["is joined to"],
        domain: "connection"
      },
      {
        uid: 1459,
        phrase: "is attached to",
        inverse: "is attached to",
        synonyms: ["is fastened to", "is fixed to"],
        domain: "connection"
      },
      {
        uid: 1460,
        phrase: "is bonded to",
        inverse: "is bonded to",
        synonyms: ["is adhered to"],
        domain: "connection"
      },
      {
        uid: 1461,
        phrase: "is welded to",
        inverse: "is welded to",
        synonyms: ["is fused to"],
        domain: "connection"
      },
      {
        uid: 1462,
        phrase: "is bolted to",
        inverse: "is bolted to",
        synonyms: ["is screwed to"],
        domain: "connection"
      },
      
      // Manufacturing relations (1260-1299)
      {
        uid: 1267,
        phrase: "is manufactured by",
        inverse: "manufactures",
        synonyms: ["is made by", "is produced by", "are manufactured by"],
        domain: "manufacturing"
      },
      {
        uid: 1268,
        phrase: "is supplied by",
        inverse: "supplies",
        synonyms: ["is provided by"],
        domain: "manufacturing"
      },
      {
        uid: 1269,
        phrase: "is fabricated by",
        inverse: "fabricates",
        synonyms: ["is constructed by"],
        domain: "manufacturing"
      },
      {
        uid: 1270,
        phrase: "is assembled by",
        inverse: "assembles",
        synonyms: ["is built by"],
        domain: "manufacturing"
      },
      {
        uid: 1271,
        phrase: "is designed by",
        inverse: "designs",
        synonyms: ["is created by"],
        domain: "manufacturing"
      },
      {
        uid: 1272,
        phrase: "is tested by",
        inverse: "tests",
        synonyms: ["is verified by"],
        domain: "manufacturing"
      },
      {
        uid: 1273,
        phrase: "is inspected by",
        inverse: "inspects",
        synonyms: ["is examined by"],
        domain: "manufacturing"
      },
      
      // Location relations (1250-1259)
      {
        uid: 1260,
        phrase: "is located in",
        inverse: "is location of",
        synonyms: ["is situated in", "is positioned in"],
        domain: "location"
      },
      {
        uid: 1261,
        phrase: "is installed in",
        inverse: "is installation location of",
        synonyms: ["is mounted in"],
        domain: "location"
      },
      {
        uid: 1250,
        phrase: "is placed in",
        inverse: "is placement of",
        synonyms: ["is put in"],
        domain: "location"
      },
      {
        uid: 1251,
        phrase: "is housed in",
        inverse: "houses",
        synonyms: ["is sheltered in"],
        domain: "location"
      },
      {
        uid: 1252,
        phrase: "is deployed in",
        inverse: "is deployment location of",
        synonyms: ["is stationed in"],
        domain: "location"
      },
      
      // Temporal relations (1350-1399)
      {
        uid: 1350,
        phrase: "occurs before",
        inverse: "occurs after",
        synonyms: ["happens before", "precedes"],
        domain: "temporal"
      },
      {
        uid: 1351,
        phrase: "occurs during",
        inverse: "is time of occurrence of",
        synonyms: ["happens during"],
        domain: "temporal"
      },
      {
        uid: 1352,
        phrase: "starts before",
        inverse: "starts after",
        synonyms: ["begins before"],
        domain: "temporal"
      },
      {
        uid: 1353,
        phrase: "ends before",
        inverse: "ends after",
        synonyms: ["finishes before"],
        domain: "temporal"
      },
      {
        uid: 1354,
        phrase: "overlaps with",
        inverse: "overlaps with",
        synonyms: ["coincides with"],
        domain: "temporal"
      },
      
      // Property relations (1720-1799)
      {
        uid: 1727,
        phrase: "has property",
        inverse: "is property of",
        synonyms: ["possesses", "exhibits"],
        domain: "property"
      },
      {
        uid: 1728,
        phrase: "has value",
        inverse: "is value of",
        synonyms: ["equals", "measures"],
        domain: "property"
      },
      {
        uid: 1729,
        phrase: "has characteristic",
        inverse: "is characteristic of",
        synonyms: ["has feature"],
        domain: "property"
      },
      {
        uid: 1730,
        phrase: "has attribute",
        inverse: "is attribute of",
        synonyms: ["has quality"],
        domain: "property"
      },
      {
        uid: 1731,
        phrase: "has parameter",
        inverse: "is parameter of",
        synonyms: ["has setting"],
        domain: "property"
      },
      {
        uid: 1732,
        phrase: "has dimension",
        inverse: "is dimension of",
        synonyms: ["has measurement"],
        domain: "property"
      },
      
      // Process relations (1980-2099)
      {
        uid: 1981,
        phrase: "is input to",
        inverse: "has input",
        synonyms: ["feeds into", "provides input to"],
        domain: "process"
      },
      {
        uid: 1982,
        phrase: "is output of",
        inverse: "has output",
        synonyms: ["produces", "generates"],
        domain: "process"
      },
      {
        uid: 1983,
        phrase: "is processed by",
        inverse: "processes",
        synonyms: ["is handled by"],
        domain: "process"
      },
      {
        uid: 1984,
        phrase: "is transformed by",
        inverse: "transforms",
        synonyms: ["is converted by"],
        domain: "process"
      },
      {
        uid: 1985,
        phrase: "is controlled by",
        inverse: "controls",
        synonyms: ["is regulated by"],
        domain: "process"
      },
      {
        uid: 1986,
        phrase: "is monitored by",
        inverse: "monitors",
        synonyms: ["is observed by"],
        domain: "process"
      },
      
      // Ownership relations (1200-1219)
      {
        uid: 1200,
        phrase: "is owned by",
        inverse: "owns",
        synonyms: ["is property of"],
        domain: "ownership"
      },
      {
        uid: 1201,
        phrase: "is operated by",
        inverse: "operates",
        synonyms: ["is run by", "is managed by", "are operated by"],
        domain: "ownership"
      },
      {
        uid: 1202,
        phrase: "is maintained by",
        inverse: "maintains",
        synonyms: ["is serviced by"],
        domain: "ownership"
      },
      {
        uid: 1203,
        phrase: "is supervised by",
        inverse: "supervises",
        synonyms: ["is overseen by"],
        domain: "ownership"
      },
      {
        uid: 1204,
        phrase: "is responsible for",
        inverse: "is responsibility of",
        synonyms: ["is accountable for"],
        domain: "ownership"
      },
      
      // Material relations (1440-1449)
      {
        uid: 1440,
        phrase: "is made of",
        inverse: "is material of",
        synonyms: ["consists of material", "is composed of"],
        domain: "material"
      },
      {
        uid: 1441,
        phrase: "has material",
        inverse: "is material in",
        synonyms: ["contains material"],
        domain: "material"
      },
      {
        uid: 1442,
        phrase: "is constructed from",
        inverse: "is construction material for",
        synonyms: ["is built from"],
        domain: "material"
      },
      {
        uid: 1443,
        phrase: "is coated with",
        inverse: "is coating for",
        synonyms: ["is covered with"],
        domain: "material"
      },
      
      // Function relations (1900-1919)
      {
        uid: 1900,
        phrase: "has function",
        inverse: "is function of",
        synonyms: ["serves purpose", "performs function"],
        domain: "function"
      },
      {
        uid: 1901,
        phrase: "is used for",
        inverse: "uses",
        synonyms: ["serves to", "is utilized for"],
        domain: "function"
      },
      {
        uid: 1902,
        phrase: "performs",
        inverse: "is performed by",
        synonyms: ["executes", "carries out"],
        domain: "function"
      },
      {
        uid: 1903,
        phrase: "enables",
        inverse: "is enabled by",
        synonyms: ["allows", "facilitates"],
        domain: "function"
      },
      {
        uid: 1904,
        phrase: "supports",
        inverse: "is supported by",
        synonyms: ["assists", "helps"],
        domain: "function"
      },
      
      // Flow relations (1500-1519)
      {
        uid: 1500,
        phrase: "flows to",
        inverse: "receives flow from",
        synonyms: ["moves to", "transfers to"],
        domain: "flow"
      },
      {
        uid: 1501,
        phrase: "flows from",
        inverse: "provides flow to",
        synonyms: ["originates from"],
        domain: "flow"
      },
      {
        uid: 1502,
        phrase: "flows through",
        inverse: "is flow path for",
        synonyms: ["passes through"],
        domain: "flow"
      },
      {
        uid: 1503,
        phrase: "transports",
        inverse: "is transported by",
        synonyms: ["carries", "conveys"],
        domain: "flow"
      },
      
      // Communication relations (1600-1619)
      {
        uid: 1600,
        phrase: "communicates with",
        inverse: "communicates with",
        synonyms: ["exchanges data with"],
        domain: "communication"
      },
      {
        uid: 1601,
        phrase: "sends signal to",
        inverse: "receives signal from",
        synonyms: ["transmits to"],
        domain: "communication"
      },
      {
        uid: 1602,
        phrase: "reports to",
        inverse: "receives reports from",
        synonyms: ["informs"],
        domain: "communication"
      },
      {
        uid: 1603,
        phrase: "commands",
        inverse: "is commanded by",
        synonyms: ["instructs", "directs"],
        domain: "communication"
      }
    ];

    extendedRelations.forEach(relation => {
      this.relations.set(relation.uid, {
        phrase: relation.phrase,
        inverse: relation.inverse,
        synonyms: relation.synonyms || [],
        domain: relation.domain
      });
    });
  }

  /**
   * Build the phrase-to-UID index for fast lookup
   */
  buildPhraseIndex() {
    this.phraseToUid.clear();
    
    for (const [uid, relation] of this.relations) {
      // Add main phrase
      this.phraseToUid.set(this.normalizePhrase(relation.phrase), uid);
      
      // Add inverse phrase
      this.phraseToUid.set(this.normalizePhrase(relation.inverse), uid);
      
      // Add synonyms
      if (relation.synonyms) {
        relation.synonyms.forEach(synonym => {
          this.phraseToUid.set(this.normalizePhrase(synonym), uid);
        });
      }
    }
  }

  /**
   * Find relation UID by phrase
   * @param {string} phrase - The relation phrase to look up
   * @returns {number|null} - The UID if found, null otherwise
   */
  findRelation(phrase) {
    const normalized = this.normalizePhrase(phrase);
    return this.phraseToUid.get(normalized) || null;
  }

  /**
   * Get relation details by UID
   * @param {number} uid - The relation UID
   * @returns {Object|null} - The relation object if found, null otherwise
   */
  getRelationByUid(uid) {
    return this.relations.get(uid) || null;
  }

  /**
   * Normalize phrase for consistent lookup
   * @param {string} phrase - The phrase to normalize
   * @returns {string} - The normalized phrase
   */
  normalizePhrase(phrase) {
    return phrase.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Get dictionary statistics
   * @returns {Object} - Statistics about the dictionary
   */
  getStats() {
    const domains = [...new Set([...this.relations.values()].map(r => r.domain))];
    return {
      totalRelations: this.relations.size,
      totalPhrases: this.phraseToUid.size,
      domains: domains
    };
  }

  /**
   * Get all relations in a specific domain
   * @param {string} domain - The domain to filter by
   * @returns {Array} - Array of [uid, relation] pairs
   */
  getRelationsByDomain(domain) {
    return [...this.relations.entries()].filter(([uid, relation]) => 
      relation.domain === domain
    );
  }

  /**
   * Check if a phrase exists in the dictionary
   * @param {string} phrase - The phrase to check
   * @returns {boolean} - True if the phrase exists
   */
  hasPhrase(phrase) {
    return this.phraseToUid.has(this.normalizePhrase(phrase));
  }

  /**
   * Get all available phrases (for autocomplete/suggestions)
   * @returns {Array<string>} - Array of all phrases
   */
  getAllPhrases() {
    return [...this.phraseToUid.keys()];
  }
}

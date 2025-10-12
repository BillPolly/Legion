/**
 * Geography Ontology
 *
 * Defines classes, properties, and individuals for geographical domain.
 * Used for testing query understanding pipeline.
 */

export const geographyOntology = {
  classes: [
    {
      iri: ':Country',
      label: 'Country',
      description: 'A nation state or sovereign territory',
      synonyms: ['nation', 'state', 'country', 'countries'],
      domain: 'geography'
    },
    {
      iri: ':City',
      label: 'City',
      description: 'An urban settlement or municipality',
      synonyms: ['town', 'municipality', 'metropolis', 'cities'],
      domain: 'geography'
    },
    {
      iri: ':River',
      label: 'River',
      description: 'A natural watercourse flowing towards an ocean, sea, lake or another river',
      synonyms: ['stream', 'waterway', 'rivers'],
      domain: 'geography'
    },
    {
      iri: ':Mountain',
      label: 'Mountain',
      description: 'A large natural elevation of the earth\'s surface',
      synonyms: ['peak', 'mount', 'summit', 'mountains'],
      domain: 'geography'
    },
    {
      iri: ':Continent',
      label: 'Continent',
      description: 'One of the world\'s main continuous expanses of land',
      synonyms: ['landmass', 'continents'],
      domain: 'geography'
    },
    {
      iri: ':Ocean',
      label: 'Ocean',
      description: 'A very large expanse of sea',
      synonyms: ['sea', 'oceans'],
      domain: 'geography'
    },
    {
      iri: ':Lake',
      label: 'Lake',
      description: 'A large body of water surrounded by land',
      synonyms: ['pond', 'reservoir', 'lakes'],
      domain: 'geography'
    }
  ],

  properties: [
    {
      iri: ':borders',
      label: 'borders',
      description: 'Shares a border with',
      synonyms: ['border', 'adjacent', 'neighbor', 'neighbours', 'next to', 'share', 'shares', 'sharing'],
      domain: 'geography',
      propertyType: 'spatial',
      domainClasses: [':Country'],
      rangeClasses: [':Country']
    },
    {
      iri: ':capital',
      label: 'capital',
      description: 'Has capital city',
      synonyms: ['capital city'],
      domain: 'geography',
      propertyType: 'relation',
      domainClasses: [':Country'],
      rangeClasses: [':City']
    },
    {
      iri: ':population',
      label: 'population',
      description: 'Number of inhabitants',
      synonyms: ['inhabitants', 'people', 'residents'],
      domain: 'geography',
      propertyType: 'dataProperty',
      domainClasses: [':Country', ':City'],
      rangeType: 'integer'
    },
    {
      iri: ':area',
      label: 'area',
      description: 'Surface area in square kilometers',
      synonyms: ['size', 'square kilometers'],
      domain: 'geography',
      propertyType: 'dataProperty',
      domainClasses: [':Country', ':City', ':Lake'],
      rangeType: 'float'
    },
    {
      iri: ':locatedIn',
      label: 'located in',
      description: 'Is geographically located within',
      synonyms: ['in', 'within', 'part of'],
      domain: 'geography',
      propertyType: 'spatial',
      domainClasses: [':City', ':Mountain', ':River', ':Lake'],
      rangeClasses: [':Country', ':Continent']
    },
    {
      iri: ':flowsThrough',
      label: 'flows through',
      description: 'River flows through this location',
      synonyms: ['runs through', 'passes through'],
      domain: 'geography',
      propertyType: 'spatial',
      domainClasses: [':River'],
      rangeClasses: [':Country', ':City']
    },
    {
      iri: ':height',
      label: 'height',
      description: 'Elevation in meters',
      synonyms: ['elevation', 'altitude'],
      domain: 'geography',
      propertyType: 'dataProperty',
      domainClasses: [':Mountain'],
      rangeType: 'float'
    },
    {
      iri: ':length',
      label: 'length',
      description: 'Length in kilometers',
      synonyms: ['long', 'distance'],
      domain: 'geography',
      propertyType: 'dataProperty',
      domainClasses: [':River'],
      rangeType: 'float'
    }
  ],

  individuals: [
    // Countries
    {
      iri: ':Germany',
      label: 'Germany',
      aliases: ['Deutschland', 'DE', 'Federal Republic of Germany'],
      domain: 'geography',
      instanceOf: ':Country'
    },
    {
      iri: ':France',
      label: 'France',
      aliases: ['FR', 'French Republic'],
      domain: 'geography',
      instanceOf: ':Country'
    },
    {
      iri: ':Italy',
      label: 'Italy',
      aliases: ['IT', 'Italian Republic'],
      domain: 'geography',
      instanceOf: ':Country'
    },
    {
      iri: ':Switzerland',
      label: 'Switzerland',
      aliases: ['CH', 'Swiss Confederation'],
      domain: 'geography',
      instanceOf: ':Country'
    },
    {
      iri: ':Austria',
      label: 'Austria',
      aliases: ['AT', 'Republic of Austria'],
      domain: 'geography',
      instanceOf: ':Country'
    },
    {
      iri: ':Poland',
      label: 'Poland',
      aliases: ['PL', 'Republic of Poland'],
      domain: 'geography',
      instanceOf: ':Country'
    },
    {
      iri: ':Spain',
      label: 'Spain',
      aliases: ['ES', 'Kingdom of Spain'],
      domain: 'geography',
      instanceOf: ':Country'
    },
    {
      iri: ':USA',
      label: 'United States',
      aliases: ['USA', 'US', 'United States of America', 'America'],
      domain: 'geography',
      instanceOf: ':Country'
    },
    {
      iri: ':UK',
      label: 'United Kingdom',
      aliases: ['UK', 'GB', 'Great Britain', 'Britain', 'England'],
      domain: 'geography',
      instanceOf: ':Country'
    },

    // Cities
    {
      iri: ':Berlin',
      label: 'Berlin',
      aliases: [],
      domain: 'geography',
      instanceOf: ':City'
    },
    {
      iri: ':Paris',
      label: 'Paris',
      aliases: [],
      domain: 'geography',
      instanceOf: ':City'
    },
    {
      iri: ':Rome',
      label: 'Rome',
      aliases: ['Roma'],
      domain: 'geography',
      instanceOf: ':City'
    },
    {
      iri: ':London',
      label: 'London',
      aliases: [],
      domain: 'geography',
      instanceOf: ':City'
    },
    {
      iri: ':Madrid',
      label: 'Madrid',
      aliases: [],
      domain: 'geography',
      instanceOf: ':City'
    },

    // Rivers
    {
      iri: ':Rhine',
      label: 'Rhine',
      aliases: ['Rhine River', 'Rhein'],
      domain: 'geography',
      instanceOf: ':River'
    },
    {
      iri: ':Danube',
      label: 'Danube',
      aliases: ['Danube River', 'Donau'],
      domain: 'geography',
      instanceOf: ':River'
    },
    {
      iri: ':Seine',
      label: 'Seine',
      aliases: ['Seine River'],
      domain: 'geography',
      instanceOf: ':River'
    },

    // Mountains
    {
      iri: ':MontBlanc',
      label: 'Mont Blanc',
      aliases: ['Monte Bianco'],
      domain: 'geography',
      instanceOf: ':Mountain'
    },
    {
      iri: ':Matterhorn',
      label: 'Matterhorn',
      aliases: ['Monte Cervino'],
      domain: 'geography',
      instanceOf: ':Mountain'
    },

    // Continents
    {
      iri: ':Europe',
      label: 'Europe',
      aliases: [],
      domain: 'geography',
      instanceOf: ':Continent'
    },
    {
      iri: ':Asia',
      label: 'Asia',
      aliases: [],
      domain: 'geography',
      instanceOf: ':Continent'
    },
    {
      iri: ':NorthAmerica',
      label: 'North America',
      aliases: ['N. America'],
      domain: 'geography',
      instanceOf: ':Continent'
    }
  ]
};

/**
 * Real-World Use Cases Tests for @legion/rdf
 * 
 * Tests RDF package integration with realistic data and scenarios:
 * - DBpedia data structures and queries
 * - Schema.org vocabulary integration
 * - Persistent storage scenarios
 * - Live synchronization across handles
 * - Performance with real-world dataset sizes
 * - Cross-vocabulary data integration
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { RDFDataSource } from '../../src/RDFDataSource.js';
import { RDFHandle } from '../../src/RDFHandle.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';
import { RDFSchemaExtractor } from '../../src/RDFSchemaExtractor.js';

describe('Real-World Use Cases Integration', () => {
  let tripleStore;
  let namespaceManager;
  let rdfDataSource;
  let schemaExtractor;
  
  beforeEach(() => {
    // Create RDF infrastructure
    tripleStore = new SimpleTripleStore();
    namespaceManager = new NamespaceManager();
    
    // Add real-world namespaces
    namespaceManager.addNamespace('dbr', 'http://dbpedia.org/resource/');
    namespaceManager.addNamespace('dbo', 'http://dbpedia.org/ontology/');
    namespaceManager.addNamespace('dbp', 'http://dbpedia.org/property/');
    namespaceManager.addNamespace('schema', 'http://schema.org/');
    namespaceManager.addNamespace('wdt', 'http://wikidata.org/prop/direct/');
    namespaceManager.addNamespace('wd', 'http://wikidata.org/entity/');
    namespaceManager.addNamespace('org', 'http://www.w3.org/ns/org#');
    namespaceManager.addNamespace('vcard', 'http://www.w3.org/2006/vcard/ns#');
    
    rdfDataSource = new RDFDataSource(tripleStore, namespaceManager);
    schemaExtractor = new RDFSchemaExtractor(tripleStore, namespaceManager);
  });
  
  afterEach(() => {
    // Clean up any handles and subscriptions
    tripleStore.clear();
  });
  
  describe('DBpedia Integration', () => {
    test('should handle DBpedia person data structure', () => {
      // Simulate DBpedia data for Albert Einstein
      tripleStore.add('dbr:Albert_Einstein', 'rdf:type', 'dbo:Person');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:birthName', 'Albert Einstein');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:birthDate', '1879-03-14');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:birthPlace', 'dbr:Ulm');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:deathDate', '1955-04-18');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:deathPlace', 'dbr:Princeton,_New_Jersey');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:occupation', 'dbr:Theoretical_physicist');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:knownFor', 'dbr:Theory_of_relativity');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:award', 'dbr:Nobel_Prize_in_Physics');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:spouse', 'dbr:Mileva_Marić');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:spouse', 'dbr:Elsa_Einstein');
      
      const einstein = new RDFHandle(rdfDataSource, 'dbr:Albert_Einstein');
      const data = einstein.value();
      
      expect(data).toBeDefined();
      expect(data['rdf:type']).toBe('dbo:Person');
      expect(data['dbo:birthName']).toBe('Albert Einstein');
      expect(data['dbo:birthDate']).toBe('1879-03-14');
      expect(data['dbo:birthPlace']).toBe('dbr:Ulm');
      expect(data['dbo:occupation']).toBe('dbr:Theoretical_physicist');
      expect(Array.isArray(data['dbo:spouse'])).toBe(true);
      expect(data['dbo:spouse']).toContain('dbr:Mileva_Marić');
      expect(data['dbo:spouse']).toContain('dbr:Elsa_Einstein');
      
      einstein.destroy();
    });
    
    test('should navigate DBpedia relationships', () => {
      // Einstein and related entities
      tripleStore.add('dbr:Albert_Einstein', 'rdf:type', 'dbo:Person');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:birthPlace', 'dbr:Ulm');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:occupation', 'dbr:Theoretical_physicist');
      
      // Place information
      tripleStore.add('dbr:Ulm', 'rdf:type', 'dbo:City');
      tripleStore.add('dbr:Ulm', 'dbo:country', 'dbr:Germany');
      tripleStore.add('dbr:Ulm', 'dbo:populationTotal', 126329);
      
      // Occupation information
      tripleStore.add('dbr:Theoretical_physicist', 'rdf:type', 'dbo:Profession');
      tripleStore.add('dbr:Theoretical_physicist', 'dbo:field', 'dbr:Physics');
      
      const einstein = new RDFHandle(rdfDataSource, 'dbr:Albert_Einstein');
      
      // Navigate to birth place
      const birthPlace = einstein.followLink('dbo:birthPlace');
      expect(birthPlace).toBeInstanceOf(RDFHandle);
      expect(birthPlace.getURI()).toBe('dbr:Ulm');
      
      const placeData = birthPlace.value();
      expect(placeData['rdf:type']).toBe('dbo:City');
      expect(placeData['dbo:country']).toBe('dbr:Germany');
      expect(placeData['dbo:populationTotal']).toBe(126329);
      
      // Navigate to occupation
      const occupation = einstein.followLink('dbo:occupation');
      expect(occupation).toBeInstanceOf(RDFHandle);
      
      const occupationData = occupation.value();
      expect(occupationData['rdf:type']).toBe('dbo:Profession');
      expect(occupationData['dbo:field']).toBe('dbr:Physics');
      
      einstein.destroy();
      birthPlace.destroy();
      occupation.destroy();
    });
    
    test('should query DBpedia-style data patterns', () => {
      // Multiple scientists from DBpedia
      tripleStore.add('dbr:Albert_Einstein', 'rdf:type', 'dbo:Person');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:occupation', 'dbr:Theoretical_physicist');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:birthDate', '1879-03-14');
      tripleStore.add('dbr:Albert_Einstein', 'dbo:deathDate', '1955-04-18');
      
      tripleStore.add('dbr:Marie_Curie', 'rdf:type', 'dbo:Person');
      tripleStore.add('dbr:Marie_Curie', 'dbo:occupation', 'dbr:Physicist');
      tripleStore.add('dbr:Marie_Curie', 'dbo:birthDate', '1867-11-07');
      tripleStore.add('dbr:Marie_Curie', 'dbo:deathDate', '1934-07-04');
      
      tripleStore.add('dbr:Stephen_Hawking', 'rdf:type', 'dbo:Person');
      tripleStore.add('dbr:Stephen_Hawking', 'dbo:occupation', 'dbr:Theoretical_physicist');
      tripleStore.add('dbr:Stephen_Hawking', 'dbo:birthDate', '1942-01-08');
      tripleStore.add('dbr:Stephen_Hawking', 'dbo:deathDate', '2018-03-14');
      
      // Query for all theoretical physicists
      const query = {
        find: ['?person', '?birthDate', '?deathDate'],
        where: [
          ['?person', 'rdf:type', 'dbo:Person'],
          ['?person', 'dbo:occupation', 'dbr:Theoretical_physicist'],
          ['?person', 'dbo:birthDate', '?birthDate'],
          ['?person', 'dbo:deathDate', '?deathDate']
        ]
      };
      
      const results = rdfDataSource.query(query);
      expect(results).toHaveLength(2);
      
      const scientists = results.map(r => r.person);
      expect(scientists).toContain('dbr:Albert_Einstein');
      expect(scientists).toContain('dbr:Stephen_Hawking');
      expect(scientists).not.toContain('dbr:Marie_Curie'); // She's a physicist, not theoretical physicist
      
      // Verify birth dates are correct
      const einsteinResult = results.find(r => r.person === 'dbr:Albert_Einstein');
      expect(einsteinResult.birthDate).toBe('1879-03-14');
      expect(einsteinResult.deathDate).toBe('1955-04-18');
    });
  });
  
  describe('Schema.org Integration', () => {
    test('should handle Schema.org organization data', () => {
      // Schema.org organization structure
      tripleStore.add('schema:acme-corp', 'rdf:type', 'schema:Organization');
      tripleStore.add('schema:acme-corp', 'schema:name', 'Acme Corporation');
      tripleStore.add('schema:acme-corp', 'schema:url', 'https://acme.com');
      tripleStore.add('schema:acme-corp', 'schema:foundingDate', '1995-06-15');
      tripleStore.add('schema:acme-corp', 'schema:numberOfEmployees', 500);
      tripleStore.add('schema:acme-corp', 'schema:industry', 'Technology');
      tripleStore.add('schema:acme-corp', 'schema:address', 'schema:acme-address');
      tripleStore.add('schema:acme-corp', 'schema:employee', 'schema:john-doe');
      tripleStore.add('schema:acme-corp', 'schema:employee', 'schema:jane-smith');
      
      // Address information
      tripleStore.add('schema:acme-address', 'rdf:type', 'schema:PostalAddress');
      tripleStore.add('schema:acme-address', 'schema:streetAddress', '123 Tech Street');
      tripleStore.add('schema:acme-address', 'schema:addressLocality', 'San Francisco');
      tripleStore.add('schema:acme-address', 'schema:addressRegion', 'CA');
      tripleStore.add('schema:acme-address', 'schema:postalCode', '94105');
      tripleStore.add('schema:acme-address', 'schema:addressCountry', 'US');
      
      const org = new RDFHandle(rdfDataSource, 'schema:acme-corp');
      const orgData = org.value();
      
      expect(orgData['rdf:type']).toBe('schema:Organization');
      expect(orgData['schema:name']).toBe('Acme Corporation');
      expect(orgData['schema:url']).toBe('https://acme.com');
      expect(orgData['schema:foundingDate']).toBe('1995-06-15');
      expect(orgData['schema:numberOfEmployees']).toBe(500);
      expect(orgData['schema:industry']).toBe('Technology');
      
      // Navigate to address
      const address = org.followLink('schema:address');
      expect(address).toBeInstanceOf(RDFHandle);
      
      const addressData = address.value();
      expect(addressData['rdf:type']).toBe('schema:PostalAddress');
      expect(addressData['schema:streetAddress']).toBe('123 Tech Street');
      expect(addressData['schema:addressLocality']).toBe('San Francisco');
      expect(addressData['schema:postalCode']).toBe('94105');
      
      org.destroy();
      address.destroy();
    });
    
    test('should handle Schema.org event data with structured properties', () => {
      // Schema.org event with detailed structure
      tripleStore.add('schema:tech-conference-2024', 'rdf:type', 'schema:Event');
      tripleStore.add('schema:tech-conference-2024', 'schema:name', 'Tech Conference 2024');
      tripleStore.add('schema:tech-conference-2024', 'schema:description', 'Annual technology conference');
      tripleStore.add('schema:tech-conference-2024', 'schema:startDate', '2024-09-15T09:00:00');
      tripleStore.add('schema:tech-conference-2024', 'schema:endDate', '2024-09-17T17:00:00');
      tripleStore.add('schema:tech-conference-2024', 'schema:location', 'schema:conference-venue');
      tripleStore.add('schema:tech-conference-2024', 'schema:organizer', 'schema:acme-corp');
      tripleStore.add('schema:tech-conference-2024', 'schema:offers', 'schema:ticket-offer');
      
      // Venue information
      tripleStore.add('schema:conference-venue', 'rdf:type', 'schema:Place');
      tripleStore.add('schema:conference-venue', 'schema:name', 'Convention Center');
      tripleStore.add('schema:conference-venue', 'schema:address', 'schema:venue-address');
      
      tripleStore.add('schema:venue-address', 'rdf:type', 'schema:PostalAddress');
      tripleStore.add('schema:venue-address', 'schema:streetAddress', '456 Convention Blvd');
      tripleStore.add('schema:venue-address', 'schema:addressLocality', 'Las Vegas');
      tripleStore.add('schema:venue-address', 'schema:addressRegion', 'NV');
      
      // Ticket offer
      tripleStore.add('schema:ticket-offer', 'rdf:type', 'schema:Offer');
      tripleStore.add('schema:ticket-offer', 'schema:price', '299.00');
      tripleStore.add('schema:ticket-offer', 'schema:priceCurrency', 'USD');
      tripleStore.add('schema:ticket-offer', 'schema:availability', 'schema:InStock');
      
      const event = new RDFHandle(rdfDataSource, 'schema:tech-conference-2024');
      const eventData = event.value();
      
      expect(eventData['rdf:type']).toBe('schema:Event');
      expect(eventData['schema:name']).toBe('Tech Conference 2024');
      expect(eventData['schema:startDate']).toBe('2024-09-15T09:00:00');
      expect(eventData['schema:endDate']).toBe('2024-09-17T17:00:00');
      
      // Navigate to venue
      const venue = event.followLink('schema:location');
      expect(venue).toBeInstanceOf(RDFHandle);
      
      const venueData = venue.value();
      expect(venueData['schema:name']).toBe('Convention Center');
      
      // Navigate to venue address
      const venueAddress = venue.followLink('schema:address');
      const addressData = venueAddress.value();
      expect(addressData['schema:addressLocality']).toBe('Las Vegas');
      
      // Navigate to ticket offer
      const offer = event.followLink('schema:offers');
      const offerData = offer.value();
      expect(offerData['schema:price']).toBe('299.00');
      expect(offerData['schema:priceCurrency']).toBe('USD');
      
      event.destroy();
      venue.destroy();
      venueAddress.destroy();
      offer.destroy();
    });
    
    test('should extract Schema.org vocabulary schema', () => {
      // Add Schema.org ontology subset
      tripleStore.add('schema:Organization', 'rdf:type', 'rdfs:Class');
      tripleStore.add('schema:name', 'rdf:type', 'rdf:Property');
      tripleStore.add('schema:name', 'rdfs:domain', 'schema:Organization');
      tripleStore.add('schema:name', 'rdfs:range', 'xsd:string');
      
      tripleStore.add('schema:employee', 'rdf:type', 'rdf:Property');
      tripleStore.add('schema:employee', 'rdfs:domain', 'schema:Organization');
      tripleStore.add('schema:employee', 'rdfs:range', 'schema:Person');
      
      tripleStore.add('schema:Person', 'rdf:type', 'rdfs:Class');
      tripleStore.add('schema:givenName', 'rdf:type', 'rdf:Property');
      tripleStore.add('schema:givenName', 'rdfs:domain', 'schema:Person');
      tripleStore.add('schema:givenName', 'rdfs:range', 'xsd:string');
      
      const schema = schemaExtractor.extractSchema();
      
      // RDFSchemaExtractor produces entity/attribute format
      expect(schema).toHaveProperty('Organization/name');
      expect(schema).toHaveProperty('Organization/employee');
      expect(schema).toHaveProperty('Person/givenName');
      
      // Verify schema structure for Organization properties
      const orgNameSchema = schema['Organization/name'];
      expect(orgNameSchema.type).toBe('string');
      expect(orgNameSchema.cardinality).toBe('many');
      
      const orgEmployeeSchema = schema['Organization/employee'];
      expect(orgEmployeeSchema.type).toBe('ref');
      expect(orgEmployeeSchema.cardinality).toBe('many');
      expect(orgEmployeeSchema.ref).toBe('Person');
      
      // Verify schema structure for Person properties
      const personNameSchema = schema['Person/givenName'];
      expect(personNameSchema.type).toBe('string');
      expect(personNameSchema.cardinality).toBe('many');
    });
  });
  
  describe('Cross-Vocabulary Integration', () => {
    test('should handle data mixing DBpedia and Schema.org vocabularies', () => {
      // Person described using both vocabularies
      tripleStore.add('ex:tim-berners-lee', 'rdf:type', 'foaf:Person');
      tripleStore.add('ex:tim-berners-lee', 'rdf:type', 'schema:Person');
      tripleStore.add('ex:tim-berners-lee', 'foaf:name', 'Tim Berners-Lee');
      tripleStore.add('ex:tim-berners-lee', 'schema:givenName', 'Tim');
      tripleStore.add('ex:tim-berners-lee', 'schema:familyName', 'Berners-Lee');
      tripleStore.add('ex:tim-berners-lee', 'dbo:birthDate', '1955-06-08');
      tripleStore.add('ex:tim-berners-lee', 'schema:birthDate', '1955-06-08');
      tripleStore.add('ex:tim-berners-lee', 'dbo:knownFor', 'dbr:World_Wide_Web');
      tripleStore.add('ex:tim-berners-lee', 'schema:jobTitle', 'Director');
      tripleStore.add('ex:tim-berners-lee', 'schema:worksFor', 'ex:w3c');
      
      // Organization using Schema.org
      tripleStore.add('ex:w3c', 'rdf:type', 'schema:Organization');
      tripleStore.add('ex:w3c', 'schema:name', 'World Wide Web Consortium');
      tripleStore.add('ex:w3c', 'schema:url', 'https://www.w3.org/');
      
      const person = new RDFHandle(rdfDataSource, 'ex:tim-berners-lee');
      const personData = person.value();
      
      // Should have data from multiple vocabularies
      expect(Array.isArray(personData['rdf:type'])).toBe(true);
      expect(personData['rdf:type']).toContain('foaf:Person');
      expect(personData['rdf:type']).toContain('schema:Person');
      
      expect(personData['foaf:name']).toBe('Tim Berners-Lee');
      expect(personData['schema:givenName']).toBe('Tim');
      expect(personData['schema:familyName']).toBe('Berners-Lee');
      
      // Both vocabularies have birth date
      expect(personData['dbo:birthDate']).toBe('1955-06-08');
      expect(personData['schema:birthDate']).toBe('1955-06-08');
      
      // Navigate to organization
      const org = person.followLink('schema:worksFor');
      expect(org).toBeInstanceOf(RDFHandle);
      
      const orgData = org.value();
      expect(orgData['schema:name']).toBe('World Wide Web Consortium');
      expect(orgData['schema:url']).toBe('https://www.w3.org/');
      
      person.destroy();
      org.destroy();
    });
    
    test('should query across multiple vocabularies', () => {
      // Data using FOAF, Schema.org, and DBpedia
      tripleStore.add('ex:person1', 'rdf:type', 'foaf:Person');
      tripleStore.add('ex:person1', 'foaf:name', 'John Doe');
      tripleStore.add('ex:person1', 'schema:jobTitle', 'Software Engineer');
      tripleStore.add('ex:person1', 'dbo:birthPlace', 'dbr:New_York');
      
      tripleStore.add('ex:person2', 'rdf:type', 'schema:Person');
      tripleStore.add('ex:person2', 'schema:name', 'Jane Smith');
      tripleStore.add('ex:person2', 'schema:jobTitle', 'Product Manager');
      tripleStore.add('ex:person2', 'dbo:birthPlace', 'dbr:San_Francisco');
      
      tripleStore.add('ex:person3', 'rdf:type', 'foaf:Person');
      tripleStore.add('ex:person3', 'foaf:name', 'Bob Wilson');
      tripleStore.add('ex:person3', 'schema:jobTitle', 'Software Engineer');
      tripleStore.add('ex:person3', 'dbo:birthPlace', 'dbr:Seattle');
      
      // Query for all software engineers regardless of vocabulary
      const query = {
        find: ['?person', '?name', '?birthPlace'],
        where: [
          ['?person', 'schema:jobTitle', 'Software Engineer'],
          ['?person', 'dbo:birthPlace', '?birthPlace']
        ]
      };
      
      const results = rdfDataSource.query(query);
      expect(results).toHaveLength(2);
      
      const engineers = results.map(r => r.person);
      expect(engineers).toContain('ex:person1');
      expect(engineers).toContain('ex:person3');
      expect(engineers).not.toContain('ex:person2'); // Product Manager
      
      // Add name to query to test cross-vocabulary name handling
      const detailQuery = {
        find: ['?person', '?anyName'],
        where: [
          ['?person', 'schema:jobTitle', 'Software Engineer']
        ]
      };
      
      const detailResults = rdfDataSource.query(detailQuery);
      expect(detailResults).toHaveLength(2);
    });
  });
  
  describe('Performance with Real-World Data Sizes', () => {
    test('should handle moderate dataset (1000 triples) efficiently', () => {
      const startTime = Date.now();
      
      // Create 100 people with 10 properties each (1000 triples)
      for (let i = 0; i < 100; i++) {
        const personUri = `ex:person${i}`;
        tripleStore.add(personUri, 'rdf:type', 'foaf:Person');
        tripleStore.add(personUri, 'foaf:name', `Person ${i}`);
        tripleStore.add(personUri, 'foaf:age', 20 + (i % 60));
        tripleStore.add(personUri, 'foaf:email', `person${i}@example.com`);
        tripleStore.add(personUri, 'schema:jobTitle', i % 2 === 0 ? 'Engineer' : 'Manager');
        tripleStore.add(personUri, 'schema:department', i % 3 === 0 ? 'Tech' : i % 3 === 1 ? 'Sales' : 'Marketing');
        tripleStore.add(personUri, 'dbo:birthYear', 1960 + (i % 40));
        tripleStore.add(personUri, 'org:memberOf', `ex:team${Math.floor(i / 10)}`);
        tripleStore.add(personUri, 'vcard:hasAddress', `ex:address${i}`);
        tripleStore.add(personUri, 'schema:knows', `ex:person${(i + 1) % 100}`);
      }
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(1000); // Should load in under 1 second
      
      // Test queries are fast
      const queryStart = Date.now();
      const engineerQuery = {
        find: ['?person', '?name', '?age'],
        where: [
          ['?person', 'rdf:type', 'foaf:Person'],
          ['?person', 'schema:jobTitle', 'Engineer'],
          ['?person', 'foaf:name', '?name'],
          ['?person', 'foaf:age', '?age']
        ]
      };
      
      const engineers = rdfDataSource.query(engineerQuery);
      const queryTime = Date.now() - queryStart;
      
      expect(engineers.length).toBe(50); // Half are engineers
      expect(queryTime).toBeLessThan(100); // Should query in under 100ms
      
      // Test handle creation and access is fast
      const handleStart = Date.now();
      const person42 = new RDFHandle(rdfDataSource, 'ex:person42');
      const data = person42.value();
      const handleTime = Date.now() - handleStart;
      
      expect(data['foaf:name']).toBe('Person 42');
      expect(handleTime).toBeLessThan(50); // Should be very fast
      
      person42.destroy();
    });
    
    test('should handle complex queries across large dataset', () => {
      // Create hierarchical organization data
      for (let dept = 0; dept < 5; dept++) {
        const deptUri = `ex:dept${dept}`;
        tripleStore.add(deptUri, 'rdf:type', 'org:OrganizationalUnit');
        tripleStore.add(deptUri, 'org:hasUnit', `ex:team${dept * 2}`);
        tripleStore.add(deptUri, 'org:hasUnit', `ex:team${dept * 2 + 1}`);
        
        for (let team = 0; team < 2; team++) {
          const teamUri = `ex:team${dept * 2 + team}`;
          tripleStore.add(teamUri, 'rdf:type', 'org:OrganizationalUnit');
          tripleStore.add(teamUri, 'org:unitOf', deptUri);
          
          for (let person = 0; person < 20; person++) {
            const personUri = `ex:person${dept * 40 + team * 20 + person}`;
            tripleStore.add(personUri, 'rdf:type', 'foaf:Person');
            tripleStore.add(personUri, 'foaf:name', `Person ${dept * 40 + team * 20 + person}`);
            tripleStore.add(personUri, 'org:memberOf', teamUri);
            tripleStore.add(personUri, 'schema:department', `Department ${dept}`);
            tripleStore.add(personUri, 'foaf:age', 25 + (person % 35));
          }
        }
      }
      
      // Complex multi-hop query
      const complexQuery = {
        find: ['?person', '?name', '?team', '?dept'],
        where: [
          ['?person', 'rdf:type', 'foaf:Person'],
          ['?person', 'foaf:name', '?name'],
          ['?person', 'org:memberOf', '?team'],
          ['?team', 'org:unitOf', '?dept'],
          ['?dept', 'rdf:type', 'org:OrganizationalUnit']
        ]
      };
      
      const startTime = Date.now();
      const results = rdfDataSource.query(complexQuery);
      const queryTime = Date.now() - startTime;
      
      expect(results).toHaveLength(200); // 5 depts * 2 teams * 20 people
      expect(queryTime).toBeLessThan(200); // Should complete in reasonable time
      
      // Verify query correctness
      const firstResult = results[0];
      expect(firstResult).toHaveProperty('person');
      expect(firstResult).toHaveProperty('name');
      expect(firstResult).toHaveProperty('team');
      expect(firstResult).toHaveProperty('dept');
    });
  });
  
  describe('Live Synchronization Scenarios', () => {
    test('should maintain consistency across multiple handles to same entity', () => {
      // Create initial data
      tripleStore.add('ex:shared-entity', 'rdf:type', 'foaf:Person');
      tripleStore.add('ex:shared-entity', 'foaf:name', 'Shared Person');
      tripleStore.add('ex:shared-entity', 'foaf:age', 30);
      
      const handle1 = new RDFHandle(rdfDataSource, 'ex:shared-entity');
      const handle2 = new RDFHandle(rdfDataSource, 'ex:shared-entity');
      
      // Both should see same initial data
      const data1 = handle1.value();
      const data2 = handle2.value();
      
      expect(data1['foaf:name']).toBe('Shared Person');
      expect(data2['foaf:name']).toBe('Shared Person');
      expect(data1['foaf:age']).toBe(30);
      expect(data2['foaf:age']).toBe(30);
      
      // Set up subscriptions
      const changes1 = [];
      const changes2 = [];
      
      const sub1 = handle1.subscribe(
        { find: ['?p', '?o'], where: [['ex:shared-entity', '?p', '?o']] },
        (results) => changes1.push(results)
      );
      
      const sub2 = handle2.subscribe(
        { find: ['?p', '?o'], where: [['ex:shared-entity', '?p', '?o']] },
        (results) => changes2.push(results)
      );
      
      // Modify data through triple store
      tripleStore.remove('ex:shared-entity', 'foaf:age', 30);
      tripleStore.add('ex:shared-entity', 'foaf:age', 31);
      tripleStore.add('ex:shared-entity', 'foaf:email', 'shared@example.com');
      
      // Both handles should be notified
      expect(changes1.length).toBeGreaterThan(0);
      expect(changes2.length).toBeGreaterThan(0);
      
      // Invalidate caches and check consistency
      handle1.invalidateCache();
      handle2.invalidateCache();
      
      const updatedData1 = handle1.value();
      const updatedData2 = handle2.value();
      
      expect(updatedData1['foaf:age']).toBe(31);
      expect(updatedData2['foaf:age']).toBe(31);
      expect(updatedData1['foaf:email']).toBe('shared@example.com');
      expect(updatedData2['foaf:email']).toBe('shared@example.com');
      
      // Clean up
      sub1.unsubscribe();
      sub2.unsubscribe();
      handle1.destroy();
      handle2.destroy();
    });
    
    test('should propagate changes across relationship networks', () => {
      // Create network: person -> organization -> location
      tripleStore.add('ex:employee', 'rdf:type', 'foaf:Person');
      tripleStore.add('ex:employee', 'foaf:name', 'John Employee');
      tripleStore.add('ex:employee', 'schema:worksFor', 'ex:company');
      
      tripleStore.add('ex:company', 'rdf:type', 'schema:Organization');
      tripleStore.add('ex:company', 'schema:name', 'Tech Company');
      tripleStore.add('ex:company', 'schema:location', 'ex:city');
      
      tripleStore.add('ex:city', 'rdf:type', 'schema:Place');
      tripleStore.add('ex:city', 'schema:name', 'San Francisco');
      tripleStore.add('ex:city', 'schema:addressCountry', 'US');
      
      const employee = new RDFHandle(rdfDataSource, 'ex:employee');
      const company = new RDFHandle(rdfDataSource, 'ex:company');
      const city = new RDFHandle(rdfDataSource, 'ex:city');
      
      // Set up subscriptions across the network
      const employeeChanges = [];
      const companyChanges = [];
      const cityChanges = [];
      
      const empSub = employee.subscribe(
        { find: ['?p', '?o'], where: [['ex:employee', '?p', '?o']] },
        (results) => employeeChanges.push(results)
      );
      
      const compSub = company.subscribe(
        { find: ['?p', '?o'], where: [['ex:company', '?p', '?o']] },
        (results) => companyChanges.push(results)
      );
      
      const citySub = city.subscribe(
        { find: ['?p', '?o'], where: [['ex:city', '?p', '?o']] },
        (results) => cityChanges.push(results)
      );
      
      // Change city information
      tripleStore.remove('ex:city', 'schema:name', 'San Francisco');
      tripleStore.add('ex:city', 'schema:name', 'San Jose');
      
      // City handle should be notified
      expect(cityChanges.length).toBeGreaterThan(0);
      
      // Change company information
      tripleStore.add('ex:company', 'schema:numberOfEmployees', 500);
      
      // Company handle should be notified
      expect(companyChanges.length).toBeGreaterThan(0);
      
      // Verify network consistency by navigation
      city.invalidateCache();
      company.invalidateCache();
      
      const updatedCityData = city.value();
      expect(updatedCityData['schema:name']).toBe('San Jose');
      
      const navigatedCompany = employee.followLink('schema:worksFor');
      const navigatedCity = navigatedCompany.followLink('schema:location');
      const navigatedCityData = navigatedCity.value();
      expect(navigatedCityData['schema:name']).toBe('San Jose');
      
      // Clean up
      empSub.unsubscribe();
      compSub.unsubscribe();
      citySub.unsubscribe();
      employee.destroy();
      company.destroy();
      city.destroy();
      navigatedCompany.destroy();
      navigatedCity.destroy();
    });
  });
  
  describe('Persistent Storage Scenarios', () => {
    test('should support data export and import cycles', () => {
      // Create rich dataset
      tripleStore.add('ex:dataset-entity', 'rdf:type', 'foaf:Person');
      tripleStore.add('ex:dataset-entity', 'foaf:name', 'Test Person');
      tripleStore.add('ex:dataset-entity', 'foaf:age', 25);
      tripleStore.add('ex:dataset-entity', 'foaf:knows', 'ex:friend');
      tripleStore.add('ex:dataset-entity', 'schema:jobTitle', 'Developer');
      tripleStore.add('ex:dataset-entity', 'dbo:birthPlace', 'dbr:Boston');
      
      tripleStore.add('ex:friend', 'rdf:type', 'foaf:Person');
      tripleStore.add('ex:friend', 'foaf:name', 'Friend Person');
      tripleStore.add('ex:friend', 'foaf:age', 28);
      
      // Export data
      const turtleData = rdfDataSource.exportRDF('turtle');
      expect(turtleData).toContain('ex:dataset-entity');
      expect(turtleData).toContain('foaf:name');
      expect(turtleData).toContain('Test Person');
      
      // Clear and reimport
      tripleStore.clear();
      expect(tripleStore.size()).toBe(0);
      
      rdfDataSource.importRDF(turtleData, 'turtle');
      expect(tripleStore.size()).toBeGreaterThan(0);
      
      // Verify data integrity after round-trip
      const restoredHandle = new RDFHandle(rdfDataSource, 'ex:dataset-entity');
      const restoredData = restoredHandle.value();
      
      expect(restoredData['foaf:name']).toBe('Test Person');
      expect(restoredData['foaf:age']).toBe(25);
      expect(restoredData['schema:jobTitle']).toBe('Developer');
      expect(restoredData['foaf:knows']).toBe('ex:friend');
      
      // Verify relationships still work
      const friendHandle = restoredHandle.followLink('foaf:knows');
      expect(friendHandle).toBeInstanceOf(RDFHandle);
      
      const friendData = friendHandle.value();
      expect(friendData['foaf:name']).toBe('Friend Person');
      expect(friendData['foaf:age']).toBe(28);
      
      restoredHandle.destroy();
      friendHandle.destroy();
    });
    
    test('should maintain data types through storage cycles', () => {
      // Add data with various types
      tripleStore.add('ex:typed-entity', 'ex:stringProp', 'text value');
      tripleStore.add('ex:typed-entity', 'ex:intProp', 42);
      tripleStore.add('ex:typed-entity', 'ex:floatProp', 3.14159);
      tripleStore.add('ex:typed-entity', 'ex:boolProp', true);
      tripleStore.add('ex:typed-entity', 'ex:dateProp', '2024-01-15');
      
      const handle = new RDFHandle(rdfDataSource, 'ex:typed-entity');
      const originalData = handle.value();
      
      // Verify original types
      expect(typeof originalData['ex:stringProp']).toBe('string');
      expect(typeof originalData['ex:intProp']).toBe('number');
      expect(typeof originalData['ex:floatProp']).toBe('number');
      expect(typeof originalData['ex:boolProp']).toBe('boolean');
      expect(typeof originalData['ex:dateProp']).toBe('string');
      
      // Export to different formats and verify
      const formats = ['turtle', 'jsonld', 'ntriples'];
      
      for (const format of formats) {
        const exportedData = rdfDataSource.exportRDF(format);
        expect(exportedData).toBeTruthy();
        expect(exportedData.length).toBeGreaterThan(0);
        
        // Clear and reimport
        tripleStore.clear();
        rdfDataSource.importRDF(exportedData, format);
        
        // Verify types are preserved
        handle.invalidateCache();
        const restoredData = handle.value();
        
        expect(typeof restoredData['ex:stringProp']).toBe('string');
        expect(restoredData['ex:stringProp']).toBe('text value');
        
        expect(typeof restoredData['ex:intProp']).toBe('number');
        expect(restoredData['ex:intProp']).toBe(42);
        
        expect(typeof restoredData['ex:floatProp']).toBe('number');
        expect(restoredData['ex:floatProp']).toBeCloseTo(3.14159);
        
        expect(typeof restoredData['ex:boolProp']).toBe('boolean');
        expect(restoredData['ex:boolProp']).toBe(true);
        
        expect(typeof restoredData['ex:dateProp']).toBe('string');
        expect(restoredData['ex:dateProp']).toBe('2024-01-15');
      }
      
      handle.destroy();
    });
  });
});
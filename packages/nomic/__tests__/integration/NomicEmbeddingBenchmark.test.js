/**
 * EMBEDDING QUALITY BENCHMARK TESTS
 * 
 * Tests semantic similarity expectations for the nomic embedding model.
 * These ranges are based on typical embedding model performance.
 */

import { NomicEmbeddings } from '../../src/NomicEmbeddings.js';

describe('Nomic Embeddings - Quality Benchmark', () => {
  let embeddings;

  beforeAll(async () => {
    embeddings = new NomicEmbeddings();
    await embeddings.initialize();
    console.log(`✅ Testing with: ${embeddings.modelName}`);
  }, 60000);

  afterAll(async () => {
    if (embeddings) {
      await embeddings.close();
    }
  });

  // Helper function to test similarity ranges
  async function testSimilarityRange(word1, word2, minSim, maxSim, description) {
    const vec1 = await embeddings.embed(word1);
    const vec2 = await embeddings.embed(word2);
    const similarity = await embeddings.similarity(vec1, vec2);
    
    console.log(`${word1} vs ${word2}: ${similarity.toFixed(4)} (expected: ${minSim}-${maxSim}) - ${description}`);
    
    expect(similarity).toBeGreaterThanOrEqual(minSim);
    expect(similarity).toBeLessThanOrEqual(maxSim);
    
    return similarity;
  }

  describe('Animal Category Relationships', () => {
    test('cat vs dog - high category overlap (animals, pets, mammals)', async () => {
      await testSimilarityRange('cat', 'dog', 0.55, 0.70, 'High category overlap');
    });

    test('cat vs kitten - almost synonymous (species + age variant)', async () => {
      await testSimilarityRange('cat', 'kitten', 0.75, 0.86, 'Almost synonymous');
    });

    test('cat vs lion - same family, different context', async () => {
      await testSimilarityRange('cat', 'lion', 0.55, 0.66, 'Same family');
    });

    test('cat vs pet - related concept, not direct synonym', async () => {
      await testSimilarityRange('cat', 'pet', 0.45, 0.75, 'Related concept');
    });
  });

  describe('Unrelated Category Relationships', () => {
    test('cat vs airplane - weak link (both nouns, different categories)', async () => {
      await testSimilarityRange('cat', 'airplane', 0.20, 0.50, 'Weak link');
    });

    test('cat vs table - weak; possible residual due to common contexts', async () => {
      await testSimilarityRange('cat', 'table', 0.15, 0.55, 'Weak residual link');
    });
  });

  describe('Transportation Relationships', () => {
    test('airplane vs flight - strong conceptual link', async () => {
      await testSimilarityRange('airplane', 'flight', 0.65, 0.90, 'Strong conceptual link');
    });

    test('airplane vs airport - strong functional relationship', async () => {
      await testSimilarityRange('airplane', 'airport', 0.60, 0.80, 'Strong functional relationship');
    });
  });

  describe('Fruit vs Company Disambiguation', () => {
    test('apple (fruit) vs orange (fruit) - same category', async () => {
      await testSimilarityRange('apple fruit', 'orange fruit', 0.60, 0.85, 'Same category (fruits)');
    });

    test('Apple (company) vs Microsoft - same category (tech companies)', async () => {
      await testSimilarityRange('Apple company', 'Microsoft', 0.50, 0.80, 'Same category (tech)');
    });

    test('Apple (fruit) vs Microsoft - almost unrelated', async () => {
      await testSimilarityRange('apple fruit', 'Microsoft', 0.10, 0.50, 'Almost unrelated');
    });
  });

  describe('Synonym and Antonym Relationships', () => {
    test('fast vs quick - near synonyms', async () => {
      await testSimilarityRange('fast', 'quick', 0.70, 0.90, 'Near synonyms');
    });

    test('fast vs slow - antonyms have low similarity despite related meaning', async () => {
      await testSimilarityRange('fast', 'slow', 0.10, 0.70, 'Antonyms');
    });
  });

  describe('Polysemy (Multiple Meanings)', () => {
    test('bank (finance) vs bank (river) - polysemy breaks embedding closeness', async () => {
      await testSimilarityRange('bank finance', 'bank river', 0.15, 0.75, 'Polysemy disambiguation');
    });

    test('bank in sentences - context should disambiguate meaning', async () => {
      const financialBank = 'I need to go to the bank to deposit my paycheck';
      const riverBank = 'We sat on the grassy bank of the river watching the sunset';
      const moneyContext = 'The ATM machine dispensed cash from my savings account';
      
      const finVec = await embeddings.embed(financialBank);
      const riverVec = await embeddings.embed(riverBank);
      const moneyVec = await embeddings.embed(moneyContext);
      
      const finMoney = await embeddings.similarity(finVec, moneyVec);
      const riverMoney = await embeddings.similarity(riverVec, moneyVec);
      const finRiver = await embeddings.similarity(finVec, riverVec);
      
      console.log(`Financial bank vs money context: ${finMoney.toFixed(4)}`);
      console.log(`River bank vs money context: ${riverMoney.toFixed(4)}`);
      console.log(`Financial bank vs river bank: ${finRiver.toFixed(4)}`);
      
      // Financial bank should be more similar to money context than river bank
      expect(finMoney).toBeGreaterThan(riverMoney);
      // The two bank contexts should still be somewhat different
      expect(finRiver).toBeLessThan(0.60);
    });

    test('apple in sentences - context should disambiguate fruit vs company', async () => {
      const appleFruit = 'I ate a crisp red apple for breakfast this morning';
      const appleCompany = 'Apple released a new iPhone with improved camera features';
      const fruitContext = 'The orange was sweet and juicy, perfect for a healthy snack';
      const techContext = 'Microsoft announced new software updates for Windows computers';
      
      const fruitVec = await embeddings.embed(appleFruit);
      const companyVec = await embeddings.embed(appleCompany);
      const fruitCtxVec = await embeddings.embed(fruitContext);
      const techCtxVec = await embeddings.embed(techContext);
      
      const fruitToFruit = await embeddings.similarity(fruitVec, fruitCtxVec);
      const companyToTech = await embeddings.similarity(companyVec, techCtxVec);
      const fruitToTech = await embeddings.similarity(fruitVec, techCtxVec);
      const companyToFruit = await embeddings.similarity(companyVec, fruitCtxVec);
      
      console.log(`Apple fruit vs fruit context: ${fruitToFruit.toFixed(4)}`);
      console.log(`Apple company vs tech context: ${companyToTech.toFixed(4)}`);
      console.log(`Apple fruit vs tech context: ${fruitToTech.toFixed(4)}`);
      console.log(`Apple company vs fruit context: ${companyToFruit.toFixed(4)}`);
      
      // Same-domain similarities should be higher than cross-domain
      expect(fruitToFruit).toBeGreaterThan(fruitToTech);
      expect(companyToTech).toBeGreaterThan(companyToFruit);
      
      // Cross-domain similarities should be relatively low
      expect(fruitToTech).toBeLessThan(0.55);
      expect(companyToFruit).toBeLessThan(0.55);
    });
  });

  describe('Challenging Similarity Tests', () => {
    test('paraphrases should be highly similar despite different wording', async () => {
      const original = 'The quick brown fox jumps over the lazy dog';
      const paraphrase = 'A fast auburn fox leaps above the sleepy canine';
      
      const vec1 = await embeddings.embed(original);
      const vec2 = await embeddings.embed(paraphrase);
      const similarity = await embeddings.similarity(vec1, vec2);
      
      console.log(`Paraphrase similarity: ${similarity.toFixed(4)}`);
      expect(similarity).toBeGreaterThan(0.60); // Should detect semantic equivalence
    });

    test('technical concepts with different terminology should be similar', async () => {
      const concept1 = 'Machine learning algorithms use neural networks to process data';
      const concept2 = 'Artificial intelligence systems employ deep learning models for information analysis';
      
      const vec1 = await embeddings.embed(concept1);
      const vec2 = await embeddings.embed(concept2);
      const similarity = await embeddings.similarity(vec1, vec2);
      
      console.log(`Technical concept similarity: ${similarity.toFixed(4)}`);
      expect(similarity).toBeGreaterThan(0.55); // Related technical concepts
    });

    test('emotional expressions with different words should cluster', async () => {
      const emotion1 = 'I am absolutely devastated and heartbroken by this terrible news';
      const emotion2 = 'This awful situation has left me completely shattered and depressed';
      const neutral = 'The weather forecast predicts rain tomorrow afternoon';
      
      const sad1 = await embeddings.embed(emotion1);
      const sad2 = await embeddings.embed(emotion2);
      const neutralVec = await embeddings.embed(neutral);
      
      const sadSimilarity = await embeddings.similarity(sad1, sad2);
      const sad1Neutral = await embeddings.similarity(sad1, neutralVec);
      const sad2Neutral = await embeddings.similarity(sad2, neutralVec);
      
      console.log(`Sad emotions similarity: ${sadSimilarity.toFixed(4)}`);
      console.log(`Sad1 vs neutral: ${sad1Neutral.toFixed(4)}`);
      console.log(`Sad2 vs neutral: ${sad2Neutral.toFixed(4)}`);
      
      expect(sadSimilarity).toBeGreaterThan(Math.max(sad1Neutral, sad2Neutral));
    });

    test('abstract concepts should show semantic relationships', async () => {
      const freedom = 'Freedom represents the ability to make choices without external constraints';
      const liberty = 'Liberty embodies the power to act according to ones own will';
      const oppression = 'Oppression involves the systematic subjugation and control of people';
      
      const freeVec = await embeddings.embed(freedom);
      const libertyVec = await embeddings.embed(liberty);
      const oppressVec = await embeddings.embed(oppression);
      
      const freeLibertyS = await embeddings.similarity(freeVec, libertyVec);
      const freeOppressS = await embeddings.similarity(freeVec, oppressVec);
      
      console.log(`Freedom vs Liberty: ${freeLibertyS.toFixed(4)}`);
      console.log(`Freedom vs Oppression: ${freeOppressS.toFixed(4)}`);
      
      expect(freeLibertyS).toBeGreaterThan(freeOppressS); // Similar concepts vs opposites
    });
  });

  describe('Challenging Dissimilarity Tests', () => {
    test('identical structure but completely different semantics', async () => {
      const medical = 'The patient received treatment for a severe cardiac condition requiring immediate surgery';
      const cooking = 'The chef prepared ingredients for a complex culinary creation requiring precise timing';
      const legal = 'The lawyer presented evidence for a difficult criminal case requiring thorough investigation';
      
      const medVec = await embeddings.embed(medical);
      const cookVec = await embeddings.embed(cooking);
      const legalVec = await embeddings.embed(legal);
      
      const medCook = await embeddings.similarity(medVec, cookVec);
      const medLegal = await embeddings.similarity(medVec, legalVec);
      const cookLegal = await embeddings.similarity(cookVec, legalVec);
      
      console.log(`Medical vs Cooking: ${medCook.toFixed(4)}`);
      console.log(`Medical vs Legal: ${medLegal.toFixed(4)}`);
      console.log(`Cooking vs Legal: ${cookLegal.toFixed(4)}`);
      
      // Despite similar structure, semantic content should be detected as different
      expect(Math.max(medCook, medLegal, cookLegal)).toBeLessThan(0.70);
    });

    test('temporal vs spatial descriptions should be distinguishable', async () => {
      const temporal = 'The meeting will occur next Tuesday at precisely three thirty in the afternoon';
      const spatial = 'The building stands forty meters to the left of the intersection near the fountain';
      const numerical = 'The calculation requires multiplying seventeen by forty-three then dividing by twelve';
      
      const timeVec = await embeddings.embed(temporal);
      const spaceVec = await embeddings.embed(spatial);
      const mathVec = await embeddings.embed(numerical);
      
      const timeSpace = await embeddings.similarity(timeVec, spaceVec);
      const timeMath = await embeddings.similarity(timeVec, mathVec);
      const spaceMath = await embeddings.similarity(spaceVec, mathVec);
      
      console.log(`Temporal vs Spatial: ${timeSpace.toFixed(4)}`);
      console.log(`Temporal vs Mathematical: ${timeMath.toFixed(4)}`);
      console.log(`Spatial vs Mathematical: ${spaceMath.toFixed(4)}`);
      
      // Different cognitive domains should be distinguishable
      expect(timeSpace).toBeLessThan(0.65);
      expect(timeMath).toBeLessThan(0.65);
      expect(spaceMath).toBeLessThan(0.65);
    });

    test('positive vs negative sentiment with similar topics', async () => {
      const positiveWork = 'I absolutely love my new job because the colleagues are amazing and the projects are fascinating';
      const negativeWork = 'I completely hate my current position because the coworkers are terrible and the tasks are boring';
      const neutralWork = 'My workplace has standard procedures and regular meetings scheduled throughout the week';
      
      const posVec = await embeddings.embed(positiveWork);
      const negVec = await embeddings.embed(negativeWork);
      const neutVec = await embeddings.embed(neutralWork);
      
      const posNeg = await embeddings.similarity(posVec, negVec);
      const posNeut = await embeddings.similarity(posVec, neutVec);
      const negNeut = await embeddings.similarity(negVec, neutVec);
      
      console.log(`Positive vs Negative work: ${posNeg.toFixed(4)}`);
      console.log(`Positive vs Neutral work: ${posNeut.toFixed(4)}`);
      console.log(`Negative vs Neutral work: ${negNeut.toFixed(4)}`);
      
      // Sentiment should create distinguishable embeddings despite topic similarity
      expect(posNeg).toBeLessThan(Math.max(posNeut, negNeut) + 0.2);
    });

    test('concrete vs abstract descriptions of same concept', async () => {
      const concrete = 'The red bicycle with two wheels sits in the garage next to gardening tools';
      const abstract = 'Transportation represents humanitys desire to transcend physical limitations through mechanical innovation';
      const unrelated = 'The quantum physics experiment required precise measurement of particle velocities';
      
      const concVec = await embeddings.embed(concrete);
      const absVec = await embeddings.embed(abstract);
      const unrelVec = await embeddings.embed(unrelated);
      
      const concAbs = await embeddings.similarity(concVec, absVec);
      const concUnrel = await embeddings.similarity(concVec, unrelVec);
      const absUnrel = await embeddings.similarity(absVec, unrelVec);
      
      console.log(`Concrete vs Abstract: ${concAbs.toFixed(4)}`);
      console.log(`Concrete vs Unrelated: ${concUnrel.toFixed(4)}`);
      console.log(`Abstract vs Unrelated: ${absUnrel.toFixed(4)}`);
      
      // Even if conceptually related, concrete vs abstract should show difference
      expect(concAbs).toBeLessThan(0.65);
    });
  });

  describe('Semantic Consistency Check', () => {
    test('embeddings should be consistent across multiple calls', async () => {
      const word = 'consistency';
      const vec1 = await embeddings.embed(word);
      const vec2 = await embeddings.embed(word);
      const similarity = await embeddings.similarity(vec1, vec2);
      
      expect(similarity).toBeGreaterThan(0.99); // Should be nearly identical
    });

    test('similar words should cluster together', async () => {
      // Test transitivity: if A~B and B~C, then A should be somewhat similar to C
      const dogCat = await testSimilarityRange('dog', 'cat', 0.55, 0.70, 'dog-cat');
      const catPet = await testSimilarityRange('cat', 'pet', 0.45, 0.75, 'cat-pet');
      
      const dogVec = await embeddings.embed('dog');
      const petVec = await embeddings.embed('pet');
      const dogPet = await embeddings.similarity(dogVec, petVec);
      
      console.log(`Transitivity check - dog vs pet: ${dogPet.toFixed(4)}`);
      expect(dogPet).toBeGreaterThan(0.40); // Should show some similarity via cat
    });
  });
});
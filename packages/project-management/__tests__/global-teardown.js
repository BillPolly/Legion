/**
 * Jest Global Teardown
 *
 * Closes Neo4j connection pool after all tests complete.
 * This prevents Jest from hanging waiting for open handles.
 */

export default async function globalTeardown() {
  console.log('\n🧹 [TEARDOWN] Closing Neo4j connection pool...');

  // Dynamically import to avoid top-level await issues
  const { close } = await import('../src/neo4j.js');
  await close();

  console.log('✅ [TEARDOWN] Neo4j connection pool closed\n');
}

/**
 * Social Network Example
 * Demonstrates using the Incremental LFTJ engine for social network queries
 */

import { IncrementalLFTJ } from '../src/index.js';

// Create engine
const engine = new IncrementalLFTJ({
  batchSize: 100,
  autoFlush: true,
  enableStatistics: true
});

// Define social network schema
engine.defineRelation('users', {
  userId: 'ID',
  name: 'String',
  age: 'Integer',
  city: 'String'
});

engine.defineRelation('follows', {
  follower: 'ID',
  followee: 'ID'
});

engine.defineRelation('posts', {
  postId: 'ID',
  userId: 'ID',
  content: 'String',
  timestamp: 'Integer'
});

engine.defineRelation('likes', {
  userId: 'ID',
  postId: 'ID'
});

console.log('🚀 Social Network Query Engine Started\n');

// Query 1: Find mutual followers
console.log('Query 1: Mutual Followers');
console.log('-------------------------');

// For mutual followers, we need to join follows with itself
// We'll need to use the query builder differently
const mutualFollowersQuery = engine.query('mutual-followers')
  .from('follows', engine._relations.get('follows'))
  .build();

const mutualHandle = engine.register(mutualFollowersQuery);

mutualHandle.subscribe((notification) => {
  console.log('Mutual followers updated:');
  const results = notification.results;
  console.log(results);
});

// Query 2: Popular posts (posts with multiple likes)
console.log('\nQuery 2: Popular Posts');
console.log('----------------------');

const popularPostsQuery = engine.query('popular-posts')
  .from('posts')
  .joinRelation('likes', [{ left: 0, right: 1 }]) // Join posts with likes
  .select([0, 1, 2]) // postId, userId, content
  .build();

const popularHandle = engine.register(popularPostsQuery);

let likeCount = new Map();
popularHandle.subscribe((notification) => {
  // Count likes per post
  likeCount.clear();
  const results = notification.results;
  
  for (const [outputId, data] of Object.entries(results)) {
    if (data.currentSet) {
      // Parse results to count likes
      console.log(`Popular posts found in ${outputId}`);
    }
  }
});

// Query 3: Friend recommendations (friends of friends)
console.log('\nQuery 3: Friend Recommendations');
console.log('-------------------------------');

const friendRecommendationsQuery = engine.query('friend-recommendations')
  .from('follows')
  .joinRelation('follows', [{ left: 1, right: 0 }]) // Friends of friends
  .where((tuple) => {
    // Don't recommend someone who follows themselves
    // And don't recommend someone you already follow
    return tuple.get(0).compareTo(tuple.get(3)) !== 0;
  })
  .select([0, 3]) // Original user and recommended user
  .distinct()
  .build();

const recommendHandle = engine.register(friendRecommendationsQuery);

recommendHandle.subscribe((notification) => {
  console.log('Friend recommendations updated');
});

// Add sample data
console.log('\n📊 Loading Sample Data...\n');

// Add users
engine.insert('users', [
  ['alice', 'Alice', 28, 'NYC'],
  ['bob', 'Bob', 32, 'SF'],
  ['carol', 'Carol', 25, 'LA'],
  ['david', 'David', 30, 'NYC'],
  ['eve', 'Eve', 27, 'SF']
]);

// Add follow relationships
engine.insert('follows', [
  ['alice', 'bob'],
  ['bob', 'alice'],    // Mutual follow
  ['alice', 'carol'],
  ['carol', 'david'],
  ['david', 'eve'],
  ['eve', 'alice'],
  ['bob', 'carol'],
  ['carol', 'bob']     // Another mutual follow
]);

// Add posts
engine.insert('posts', [
  ['p1', 'alice', 'Hello from NYC!', 1000],
  ['p2', 'bob', 'Loving the weather in SF', 1001],
  ['p3', 'carol', 'Beach day in LA!', 1002],
  ['p4', 'alice', 'Coffee recommendations?', 1003],
  ['p5', 'david', 'Working from home today', 1004]
]);

// Add likes
engine.insert('likes', [
  ['bob', 'p1'],
  ['carol', 'p1'],
  ['david', 'p1'],    // p1 is popular!
  ['alice', 'p2'],
  ['carol', 'p3'],
  ['eve', 'p3']
]);

// Flush to process all updates
engine.flush();

console.log('\n📈 Query Statistics:\n');

// Print statistics for each query
console.log('Mutual Followers Query:');
console.log(mutualHandle.getStatistics());

console.log('\nPopular Posts Query:');
console.log(popularHandle.getStatistics());

console.log('\nFriend Recommendations Query:');
console.log(recommendHandle.getStatistics());

// Demonstrate incremental updates
console.log('\n🔄 Adding Incremental Updates...\n');

// New user joins
engine.insert('users', ['frank', 'Frank', 29, 'Boston']);

// Frank follows some people
engine.insert('follows', [
  ['frank', 'alice'],
  ['frank', 'bob'],
  ['alice', 'frank']  // Alice follows back
]);

// Frank posts
engine.insert('posts', ['p6', 'frank', 'New to the platform!', 1005]);

// People like Frank's post
engine.insert('likes', [
  ['alice', 'p6'],
  ['bob', 'p6'],
  ['carol', 'p6']
]);

engine.flush();

// Transaction example
console.log('\n💫 Transaction Example: User Deactivation\n');

engine.transaction(async () => {
  // Remove all of David's data atomically
  engine.delete('follows', ['david', 'eve']);
  engine.delete('posts', ['p5', 'david', 'Working from home today', 1004]);
  engine.delete('likes', ['david', 'p1']);
  engine.delete('users', ['david', 'David', 30, 'NYC']);
  
  console.log('User david deactivated in transaction');
});

// Show final statistics
console.log('\n📊 Final Engine Statistics:\n');
console.log(engine.getStatistics());

// Cleanup
console.log('\n🏁 Example Complete!\n');
engine.reset();
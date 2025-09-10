# DataScript JS

> An immutable in-memory database and Datalog query engine for JavaScript/TypeScript

DataScript JS is a complete port of the popular [DataScript](https://github.com/tonsky/datascript) Clojure library to modern JavaScript/TypeScript. It provides a lightweight, zero-dependency database that runs entirely in memory, making it perfect for client-side applications, temporary data processing, and reactive programming patterns.

## ✨ Features

- **🚀 Zero Dependencies** - No external dependencies, works anywhere Node.js or browsers run
- **💾 Immutable Database** - All database operations return new database values
- **🔍 Datalog Queries** - Powerful query language with joins, rules, and aggregations
- **🔄 Pull API** - Declarative data fetching with automatic relationship resolution
- **💾 Persistence** - Serialize/deserialize databases to/from storage
- **🌐 Universal** - Works in Node.js, browsers, and edge environments
- **⚡ Fast** - Optimized indexes for quick lookups and queries
- **🔧 TypeScript Ready** - Full TypeScript declarations included

## 📦 Installation

```bash
npm install datascript-js
```

## 🚀 Quick Start

### Basic Usage

```javascript
import { DB, q, pull } from 'datascript-js';

// Create a database with schema
const schema = {
  ':person/friends': { card: 'many', valueType: 'ref' },
  ':person/age': { valueType: 'number' }
};

const db = DB.empty(schema);

// Add data
const { db: db1 } = db.withTx([
  { ':db/id': -1, ':person/name': 'Alice', ':person/age': 30 },
  { ':db/id': -2, ':person/name': 'Bob', ':person/age': 25 },
  { ':db/id': -3, ':person/name': 'Charlie', ':person/age': 35 },
  ['+', -1, ':person/friends', -2], // Alice is friends with Bob
  ['+', -2, ':person/friends', -3], // Bob is friends with Charlie
]);

// Query with Datalog
const adults = q({
  find: ['?name', '?age'],
  where: [
    ['?e', ':person/name', '?name'],
    ['?e', ':person/age', '?age'],
    [(age) => age >= 30, '?age']
  ]
}, db1);

console.log(adults);
// => [['Alice', 30], ['Charlie', 35]]

// Pull API for declarative data fetching
const aliceData = pull(db1, {
  ':person/name': true,
  ':person/age': true,
  ':person/friends': [':person/name']
}, 1);

console.log(aliceData);
// => {
//   ':person/name': 'Alice',
//   ':person/age': 30,
//   ':person/friends': [{ ':person/name': 'Bob' }]
// }
```

### Advanced Queries with Rules

```javascript
import { qEDN } from 'datascript-js';

// Define rules for recursive relationships
const rules = `
[[(friend ?a ?b)
  [?a :person/friends ?b]]
 [(friend ?a ?b)
  [?a :person/friends ?c]
  (friend ?c ?b)]]
`;

// Find all people connected through friendship
const connected = qEDN(`
  [:find ?name1 ?name2
   :in $ %
   :where
   [?e1 :person/name ?name1]
   [?e2 :person/name ?name2]
   (friend ?e1 ?e2)]
`, db1, rules);

console.log(connected);
// => [['Alice', 'Bob'], ['Alice', 'Charlie'], ['Bob', 'Charlie']]
```

### Persistence

```javascript
import { saveDBToFile, loadDBFromFile } from 'datascript-js';

// Save database to file (Node.js)
await saveDBToFile(db1, './my-database.json');

// Load database from file
const loadedDB = await loadDBFromFile('./my-database.json');

// In browsers, save to localStorage
await saveDBToFile(db1, 'my-db'); // Uses localStorage key 'my-db'
const browserDB = await loadDBFromFile('my-db');
```

## 📚 Core Concepts

### Database as a Value

DataScript databases are immutable values. Every transaction returns a new database:

```javascript
const db0 = DB.empty();
const { db: db1 } = db0.withTx([['+', 1, ':name', 'Alice']]);
const { db: db2 } = db1.withTx([['+', 1, ':age', 30]]);

// db0, db1, db2 are all different database values
console.log(db0 !== db1); // true
console.log(db1 !== db2); // true
```

### Schema Definition

Define attribute properties to enable special behavior:

```javascript
const schema = {
  ':user/id': { unique: 'identity' },    // Unique identity attribute
  ':user/email': { unique: 'value' },    // Unique value constraint
  ':user/friends': {                     // Reference to other entities
    card: 'many',                        // Can have multiple values
    valueType: 'ref'                     // Values are entity references
  },
  ':user/profile': {                     // Component relationship
    valueType: 'ref',
    isComponent: true                    // Cascade operations
  }
};
```

### Entity-Attribute-Value Model

All data is stored as tuples of `[entity, attribute, value]`:

```javascript
// These transactions are equivalent:
['+', 1, ':person/name', 'Alice']
{ ':db/id': 1, ':person/name': 'Alice' }
```

## 🔍 Query Language

DataScript supports a powerful Datalog query language:

### Basic Patterns

```javascript
// Find all names
q({
  find: ['?name'],
  where: [['?e', ':person/name', '?name']]
}, db);

// Filter with predicates
q({
  find: ['?name'],
  where: [
    ['?e', ':person/name', '?name'],
    ['?e', ':person/age', '?age'],
    [(age) => age > 25, '?age']
  ]
}, db);
```

### Joins

```javascript
// Find friends' names
q({
  find: ['?name', '?friend-name'],
  where: [
    ['?e', ':person/name', '?name'],
    ['?e', ':person/friends', '?friend'],
    ['?friend', ':person/name', '?friend-name']
  ]
}, db);
```

### Aggregations

```javascript
// Count and average age
q({
  find: [['(count ?e)', '(avg ?age)']],
  where: [
    ['?e', ':person/age', '?age']
  ]
}, db);
```

## 🎯 Pull API

Declaratively specify what data to fetch:

```javascript
// Pull pattern syntax
pull(db, [
  ':person/name',                          // Simple attribute
  { ':person/friends': [':person/name'] }, // Nested pull
  { ':person/profile': ['*'] },            // Wildcard (all attributes)
  { ':person/posts': {                     // With options
    pattern: [':post/title', ':post/date'],
    limit: 10,
    default: []
  }}
], entityId);
```

## 🛠️ Development

### Scripts

```bash
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:coverage # Run tests with coverage
npm run benchmark     # Performance benchmarks
npm run examples      # Run example scripts
```

### Testing

The project includes 107 comprehensive tests covering:
- Core database operations
- Query engine functionality  
- Pull API features
- Persistence and serialization
- Edge cases and error handling

## 🌐 Browser Support

DataScript JS works in all modern browsers with ES6+ support:

```html
<!-- ES Modules -->
<script type="module">
  import { DB, q, pull } from './node_modules/datascript-js/index.js';
  // Your code here
</script>

<!-- With bundlers (Vite, Webpack, etc.) -->
<script>
  import { DB, q, pull } from 'datascript-js';
</script>
```

## ⚡ Performance

DataScript JS is optimized for:
- **Memory efficiency** - Structural sharing of immutable data
- **Query speed** - Multiple indexes (EAVT, AEVT, AVET) for fast lookups
- **Transaction speed** - Bulk operations and efficient data structures

Typical performance characteristics:
- **Queries**: 1M+ simple queries/second
- **Transactions**: 100K+ datoms/second  
- **Memory**: ~100 bytes per datom

## 🤝 Compatibility

DataScript JS aims for maximum compatibility with Clojure DataScript:

- ✅ Same query language and syntax
- ✅ Same pull API patterns
- ✅ Same transaction format
- ✅ Compatible serialization format
- ✅ Same entity navigation

See [MIGRATION.md](./docs/MIGRATION.md) for detailed migration notes.

## 📖 Documentation

- [API Reference](./docs/API.md) - Complete API documentation
- [Query Guide](./docs/QUERY-GUIDE.md) - Datalog query language reference
- [Migration Guide](./docs/MIGRATION.md) - Migrating from Clojure DataScript

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines and ensure all tests pass.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

This project is inspired by and compatible with [DataScript](https://github.com/tonsky/datascript) by Nikita Prokopov. Special thanks to the Clojure and ClojureScript communities for the foundational concepts and design patterns.

---

**Made with ❤️ for the JavaScript community**
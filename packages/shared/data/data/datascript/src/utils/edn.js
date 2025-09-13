// Minimal EDN parser for DataScript query DSL usage.
// Supports: nil, booleans, numbers, strings, keywords, symbols,
// vectors [], lists (), maps {}, sets #{}, comments starting with ';'.

function isWs(ch) { return /\s/.test(ch); }

export function parseEDN(input) {
  const s = String(input);
  let i = 0;

  const peek = () => s[i];
  const next = () => s[i++];
  const eof = () => i >= s.length;
  const skip = () => {
    while (!eof()) {
      const ch = peek();
      if (isWs(ch)) { i++; continue; }
      if (ch === ';') { while (!eof() && next() !== '\n'); continue; }
      if (ch === ',') { i++; continue; }
      break;
    }
  };

  function parseString() {
    let out = '';
    next(); // opening "
    while (!eof()) {
      const ch = next();
      if (ch === '"') return out;
      if (ch === '\\') {
        const esc = next();
        const map = { 'n': '\n', 'r': '\r', 't': '\t', '"': '"', '\\': '\\' };
        out += map[esc] ?? esc;
      } else out += ch;
    }
    throw new Error('Unterminated string');
  }

  function parseKeyword() {
    let buf = ':';
    next(); // consume ':'
    while (!eof()) {
      const ch = peek();
      if (isWs(ch) || '()[]{}"'.includes(ch) || ch === ',') break;
      buf += ch; i++;
    }
    return buf;
  }

  function parseNumberOrSymbol() {
    let buf = '';
    while (!eof()) {
      const ch = peek();
      if (isWs(ch) || '()[]{}"'.includes(ch) || ch === ',') break;
      buf += ch; i++;
    }
    if (buf === 'nil') return null;
    if (buf === 'true') return true;
    if (buf === 'false') return false;
    if (/^[+-]?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(buf)) return Number(buf);
    return { $sym: buf };
  }

  function parseVector() {
    const arr = [];
    next(); // [
    skip();
    while (!eof()) {
      if (peek() === ']') { next(); return arr; }
      arr.push(parseAny());
      skip();
    }
    throw new Error('Unterminated vector');
  }

  function parseList() {
    const arr = [];
    next(); // (
    skip();
    while (!eof()) {
      if (peek() === ')') { next(); return { $list: arr }; }
      arr.push(parseAny());
      skip();
    }
    throw new Error('Unterminated list');
  }

  function parseTagged() {
    next(); // '#'
    if (peek() === '{') {
      // set literal
      next(); // '{'
      skip();
      const arr = [];
      while (!eof()) {
        if (peek() === '}') { next(); return { $set: arr }; }
        arr.push(parseAny());
        skip();
      }
      throw new Error('Unterminated set');
    }
    // read tag symbol
    let tag = '';
    while (!eof()) {
      const ch = peek();
      if (isWs(ch) || ch === '"' || ch === '[' || ch === '(' || ch === '{') break;
      tag += ch; i++;
    }
    if (tag === 'inst') {
      const val = parseAny();
      if (typeof val !== 'string') throw new Error('#inst expects a string');
      const d = new Date(val);
      return d;
    }
    if (tag === 'uuid') {
      const val = parseAny();
      if (typeof val !== 'string') throw new Error('#uuid expects a string');
      return val;
    }
    throw new Error('Unsupported reader tag #' + tag);
  }

  function parseMap() {
    const obj = {};
    next(); // '{'
    skip();
    while (!eof()) {
      if (peek() === '}') { next(); return obj; }
      const k = parseAny();
      skip();
      const v = parseAny();
      // stringify key
      const keyStr = typeof k === 'string' ? k : (k && k.$sym ? k.$sym : JSON.stringify(k));
      obj[keyStr] = v;
      skip();
    }
    throw new Error('Unterminated map');
  }

  function parseAny() {
    skip();
    if (eof()) throw new Error('Unexpected EOF');
    const ch = peek();
    if (ch === '"') return parseString();
    if (ch === ':') return parseKeyword();
    if (ch === '[') return parseVector();
    if (ch === '(') return parseList();
    if (ch === '{') return parseMap();
    if (ch === '#') return parseTagged();
    return parseNumberOrSymbol();
  }

  skip();
  const out = parseAny();
  skip();
  return out;
}

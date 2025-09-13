// Storage-agnostic serialization helpers
import { DB, __getCounters, __setCounters } from '../core/db.js';
import { Indexes } from '../core/indexes.js';
import { datom } from '../core/datom.js';

function encodeValue(v) {
  if (v instanceof Date) return { $t: 'date', v: v.getTime() };
  if (Array.isArray(v)) return v.map(encodeValue);
  if (v && typeof v === 'object') return v; // assume plain JSON
  return v;
}

function decodeValue(v) {
  if (v && typeof v === 'object' && !Array.isArray(v) && '$t' in v) {
    if (v.$t === 'date') return new Date(v.v);
  }
  if (Array.isArray(v)) return v.map(decodeValue);
  return v;
}

export function serializeDB(db) {
  const datoms = db.idx.eavt.all().map(d => [d.e, d.a, encodeValue(d.v), d.tx, d.added]);
  const { nextEid, nextTx } = __getCounters();
  return { schema: db.schema, datoms, counters: { nextEid, nextTx } };
}

export function deserializeDB(obj) {
  const datoms = obj.datoms.map(([e, a, v, tx, added]) => datom(e, a, decodeValue(v), tx, added));
  const idx = new Indexes().addMany(datoms);
  const db = new DB(obj.schema || {}, idx);
  const maxE = datoms.reduce((m, d) => (typeof d.e === 'number' ? Math.max(m, d.e) : m), 0);
  const maxTx = datoms.reduce((m, d) => Math.max(m, d.tx || 0), 0);
  const nextEid = Math.max(obj.counters?.nextEid || 0, maxE + 1);
  const nextTx = Math.max(obj.counters?.nextTx || 0, maxTx + 1);
  __setCounters({ nextEid, nextTx });
  return db;
}


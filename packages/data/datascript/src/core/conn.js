import { DB } from './db.js';

export class ConstraintError extends Error {
  constructor(errors = [], report) {
    super('Transaction failed constraints');
    this.name = 'ConstraintError';
    this.errors = errors;
    this.report = report;
  }
}

export class Conn {
  constructor(db) { this._db = db; this._listeners = new Map(); }
  db() { return this._db; }
  transact(tx) {
    const before = this._db;
    const { db, tempids, tx: txInst, txData } = this._db.withTx(tx);
    const report = { dbBefore: before, dbAfter: db, tempids, txData, tx: txInst };
    this._db = db;
    for (const fn of this._listeners.values()) { try { fn(report); } catch (e) {} }
    return { dbAfter: this._db, tempids, tx: txInst };
  }

  // Validate transaction against constraints without mutating root on failure.
  // validate: function or array of functions taking (report) and returning
  //  - true/undefined for success
  //  - false or string or array of strings for failure
  transactChecked(tx, validate) {
    const { db, tempids, tx: txInst, txData } = this._db.withTx(tx);
    const report = { dbBefore: this._db, dbAfter: db, tempids, txData, tx: txInst };
    const validators = Array.isArray(validate) ? validate : (validate ? [validate] : []);
    const errors = [];
    for (const vfn of validators) {
      const res = vfn(report);
      if (res === false) errors.push('validation failed');
      else if (typeof res === 'string') errors.push(res);
      else if (Array.isArray(res)) errors.push(...res.filter(Boolean));
    }
    if (errors.length) {
      throw new ConstraintError(errors, report);
    }
    this._db = db;
    for (const fn of this._listeners.values()) { try { fn(report); } catch (e) {} }
    return { dbAfter: this._db, tempids, tx: txInst };
  }
}

export function connFromDB(db) { return new Conn(db); }
export function createConn(schema = {}) { return new Conn(DB.empty(schema)); }

// Listener API
Conn.prototype.listen = function(key, fn) {
  this._listeners.set(key, fn);
  return key;
};
Conn.prototype.unlisten = function(key) {
  this._listeners.delete(key);
};

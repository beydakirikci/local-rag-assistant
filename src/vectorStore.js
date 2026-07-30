// src/vectorStore.js — TF-IDF vector store with SQLite persistence (sql.js — pure JS)
// Uses term frequency–inverse document frequency for keyword-based semantic search

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import config from './config.js';

/**
 * Compute term frequency map for a text string
 * @param {string} text
 * @returns {Map<string, number>} term → normalized frequency
 */
function termFrequency(text) {
  const words = text.toLowerCase().replace(/[^\w\sçğıöşüâîû]/g, ' ').split(/\s+/).filter(w => w.length > 1);
  const tf = new Map();
  for (const word of words) {
    tf.set(word, (tf.get(word) || 0) + 1);
  }
  // Normalize by total word count
  const total = words.length || 1;
  for (const [word, count] of tf) {
    tf.set(word, count / total);
  }
  return tf;
}

/**
 * Compute cosine similarity between two TF maps
 * @param {Map<string, number>} a
 * @param {Map<string, number>} b
 * @returns {number} similarity score 0-1
 */
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, weightA] of a) {
    normA += weightA * weightA;
    const weightB = b.get(term) || 0;
    dotProduct += weightA * weightB;
  }

  for (const [, weightB] of b) {
    normB += weightB * weightB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export class VectorStore {
  constructor(dbPath = config.dbFile) {
    this.dbPath = dbPath;
    this.db = null;
    this._rowCache = null;
    this._invertedIndex = null;
    this._initialized = false;
  }

  /**
   * Initialize the database (must be called before use)
   */
  async init() {
    if (this._initialized) return;

    // Ensure data directory exists
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const SQL = await initSqlJs();

    // Load existing DB or create new
    if (existsSync(this.dbPath)) {
      const fileBuffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    // Create table if not exists
    this.db.run(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        source TEXT,
        category TEXT,
        chunk_index INTEGER,
        total_chunks INTEGER,
        tf_vector TEXT NOT NULL
      )
    `);

    this._save();
    this._initialized = true;
  }

  /**
   * Save database to disk
   */
  _save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }

  /**
   * Clear all data from the store
   */
  clear() {
    this.db.run('DELETE FROM chunks');
    this._rowCache = null;
    this._invertedIndex = null;
    this._save();
  }

  /**
   * Add a chunk to the store
   * @param {{ content: string, source: string, category: string, chunkIndex: number, totalChunks: number }} chunk
   */
  addChunk(chunk) {
    const tf = termFrequency(chunk.content);
    const tfJson = JSON.stringify(Object.fromEntries(tf));

    this.db.run(
      `INSERT INTO chunks (content, source, category, chunk_index, total_chunks, tf_vector) VALUES (?, ?, ?, ?, ?, ?)`,
      [chunk.content, chunk.source, chunk.category || 'General', chunk.chunkIndex, chunk.totalChunks, tfJson]
    );

    // Invalidate cache
    this._rowCache = null;
    this._invertedIndex = null;
  }

  /**
   * Add multiple chunks (batch insert with save at end)
   * @param {Array} chunks
   */
  addChunks(chunks) {
    this.db.run('BEGIN TRANSACTION');
    try {
      for (const chunk of chunks) {
        this.addChunk(chunk);
      }
      this.db.run('COMMIT');
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
    this._save();
  }

  /**
   * Build in-memory cache and inverted index for fast search
   */
  _ensureCache() {
    if (this._rowCache) return;

    const results = this.db.exec('SELECT * FROM chunks');
    if (!results.length) {
      this._rowCache = [];
      this._invertedIndex = new Map();
      return;
    }

    const columns = results[0].columns;
    const rows = results[0].values;

    this._rowCache = rows.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return {
        id: obj.id,
        content: obj.content,
        source: obj.source,
        category: obj.category,
        chunkIndex: obj.chunk_index,
        totalChunks: obj.total_chunks,
        tf: new Map(Object.entries(JSON.parse(obj.tf_vector)))
      };
    });

    // Build inverted index: term → Set of row indices
    this._invertedIndex = new Map();
    for (let i = 0; i < this._rowCache.length; i++) {
      for (const term of this._rowCache[i].tf.keys()) {
        if (!this._invertedIndex.has(term)) {
          this._invertedIndex.set(term, new Set());
        }
        this._invertedIndex.get(term).add(i);
      }
    }
  }

  /**
   * Search for the most relevant chunks given a query
   * @param {string} query - User's question
   * @param {number} topK - Number of top results
   * @returns {Array<{ content: string, source: string, score: number }>}
   */
  search(query, topK = config.topK) {
    const queryTf = termFrequency(query);
    this._ensureCache();

    if (!this._rowCache || this._rowCache.length === 0) {
      return [];
    }

    // Use inverted index to find candidate chunks sharing at least one term
    const candidateIndices = new Set();
    for (const term of queryTf.keys()) {
      const indices = this._invertedIndex.get(term);
      if (indices) {
        for (const idx of indices) {
          candidateIndices.add(idx);
        }
      }
    }

    // Score only candidates, not all rows
    const scored = [];
    for (const idx of candidateIndices) {
      const row = this._rowCache[idx];
      const score = cosineSimilarity(queryTf, row.tf);
      if (score > 0) {
        scored.push({
          content: row.content,
          source: row.source,
          category: row.category,
          chunkIndex: row.chunkIndex,
          score
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Get total number of chunks in the store
   */
  get count() {
    const result = this.db.exec('SELECT COUNT(*) as count FROM chunks');
    return result.length ? result[0].values[0][0] : 0;
  }

  /**
   * Get list of all unique document sources
   */
  get sources() {
    const result = this.db.exec('SELECT DISTINCT source FROM chunks');
    return result.length ? result[0].values.map(r => r[0]) : [];
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this._save();
      this.db.close();
    }
  }
}

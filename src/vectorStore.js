// src/vectorStore.js — Semantic Vector Store with SQLite and @xenova/transformers
// Uses dense embeddings (all-MiniLM-L6-v2) for true semantic search

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import config from './config.js';
import { pipeline, env } from '@xenova/transformers';

// Configure transformers to not use browser cache, use local if available
env.localModelPath = './models';
env.allowRemoteModels = true;

/**
 * Compute cosine similarity between two numeric arrays
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class VectorStore {
  constructor(dbPath = config.dbFile) {
    this.dbPath = dbPath;
    this.db = null;
    this._rowCache = null;
    this._initialized = false;
    this._embedder = null;
  }

  /**
   * Initialize the database and embedding model
   */
  async init() {
    if (this._initialized) return;

    // Load embedding model
    console.log('🧠 Loading embedding model (all-MiniLM-L6-v2)...');
    this._embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

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

    // Create chunks table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        source TEXT,
        category TEXT,
        chunk_index INTEGER,
        total_chunks INTEGER,
        embedding TEXT NOT NULL
      )
    `);

    // Create chat history table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this._save();
    this._initialized = true;
  }

  async _getEmbedding(text) {
    const output = await this._embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  _save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }

  clear() {
    this.db.run('DELETE FROM chunks');
    this._rowCache = null;
    this._save();
  }

  async addChunk(chunk) {
    const embedding = await this._getEmbedding(chunk.content);
    const embeddingJson = JSON.stringify(embedding);

    this.db.run(
      `INSERT INTO chunks (content, source, category, chunk_index, total_chunks, embedding) VALUES (?, ?, ?, ?, ?, ?)`,
      [chunk.content, chunk.source, chunk.category || 'General', chunk.chunkIndex, chunk.totalChunks, embeddingJson]
    );

    this._rowCache = null;
  }

  async addChunks(chunks) {
    console.log(`⏳ Embedding ${chunks.length} chunks...`);
    this.db.run('BEGIN TRANSACTION');
    try {
      for (let i = 0; i < chunks.length; i++) {
        await this.addChunk(chunks[i]);
        if ((i + 1) % 10 === 0) console.log(`   ...embedded ${i + 1}/${chunks.length}`);
      }
      this.db.run('COMMIT');
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
    this._save();
  }

  _ensureCache() {
    if (this._rowCache) return;

    const results = this.db.exec('SELECT * FROM chunks');
    if (!results.length) {
      this._rowCache = [];
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
        embedding: JSON.parse(obj.embedding)
      };
    });
  }

  async search(query, topK = config.topK) {
    const queryEmbedding = await this._getEmbedding(query);
    this._ensureCache();

    if (!this._rowCache || this._rowCache.length === 0) {
      return [];
    }

    const scored = this._rowCache.map(row => {
      return {
        content: row.content,
        source: row.source,
        category: row.category,
        chunkIndex: row.chunkIndex,
        score: cosineSimilarity(queryEmbedding, row.embedding)
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  // --- Chat History Methods ---
  saveMessage(role, content) {
    this.db.run(`INSERT INTO chat_history (role, content) VALUES (?, ?)`, [role, content]);
    this._save();
  }

  getHistory(limit = 12) {
    const results = this.db.exec(`SELECT role, content FROM chat_history ORDER BY id DESC LIMIT ${limit}`);
    if (!results.length) return [];
    
    // Reverse to get chronological order
    return results[0].values.map(row => ({ role: row[0], content: row[1] })).reverse();
  }

  clearHistory() {
    this.db.run('DELETE FROM chat_history');
    this._save();
  }

  get count() {
    const result = this.db.exec('SELECT COUNT(*) as count FROM chunks');
    return result.length ? result[0].values[0][0] : 0;
  }

  get sources() {
    const result = this.db.exec('SELECT DISTINCT source FROM chunks');
    return result.length ? result[0].values.map(r => r[0]) : [];
  }

  close() {
    if (this.db) {
      this._save();
      this.db.close();
    }
  }
}

// src/config.js — Application configuration

const config = {
  // Server
  port: 3000,
  host: '127.0.0.1',

  // Model — Foundry Local model identifier
  model: 'qwen2.5-0.5b',

  // Chunking parameters
  chunkSize: 200,       // Target tokens per chunk (~200 words)
  chunkOverlap: 25,     // Overlap tokens between chunks to prevent info loss

  // Retrieval
  topK: 3,              // Number of top chunks to retrieve per query

  // Paths
  docsDir: 'docs',
  dataDir: 'data',
  dbFile: 'data/vectors.db',

  // App metadata
  appName: 'local-rag-assistant',
  appTitle: 'Local RAG Assistant',
  appDescription: 'Offline AI Q&A Assistant powered by Foundry Local'
};

export default config;

// src/chunker.js — Document chunking module
// Splits markdown documents into overlapping chunks for vector storage

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import config from './config.js';

/**
 * Parse optional YAML front-matter from markdown content
 * Supports: title, category, id
 */
function parseFrontMatter(content) {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontMatterRegex);

  if (!match) {
    return { metadata: {}, body: content };
  }

  const metadata = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
      metadata[key] = value;
    }
  }

  return {
    metadata,
    body: content.slice(match[0].length)
  };
}

/**
 * Split text into words (simple tokenizer)
 */
function tokenize(text) {
  return text.split(/\s+/).filter(w => w.length > 0);
}

/**
 * Split a document body into overlapping chunks
 * @param {string} text - Document body text
 * @param {number} chunkSize - Target number of words per chunk
 * @param {number} overlap - Number of overlapping words between chunks
 * @returns {string[]} Array of chunk strings
 */
function splitIntoChunks(text, chunkSize = config.chunkSize, overlap = config.chunkOverlap) {
  const words = tokenize(text);

  if (words.length <= chunkSize) {
    return [words.join(' ')];
  }

  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunk = words.slice(start, end).join(' ');
    chunks.push(chunk);

    if (end >= words.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}

/**
 * Read and chunk a single markdown file
 * @param {string} filePath - Path to the .md file
 * @returns {{ source: string, title: string, category: string, chunks: string[] }}
 */
export function chunkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const { metadata, body } = parseFrontMatter(content);

  const fileName = basename(filePath, '.md');
  const title = metadata.title || fileName;
  const category = metadata.category || 'General';
  const id = metadata.id || fileName;

  const chunks = splitIntoChunks(body);

  return {
    source: title,
    fileName,
    category,
    id,
    chunks
  };
}

/**
 * Read and chunk all markdown files from the docs directory
 * @param {string} docsDir - Path to documents directory
 * @returns {Array<{ content: string, source: string, category: string, chunkIndex: number }>}
 */
export function chunkAllDocs(docsDir = config.docsDir) {
  const files = readdirSync(docsDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
  const allChunks = [];

  for (const file of files) {
    const filePath = join(docsDir, file);
    const { source, category, chunks } = chunkFile(filePath);

    for (let i = 0; i < chunks.length; i++) {
      allChunks.push({
        content: chunks[i],
        source,
        category,
        chunkIndex: i,
        totalChunks: chunks.length
      });
    }
  }

  console.log(`📄 Processed ${files.length} documents → ${allChunks.length} chunks`);
  return allChunks;
}

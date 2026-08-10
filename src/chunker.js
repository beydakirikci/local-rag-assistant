// src/chunker.js — Document chunking module (Upgraded: Semantic Chunking & PDF Support)
// Splits documents into meaningful, overlapping chunks for vector storage

import { readFileSync, readdirSync } from 'fs';
import { join, basename, extname } from 'path';
import config from './config.js';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import * as cheerio from 'cheerio';

/**
 * Parse optional YAML front-matter from markdown content
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
 * Smart Semantic Splitter (Recursive Character Text Splitter)
 * Tries to split by double newline (paragraphs), then single newline, then period, then space.
 */
function smartSplit(text, maxLen = 800, overlap = 150) {
  if (text.length <= maxLen) return [text];

  const separators = ['\n\n', '\n', '. ', ' '];
  let chosenSeparator = '';
  
  for (const sep of separators) {
    if (text.includes(sep)) {
      chosenSeparator = sep;
      break;
    }
  }

  const splits = text.split(chosenSeparator);
  const chunks = [];
  let currentChunk = '';

  for (const split of splits) {
    const piece = split + chosenSeparator;
    if ((currentChunk.length + piece.length) > maxLen && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Create overlap
      const overlapStart = Math.max(0, currentChunk.length - overlap);
      currentChunk = currentChunk.slice(overlapStart) + piece;
    } else {
      currentChunk += piece;
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Fetch and chunk content from a URL
 * @param {string} url - The URL to fetch
 * @returns {Promise<{ source: string, category: string, chunks: string[] }>}
 */
export async function chunkUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status}`);
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Remove scripts, styles, and non-content elements
  $('script, style, noscript, nav, footer, header, aside').remove();
  
  let title = $('title').text() || url;
  title = title.replace(/\s+/g, ' ').trim();
  
  // Get text from body
  let content = $('body').text();
  
  // Clean up content (remove excessive newlines and spaces)
  content = content.replace(/\n\s*\n/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
  
  if (content.length < 50) {
    throw new Error('Not enough readable text found on this webpage.');
  }

  const chunks = smartSplit(content, 800, 150);

  return {
    source: title,
    category: 'Web',
    chunks
  };
}

/**
 * Read and chunk a single file (.md, .txt, .pdf)
 * @param {string} filePath - Path to the file
 * @returns {Promise<{ source: string, fileName: string, category: string, chunks: string[] }>}
 */
export async function chunkFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  const fileName = basename(filePath, ext);
  let content = '';
  let metadata = {};

  if (ext === '.pdf') {
    const dataBuffer = readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    content = data.text;
  } else {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = parseFrontMatter(raw);
    metadata = parsed.metadata;
    content = parsed.body;
  }

  const title = metadata.title || fileName;
  const category = metadata.category || 'General';

  // Clean up content
  content = content.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  
  const chunks = smartSplit(content, 800, 150); // Using roughly 800 chars per chunk (~150 words)

  return {
    source: title,
    fileName,
    category,
    chunks
  };
}

/**
 * Read and chunk all files from the docs directory
 * @param {string} docsDir - Path to documents directory
 * @returns {Promise<Array<{ content: string, source: string, category: string, chunkIndex: number }>>}
 */
export async function chunkAllDocs(docsDir = config.docsDir) {
  const files = readdirSync(docsDir).filter(f => f.match(/\.(md|txt|pdf)$/i));
  const allChunks = [];

  for (const file of files) {
    const filePath = join(docsDir, file);
    const { source, category, chunks } = await chunkFile(filePath);

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

  console.log(`📄 Processed ${files.length} documents → ${allChunks.length} smart chunks`);
  return allChunks;
}

# 🤖 Local RAG Assistant

A fully offline **RAG (Retrieval-Augmented Generation)** powered Q&A assistant using **Microsoft Foundry Local**. Ask questions about your documents — all processing happens on your device with zero internet dependency.

![Architecture](https://img.shields.io/badge/Architecture-RAG-blueviolet)
![Runtime](https://img.shields.io/badge/Runtime-Foundry%20Local-blue)
![Status](https://img.shields.io/badge/Status-Offline%20Ready-green)

## ✨ Features

- 🔒 **Fully Offline** — No internet, no API keys, no cloud. Everything runs locally.
- 🤖 **Foundry Local Integration** — Uses Microsoft's on-device AI runtime with Phi-4 model.
- 🔍 **RAG Pipeline** — Retrieves relevant document chunks before generating answers.
- 📊 **TF-IDF Vector Search** — Fast keyword-based retrieval with cosine similarity.
- 🗄️ **SQLite Storage** — Lightweight, serverless database for document vectors.
- 🌐 **Modern Web UI** — Dark theme, streaming responses, mobile-responsive.
- 📄 **Runtime Document Upload** — Add new documents without restarting.
- 🌍 **Bilingual** — Supports both Turkish and English Q&A.

## 🏗️ Architecture

```
User (Browser) → Express.js Server → RAG Pipeline
                                      ├── TF-IDF Vectorization
                                      ├── SQLite Vector Store
                                      └── Foundry Local (Phi-4)
```

| Layer | Technology | Purpose |
|-------|-----------|---------|
| AI Model | Foundry Local + Phi-4 | On-device inference, no GPU required |
| Backend | Node.js + Express | HTTP server with SSE streaming |
| Vector Store | SQLite (better-sqlite3) | Zero-infrastructure document storage |
| Retrieval | TF-IDF + Cosine Similarity | Fast, offline keyword matching |
| Frontend | Single HTML file | No build step, mobile-responsive |

## 🚀 Quick Start

### Prerequisites

1. **Node.js 20+**: [Download](https://nodejs.org/)
2. **Foundry Local**: Install via terminal:
   ```bash
   winget install Microsoft.FoundryLocal
   ```

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/local-rag-assistant.git
cd local-rag-assistant

# Install dependencies
npm install

# Ingest documents into the vector store
npm run ingest

# Start the server
npm start
```

Open **http://127.0.0.1:3000** in your browser. The model will download automatically on first run (~2 GB).

## 📁 Project Structure

```
local-rag-assistant/
├── docs/                    # Knowledge base documents (.md)
│   ├── yapay-zeka-nedir.md
│   ├── machine-learning-intro.md
│   └── ...
├── src/
│   ├── server.js            # Express HTTP server
│   ├── chatEngine.js        # RAG pipeline orchestrator
│   ├── vectorStore.js       # TF-IDF + SQLite vector store
│   ├── chunker.js           # Document chunking module
│   ├── prompts.js           # System prompts
│   └── config.js            # Configuration
├── public/
│   └── index.html           # Web UI (single file)
├── scripts/
│   └── ingest.js            # Document ingestion script
├── data/                    # SQLite database (auto-generated)
├── package.json
└── README.md
```

## 📖 How It Works

1. **Ingestion** (`npm run ingest`): Reads markdown files from `docs/`, splits them into ~200 word chunks, computes TF-IDF vectors, and stores everything in SQLite.

2. **Query**: When you ask a question, the system:
   - Converts your question into a TF-IDF vector
   - Searches SQLite for the most similar document chunks
   - Builds a prompt with the retrieved context
   - Sends it to the local Phi-4 model via Foundry Local
   - Streams the response back to your browser

3. **Response**: The model generates an answer grounded in your documents, with source citations.

## 🔧 Configuration

Edit `src/config.js` to customize:

| Setting | Default | Description |
|---------|---------|-------------|
| `model` | `phi-4` | Foundry Local model name |
| `chunkSize` | `200` | Words per chunk |
| `chunkOverlap` | `25` | Overlap between chunks |
| `topK` | `3` | Number of chunks to retrieve |
| `port` | `3000` | Server port |

## 📄 Adding Your Own Documents

1. Create `.md` files in the `docs/` directory with optional YAML front-matter:
   ```markdown
   ---
   title: Your Document Title
   category: Category Name
   id: unique-id
   ---

   # Your Content Here
   ...
   ```

2. Run the ingestion pipeline:
   ```bash
   npm run ingest
   ```

3. Or upload documents via the web UI at runtime!

## 🛠️ Technologies

- **[Microsoft Foundry Local](https://learn.microsoft.com/en-us/ai/foundry-local/)** — On-device AI runtime
- **[Express.js](https://expressjs.com/)** — Web server
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** — SQLite binding
- **TF-IDF** — Term frequency–inverse document frequency vectorization

## 📝 License

MIT License — See [LICENSE](LICENSE) for details.

---

Built with ❤️ using Microsoft Foundry Local | Summer School 2026

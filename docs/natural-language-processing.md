---
title: Natural Language Processing
category: NLP
id: nlp-01
---

# Natural Language Processing (NLP)

Natural Language Processing (NLP) is a branch of artificial intelligence that empowers computers to understand, interpret, generate, and manipulate human language. By bridging the gap between human communication and computational logic, NLP powers modern technologies ranging from search engines to translation tools and conversational AI.

## Key Pipeline and Preprocessing Steps

Before processing text with machine learning algorithms, raw text undergoes several fundamental preprocessing steps:

- **Tokenization:** Breaking down raw text into smaller units such as words, subwords, or individual characters (tokens).
- **Stop Words Removal:** Eliminating common words (e.g., "is", "the", "and") that add little semantic value.
- **Stemming and Lemmatization:** Reducing words to their root forms (e.g., "running" becomes "run").
- **Vectorization / Embedding:** Converting text tokens into numerical vectors (Word2Vec, GloVe, contextual embeddings) that preserve semantic similarity in a multi-dimensional space.

## Core NLP Tasks

1. **Sentiment Analysis:** Classifying text based on emotional tone (positive, negative, neutral) for customer feedback and social media monitoring.
2. **Named Entity Recognition (NER):** Identifying and categorizing key entities in text, such as person names, organizations, locations, and dates.
3. **Machine Translation:** Translating text from one language to another while preserving grammar and context.
4. **Text Summarization:** Generating concise summaries of long articles or documents (extractive or abstractive).
5. **Question Answering:** Extracting or generating precise answers to user queries based on context.

## The Transformer Era in NLP

Traditionally, NLP relied on rule-based systems and recurrent neural networks (RNNs/LSTMs). The introduction of the **Transformer** architecture in 2017 revolutionized the field by enabling parallel processing of text and capturing long-range semantic relationships through self-attention mechanisms. Today, models like BERT and GPT represent the cutting edge of NLP technology.

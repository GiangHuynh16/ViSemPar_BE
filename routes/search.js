const fetch = require('node-fetch');
const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const { getPipeline } = require('../utils/embeddings');
const { generateAMR, compareAMR } = require('../utils/amrParser');

const PORT = process.env.PORT || 8080;

// 1. Keyword Search
router.get('/keyword', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const startTime = Date.now();

        const results = await Book.find(
            { $text: { $search: query } },
            { score: { $meta: 'textScore' } }
        )
            .sort({ score: { $meta: 'textScore' } })
            .limit(10)
            .lean();

        res.json({
            method: 'keyword',
            results,
            count: results.length,
            timeMs: Date.now() - startTime
        });
    } catch (error) {
        console.error('Keyword search error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Embedding Search
router.get('/embedding', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const startTime = Date.now();

        // Generate query embedding
        const queryEmbedding = await generateEmbedding(query);

        // Get all books with embeddings
        const books = await Book.find({
            embedding: { $exists: true, $ne: [] }
        }).lean();

        // Calculate cosine similarity
        const results = books.map(book => {
            let similarity = 0;
            for (let i = 0; i < queryEmbedding.length; i++) {
                similarity += queryEmbedding[i] * book.embedding[i];
            }
            return {
                ...book,
                similarity
            };
        })
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 10);

        res.json({
            method: 'embedding',
            results,
            count: results.length,
            timeMs: Date.now() - startTime
        });
    } catch (error) {
        console.error('Embedding search error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Semantic Search (AMR)
router.get('/semantic', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const startTime = Date.now();

        // Generate AMR for query
        const queryAMR = await generateAMR(query);

        if (!queryAMR) {
            return res.status(500).json({
                error: 'Failed to generate AMR. Is FastAPI running?'
            });
        }

        // Get all books with AMR
        const books = await Book.find({
            amr: { $exists: true, $ne: '' }
        }).lean();

        // Calculate AMR similarity
        const results = books.map(book => ({
            ...book,
            similarity: compareAMR(queryAMR, book.amr)
        }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 10);

        res.json({
            method: 'semantic',
            queryAMR,
            results,
            count: results.length,
            timeMs: Date.now() - startTime
        });
    } catch (error) {
        console.error('Semantic search error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 4. Compare All Methods
router.get('/compare', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        console.log(`🔍 Comparing search methods for: "${query}"`);

        // Run all searches in parallel
        // const [keywordRes, embeddingRes, semanticRes] = await Promise.allSettled([
        //   fetch(`http://localhost:${process.env.PORT}/api/search/keyword?query=${encodeURIComponent(query)}`).then(r => r.json()),
        //   fetch(`http://localhost:${process.env.PORT}/api/search/embedding?query=${encodeURIComponent(query)}`).then(r => r.json()),
        //   fetch(`http://localhost:${process.env.PORT}/api/search/semantic?query=${encodeURIComponent(query)}`).then(r => r.json())
        // ]);

        const [keywordRes, embeddingRes, semanticRes] = await Promise.allSettled([
            fetch(`http://localhost:${PORT}/api/search/keyword?query=${encodeURIComponent(query)}`).then(r => r.json()),
            fetch(`http://localhost:${PORT}/api/search/embedding?query=${encodeURIComponent(query)}`).then(r => r.json()),
            fetch(`http://localhost:${PORT}/api/search/semantic?query=${encodeURIComponent(query)}`).then(r => r.json())
        ]);


        const results = {
            keyword: keywordRes.status === 'fulfilled' ? keywordRes.value : { error: 'Failed', results: [], count: 0, timeMs: 0 },
            embedding: embeddingRes.status === 'fulfilled' ? embeddingRes.value : { error: 'Failed', results: [], count: 0, timeMs: 0 },
            semantic: semanticRes.status === 'fulfilled' ? semanticRes.value : { error: 'Failed', results: [], count: 0, timeMs: 0 }
        };

        res.json({
            query,
            results
        });
    } catch (error) {
        console.error('Compare search error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

/*
const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const { generateEmbedding } = require('../utils/embeddings');
const { generateAMR, compareAMR } = require('../utils/amrParser');

// Hàm tìm kiếm keyword
async function keywordSearch(query) {
  return await Book.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  )
  .sort({ score: { $meta: 'textScore' } })
  .limit(10)
  .lean();
}

// Hàm tìm kiếm embedding
async function embeddingSearch(query) {
  const queryEmbedding = await generateEmbedding(query);

  const books = await Book.find({ embedding: { $exists: true, $ne: [] } }).lean();

  const results = books.map(book => {
    let similarity = 0;
    for (let i = 0; i < queryEmbedding.length; i++) {
      similarity += queryEmbedding[i] * book.embedding[i];
    }
    return {
      ...book,
      similarity
    };
  })
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, 10);

  return results;
}

// Hàm tìm kiếm semantic (AMR)
async function semanticSearch(query) {
  const queryAMR = await generateAMR(query);

  if (!queryAMR) {
    throw new Error('Failed to generate AMR. Is FastAPI running?');
  }

  const books = await Book.find({ amr: { $exists: true, $ne: '' } }).lean();

  const results = books.map(book => ({
    ...book,
    similarity: compareAMR(queryAMR, book.amr)
  }))
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, 10);

  return { queryAMR, results };
}

// 1. Keyword Search route
router.get('/keyword', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const startTime = Date.now();

    const results = await keywordSearch(query);

    res.json({
      method: 'keyword',
      results,
      count: results.length,
      timeMs: Date.now() - startTime
    });

  } catch (error) {
    console.error('Keyword search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Embedding Search route
router.get('/embedding', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const startTime = Date.now();

    const results = await embeddingSearch(query);

    res.json({
      method: 'embedding',
      results,
      count: results.length,
      timeMs: Date.now() - startTime
    });

  } catch (error) {
    console.error('Embedding search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Semantic Search route
router.get('/semantic', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const startTime = Date.now();

    const { queryAMR, results } = await semanticSearch(query);

    res.json({
      method: 'semantic',
      queryAMR,
      results,
      count: results.length,
      timeMs: Date.now() - startTime
    });

  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Compare all methods route
router.get('/compare', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`🔍 Comparing search methods for: "${query}"`);

    const startTime = Date.now();

    // Chạy song song 3 phương pháp tìm kiếm
    const [keywordRes, embeddingRes, semanticRes] = await Promise.all([
      keywordSearch(query),
      embeddingSearch(query),
      semanticSearch(query),
    ]);

    res.json({
      query,
      results: {
        keyword: {
          method: 'keyword',
          results: keywordRes,
          count: keywordRes.length,
        },
        embedding: {
          method: 'embedding',
          results: embeddingRes,
          count: embeddingRes.length,
        },
        semantic: {
          method: 'semantic',
          queryAMR: semanticRes.queryAMR,
          results: semanticRes.results,
          count: semanticRes.results.length,
        }
      },
      timeMs: Date.now() - startTime,
    });

  } catch (error) {
    console.error('Compare search error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
*/
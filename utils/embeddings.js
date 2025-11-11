// const { pipeline } = require('@xenova/transformers');

async function getPipeline() {
  const { pipeline } = await import('@xenova/transformers');
  const embedder = pipeline('feature-extraction');
  return embedder;
}

module.exports = { getPipeline };

let embedder = null;

async function initEmbedder() {
  if (!embedder) {
    console.log('⏳ Loading embedding model...');
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/paraphrase-multilingual-MiniLM-L12-v2'
    );
    console.log('✅ Embedding model loaded');
  }
  return embedder;
}

async function generateEmbedding(text) {
  try {
    const model = await initEmbedder();
    const output = await model(text, { 
      pooling: 'mean', 
      normalize: true 
    });
    return Array.from(output.data);
  } catch (error) {
    console.error('Embedding generation error:', error.message);
    throw error;
  }
}

module.exports = { generateEmbedding };
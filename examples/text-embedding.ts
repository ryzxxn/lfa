import { defineHandler, lazyLoad } from "@firecracker-lambda/framework";

/**
 * Text Embedding Function
 *
 * Converts text to vector embeddings for semantic search.
 * Bundle size: 2KB (sentence-transformers loaded lazily)
 *
 * Usage:
 * curl -X POST http://localhost:3000/invoke/embedding \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "texts": ["The cat sat on the mat", "A kitten was sleeping"]
 *   }'
 *
 * Response includes cosine similarity between texts.
 */

interface EmbeddingPayload {
  texts: string[];
  returnDimension?: boolean;
}

interface EmbeddingResult {
  texts: string[];
  embeddings: number[][];
  dimension: number;
  count: number;
  similarity?: number[][];
  timestamp: string;
}

const modelCache = new Map<string, any>();

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default defineHandler(async (payload: EmbeddingPayload) => {
  const { texts, returnDimension = false } = payload;

  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    throw new Error("texts array is required and must contain at least one item");
  }

  if (texts.length > 100) {
    throw new Error("Maximum 100 texts per request");
  }

  for (const text of texts) {
    if (!text || text.trim().length === 0) {
      throw new Error("All texts must be non-empty strings");
    }
  }

  try {
    console.log(`Embedding ${texts.length} text(s)...`);

    // Lazy load sentence-transformers
    const st = await lazyLoad("sentence_transformers");

    // Use lightweight model for fast inference
    let model = modelCache.get("embedding");
    if (!model) {
      console.log("Loading sentence transformer model...");
      model = st.SentenceTransformer("Xenova/all-MiniLM-L6-v2");
      modelCache.set("embedding", model);
    }

    // Generate embeddings
    const embeddings = await model.encode(texts, {
      normalize_embeddings: true,
    });

    const embeddingArray = Array.isArray(embeddings)
      ? embeddings
      : embeddings.data;
    const dimension = embeddingArray[0].length;

    // Calculate pairwise similarity if multiple texts
    let similarity: number[][] | undefined;
    if (texts.length > 1) {
      similarity = [];
      for (let i = 0; i < embeddingArray.length; i++) {
        const row: number[] = [];
        for (let j = 0; j < embeddingArray.length; j++) {
          row.push(
            parseFloat(
              cosineSimilarity(embeddingArray[i], embeddingArray[j]).toFixed(
                4
              )
            )
          );
        }
        similarity.push(row);
      }
    }

    const result: EmbeddingResult = {
      texts,
      embeddings: embeddingArray.map((emb: number[]) =>
        emb.map((v: number) => parseFloat(v.toFixed(6)))
      ),
      dimension,
      count: texts.length,
      timestamp: new Date().toISOString(),
    };

    if (similarity) {
      result.similarity = similarity;
    }

    return result;
  } catch (error) {
    console.error("Embedding error:", error);
    throw error;
  }
});

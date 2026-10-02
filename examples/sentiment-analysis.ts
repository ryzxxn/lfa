import { defineHandler, lazyLoad } from "@firecracker-lambda/framework";

/**
 * Sentiment Analysis Function
 *
 * Analyzes text sentiment (positive/negative/neutral).
 * Bundle size: 2KB (transformers loaded lazily at runtime)
 *
 * Usage:
 * curl -X POST http://localhost:3000/invoke/sentiment \
 *   -H "Content-Type: application/json" \
 *   -d '{"text":"This movie is amazing!"}'
 */

interface SentimentPayload {
  text: string;
  threshold?: number;
}

interface SentimentResult {
  text: string;
  sentiment: {
    label: string;
    score: number;
  };
  timestamp: string;
  cached: boolean;
}

// Cache models to avoid reloading
const modelCache = new Map<string, any>();

export default defineHandler(async (payload: SentimentPayload) => {
  const { text, threshold = 0.5 } = payload;

  if (!text || text.trim().length === 0) {
    throw new Error("text parameter is required and cannot be empty");
  }

  if (text.length > 10000) {
    throw new Error("text must be less than 10,000 characters");
  }

  try {
    // Lazy load transformers (2KB function, transformers loaded at runtime)
    console.log("Loading transformers...");
    const tf = await lazyLoad("transformers");

    // Check cache for model
    let pipeline = modelCache.get("sentiment");
    let cached = true;

    if (!pipeline) {
      console.log("Creating sentiment pipeline...");
      // Use distilbert for fast inference
      pipeline = tf.pipeline(
        "sentiment-analysis",
        {
          model: "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
        }
      );
      modelCache.set("sentiment", pipeline);
      cached = false;
    }

    // Run inference
    console.log(`Analyzing text: "${text.substring(0, 50)}..."`);
    const [result] = await pipeline(text, { truncate: true });

    return {
      text,
      sentiment: {
        label: result.label,
        score: parseFloat(result.score.toFixed(4)),
      },
      timestamp: new Date().toISOString(),
      cached,
    } as SentimentResult;
  } catch (error) {
    console.error("Sentiment analysis error:", error);
    throw error;
  }
});

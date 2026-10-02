import { defineHandler, lazyLoad } from "@firecracker-lambda/framework";

/**
 * Zero-Shot Text Classification
 *
 * Classifies text into provided categories without training.
 * Bundle size: 2KB (transformers loaded lazily)
 *
 * Usage:
 * curl -X POST http://localhost:3000/invoke/classifier \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "text": "The stock market crashed today",
 *     "categories": ["finance", "sports", "weather"]
 *   }'
 */

interface ClassificationPayload {
  text: string;
  categories: string[];
  multiLabel?: boolean;
}

interface ClassificationResult {
  text: string;
  categories: string[];
  labels: Array<{
    label: string;
    score: number;
  }>;
  topLabel: string;
  topScore: number;
  timestamp: string;
}

const modelCache = new Map<string, any>();

export default defineHandler(async (payload: ClassificationPayload) => {
  const { text, categories, multiLabel = false } = payload;

  if (!text || text.trim().length === 0) {
    throw new Error("text parameter is required");
  }

  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    throw new Error("categories array is required and must not be empty");
  }

  if (categories.length > 20) {
    throw new Error("Maximum 20 categories allowed");
  }

  if (text.length > 5000) {
    throw new Error("text must be less than 5,000 characters");
  }

  try {
    console.log(
      `Classifying text into ${categories.length} categories...`
    );

    // Lazy load transformers
    const tf = await lazyLoad("transformers");

    // Check cache
    let pipeline = modelCache.get("classification");
    if (!pipeline) {
      console.log("Loading zero-shot classification model...");
      pipeline = tf.pipeline("zero-shot-classification", {
        model: "Xenova/mobilebert-uncased-mnli",
      });
      modelCache.set("classification", pipeline);
    }

    // Run classification
    const result = await pipeline(text, categories, {
      multi_label: multiLabel,
    });

    // Sort by score (descending)
    const sorted = result.scores
      .map((score: number, idx: number) => ({
        label: result.labels[idx],
        score: parseFloat(score.toFixed(4)),
      }))
      .sort((a: any, b: any) => b.score - a.score);

    return {
      text: text.substring(0, 100), // Truncate for response
      categories,
      labels: sorted,
      topLabel: sorted[0].label,
      topScore: sorted[0].score,
      timestamp: new Date().toISOString(),
    } as ClassificationResult;
  } catch (error) {
    console.error("Classification error:", error);
    throw error;
  }
});

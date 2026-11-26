const VISION_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const EMBEDDING_MODEL_URL = "https://huggingface.co/litert-community/MediaPipe-ImageEmbedder-MobileNet-V3-Small/resolve/45a8f4237a3175e9d580be1e267b10681f323813/mobilenet_v3_small.tflite";

function cosineSimilarity(left, right) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

export async function embedPhotos(photos, onProgress, onStatus) {
  const { FilesetResolver, ImageEmbedder } = await import("@mediapipe/tasks-vision");
  onStatus?.("Loading the on-device visual model…");
  const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);
  const embedder = await ImageEmbedder.createFromOptions(vision, {
    baseOptions: { modelAssetPath: EMBEDDING_MODEL_URL },
    runningMode: "IMAGE",
    l2Normalize: true,
  });
  const analyzedPhotos = [];
  const embeddings = [];
  const failures = [];

  try {
    for (const [index, photo] of photos.entries()) {
      try {
        const image = new Image();
        image.src = photo.url;
        await image.decode();
        const embedding = embedder.embed(image).embeddings[0]?.floatEmbedding;
        if (!embedding) throw new Error("The visual model returned no image features.");
        analyzedPhotos.push(photo);
        embeddings.push(Array.from(embedding));
      } catch (error) {
        failures.push({
          photo,
          message: error.message || "Could not analyze this photo.",
        });
      }
      onProgress?.(index + 1, photos.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    embedder.close();
  }

  return { photos: analyzedPhotos, embeddings, failures };
}

export function groupSimilarEmbeddings(embeddings, threshold = 0.88) {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new RangeError("Similarity threshold must be between 0 and 1.");
  }
  if (!Array.isArray(embeddings)) throw new TypeError("Image embeddings must be an array.");
  if (!embeddings.length) return [];

  const vectors = embeddings.map((embedding) => Array.from(embedding));
  const vectorSize = vectors[0].length;
  if (!vectorSize || vectors.some((vector) => (
    vector.length !== vectorSize || vector.some((value) => !Number.isFinite(value))
  ))) {
    throw new TypeError("Image embeddings must be finite vectors of equal length.");
  }

  const similarities = vectors.map(() => []);
  const candidates = [];
  for (let left = 0; left < vectors.length; left += 1) {
    for (let right = left + 1; right < vectors.length; right += 1) {
      const similarity = cosineSimilarity(vectors[left], vectors[right]);
      similarities[left][right] = similarity;
      similarities[right][left] = similarity;
      if (similarity >= threshold) candidates.push({ left, right, similarity });
    }
  }
  candidates.sort((left, right) => right.similarity - left.similarity);

  const clusters = new Map(vectors.map((_, index) => [index, [index]]));
  const clusterForIndex = vectors.map((_, index) => index);
  for (const { left, right } of candidates) {
    const leftClusterId = clusterForIndex[left];
    const rightClusterId = clusterForIndex[right];
    if (leftClusterId === rightClusterId) continue;

    const leftCluster = clusters.get(leftClusterId);
    const rightCluster = clusters.get(rightClusterId);
    const completeMatch = leftCluster.every((leftIndex) =>
      rightCluster.every((rightIndex) => similarities[leftIndex][rightIndex] >= threshold)
    );
    if (!completeMatch) continue;

    const merged = [...leftCluster, ...rightCluster].sort((a, b) => a - b);
    clusters.set(leftClusterId, merged);
    clusters.delete(rightClusterId);
    for (const index of rightCluster) clusterForIndex[index] = leftClusterId;
  }

  return [...clusters.values()].sort((left, right) => left[0] - right[0]);
}

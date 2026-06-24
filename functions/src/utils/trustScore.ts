export function computeLayer1(params: {
  classifier_confidence: number;
  geo_accuracy_meters: number;
  photo_count: number;
  device_timestamp: number;
  server_timestamp: number;
  photo_timestamp: number | null;
}): number {
  const { classifier_confidence, geo_accuracy_meters, photo_count,
          device_timestamp, server_timestamp, photo_timestamp } = params;

  let score = 0;

  // Classifier confidence (0–50)
  score += Math.round(classifier_confidence * 50);

  // GPS accuracy
  if (geo_accuracy_meters <= 10) score += 10;
  else if (geo_accuracy_meters <= 50) score += 5;

  // Photo present
  if (photo_count >= 1) score += 5;

  // Device time vs server time (within 5 minutes)
  if (Math.abs(device_timestamp - server_timestamp) <= 300000) score += 5;

  // Stale photo penalty (photo older than 30 days)
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (photo_timestamp && (server_timestamp - photo_timestamp) > thirtyDaysMs) score -= 10;

  // Clamp to [0, 70]
  return Math.max(0, Math.min(70, score));
}

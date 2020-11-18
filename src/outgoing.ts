import { logger } from "./utility/logger";
import { twitterClient } from "./utility/twitter-client";

export async function sendAnswer(summary: any): Promise<void> {
  const client = twitterClient();
  const status = summary.wordFrequency
    .splice(0, 5)
    .map((element: any) => element[0])
    .join(", ");
  const sentimentScore = summary.sentiment.documentSentiment.score || 0;
  const sentimentScoreRounded = Number.parseFloat(sentimentScore).toFixed(2);
  const magnitudeScore = summary.sentiment.documentSentiment.magnitude || 0;
  const magnitudeScoreRounded = Number.parseFloat(magnitudeScore).toFixed(2);
  let sentimentScoreString = "Neutral";
  if (sentimentScore <= -0.25 && sentimentScore >= -1) {
    sentimentScoreString = "Negative";
  } else if (sentimentScore <= 0.25 && sentimentScore >= -0.25) {
    sentimentScoreString = "Neutral";
  } else if (sentimentScore <= 1 && sentimentScore >= 0.25) {
    sentimentScoreString = "Positive";
  }
  try {
    return await client.post("statuses/update", {
      status: `Most frequent words last 7 days: ${status.slice(
        0,
        120
      )}. Sentiment score: ${sentimentScoreRounded}, magnitude: ${magnitudeScoreRounded} (Tend to be ${sentimentScoreString}).`,
      in_reply_to_status_id: summary.replyToStatusId || "",
      auto_populate_reply_metadata: true,
    });
  } catch (error) {
    logger.error(error);
    return;
  }
}

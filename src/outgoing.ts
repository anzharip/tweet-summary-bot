import { google } from "@google-cloud/language/build/protos/protos";
import { logger } from "./utility/logger";
import { twitterClient } from "./utility/twitter/twitter-client";

export async function sendAnswer(summary: {
  wordFrequency: [string, number][];
  replyToStatusId: string;
  sentiment: google.cloud.language.v1.IAnalyzeSentimentResponse;
}): Promise<void> {
  const client = twitterClient();
  const status = summary.wordFrequency
    .splice(0, 5)
    .map((element: [string, number]) => element[0])
    .join(", ");
  if (summary.sentiment.documentSentiment === null) {
    throw new Error("documentSentiment is null. ");
  }
  if (summary.sentiment.documentSentiment === undefined) {
    throw new Error("documentSentiment is undefined. ");
  }
  const sentimentScore = summary.sentiment.documentSentiment.score || 0;
  const sentimentScoreRounded = Number.parseFloat(
    String(sentimentScore)
  ).toFixed(2);
  const magnitudeScore = summary.sentiment.documentSentiment.magnitude || 0;
  const magnitudeScoreRounded = Number.parseFloat(
    String(magnitudeScore)
  ).toFixed(2);
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

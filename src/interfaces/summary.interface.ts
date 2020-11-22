import { google } from "@google-cloud/language/build/protos/protos";

export interface Summary {
  wordFrequency: [string, number][];
  replyToStatusId: string;
  sentiment: google.cloud.language.v1.IAnalyzeSentimentResponse;
}

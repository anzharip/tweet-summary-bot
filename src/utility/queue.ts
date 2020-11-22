import { google } from "@google-cloud/language/build/protos/protos";
import { Tweet } from "../interfaces/twitter/tweet.interface";

export const queueQuestion: Tweet[] = [];
export const queueSummary: {
    wordFrequency: [string, number][];
    replyToStatusId: string;
    sentiment: google.cloud.language.v1.IAnalyzeSentimentResponse;
}[] = [];
export const queueReport: unknown[] = [];

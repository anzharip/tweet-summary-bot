import language from "@google-cloud/language";
import { google } from "@google-cloud/language/build/protos/protos";

export const sentiment = new language.LanguageServiceClient();

export async function analyseSentiment(text: string): Promise<google.cloud.language.v1.IAnalyzeSentimentResponse> {
  const document: google.cloud.language.v1.IDocument = {
    content: text,
    type: "PLAIN_TEXT",
  };

  // Detects the sentiment of the text
  const [result] = await sentiment.analyzeSentiment({ document: document });
  return result;
}

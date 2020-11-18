import Translate from "@google-cloud/translate";

export const translate = new Translate.v2.Translate();

export async function translateText(text: string): Promise<[string, unknown]> {
  // Translates the text into the target language. "text" can be a string for
  // translating a single piece of text, or an array of strings for translating
  // multiple texts.
  return await translate.translate(
    text,
    process.env.GOOGLE_API_TRANSLATE_TARGET_LANGUAGE || "en"
  );
}

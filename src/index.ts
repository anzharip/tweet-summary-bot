// Make sure dotenv import is as high as possible to make sure the the env
// variables is loaded properly before any other imports that depends on it
// (ref: https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import)
import "dotenv/config";
import sw from "stopword";
import TextCleaner from "text-cleaner";
import { retrieveQuestion } from "./incoming";
import { WordFrequency } from "./interfaces/word-frequency.interface";
import { sendAnswer } from "./outgoing";
import { axiosClient } from "./utility/axios-retry-configuration";
import { sentiment } from "./utility/gcp/sentiment";
import { translate } from "./utility/gcp/translate";
import { logger } from "./utility/logger";
import { queueQuestion, queueSummary } from "./utility/queue";
import { regexTwitterHandle, regexURL } from "./utility/regex";

const token = process.env.TWITTER_BEARER_TOKEN || "";
const recentSearchURL = "https://api.twitter.com/2/tweets/search/recent";

async function recentSearch(username: string) {
  // Edit query parameters below
  const parameters = {
    query: `from:${username} -is:retweet`,
    "tweet.fields": "author_id",
    max_results: 100,
  };

  const response = await axiosClient().get(recentSearchURL, {
    params: parameters,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status !== 200) throw new Error(JSON.stringify(response.data));

  return response.data;
}

async function generateWordFrequency(words: string[]) {
  if (words.length === 0) {
    return;
  }
  const wordFrequency: WordFrequency = {};
  words.forEach((element: string) => {
    // Keep track of occurences
    if (Object.prototype.hasOwnProperty.call(wordFrequency, element)) {
      wordFrequency[element] += 1;
    } else {
      wordFrequency[element] = 1;
    }
  });

  const wordFrequencyArray = Object.entries(wordFrequency);
  wordFrequencyArray.sort((a, b) => b[1] - a[1]);

  return wordFrequencyArray.map((element) => {
    element[1] = (element[1] / words.length) * 100;
    return element;
  });
}

async function generateWordsArray(tweets: any) {
  if (tweets.length === 0) {
    return;
  }
  let recentTweetsConcat = "";
  if (tweets["data"]) {
    tweets["data"].forEach((element: any) => {
      if (element.text)
        recentTweetsConcat = recentTweetsConcat + " " + element.text;
    });
  }
  // Remove twitter handle
  recentTweetsConcat = recentTweetsConcat.replace(regexTwitterHandle, "");
  // Remove URL
  recentTweetsConcat = recentTweetsConcat.replace(regexURL, "");
  const recentTweetsConcatClean = TextCleaner(recentTweetsConcat)
    .stripHtml()
    .removeChars()
    .condense()
    .toLowerCase()
    .valueOf();

  // cleanup english and indonesian stop word
  return sw.removeStopwords(recentTweetsConcatClean.split(" "), [
    ...sw.en,
    ...sw.id,
  ]);
}

async function translateText(text: string) {
  // Translates the text into the target language. "text" can be a string for
  // translating a single piece of text, or an array of strings for translating
  // multiple texts.
  return await translate.translate(
    text,
    process.env.GOOGLE_API_TRANSLATE_TARGET_LANGUAGE || "en"
  );
}

async function analyseSentiment(text: string) {
  const document: any = {
    content: text,
    type: "PLAIN_TEXT",
  };

  // Detects the sentiment of the text
  const [result] = await sentiment.analyzeSentiment({ document: document });
  return result;
}

async function generateSummary(question: any) {
  try {
    const recentTweets = await recentSearch(question.in_reply_to_user_id_str);
    const wordsArray = await generateWordsArray(recentTweets);
    const wordFrequency = await generateWordFrequency(wordsArray);
    const translate: unknown = await translateText(wordsArray.join(" "));
    const sentiment = await analyseSentiment(translate as string);
    return {
      wordFrequency: wordFrequency,
      replyToStatusId: question.id_str || "",
      sentiment: sentiment,
    };
  } catch (error) {
    logger.error(error);
    return;
  }
}

async function app() {
  retrieveQuestion();

  setInterval(async () => {
    const question = await queueQuestion.shift();
    if (question) {
      const summary = await generateSummary(question);
      if (summary) queueSummary.push(summary);
    }
  }, 1000);

  setInterval(async () => {
    const summary = queueSummary.shift();
    if (summary) {
      try {
        sendAnswer(summary);
      } catch (error) {
        logger.error(error);
      }
    }
  }, 1000);

  logger.info("Service has been started!");
}

(async () => {
  app();
})();

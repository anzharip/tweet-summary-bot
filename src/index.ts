import language from "@google-cloud/language";
import Translate from "@google-cloud/translate";
import axios from "axios";
import axiosRetry from "axios-retry";
import * as dotenv from "dotenv";
import pino from "pino";
import sw from "stopword";
import TextCleaner from "text-cleaner";
import Twitter from "twitter-lite";
import { Tweet } from "./interfaces/twitter/tweet.interface";
import { WordFrequency } from "./interfaces/word-frequency.interface";

dotenv.config();

const logger = pino({
  prettyPrint: true,
});

const regexTwitterHandle = /(\s+|^)@\S+/g;
const regexURL = /(?:https?|ftp):\/\/[\S\n]+/g;

const translate = new Translate.v2.Translate();
const sentiment = new language.LanguageServiceClient();

axiosRetry(axios, {
  retries: Infinity,
  shouldResetTimeout: true,
  retryDelay: (retryNumber = 0) => {
    return 60000 * Math.pow(2, retryNumber);
  },
  retryCondition: (error): boolean => {
    logger.error(error);
    return true;
  },
});

const twitterLiteConfig = {
  subdomain: "api", // "api" is the default (change for other subdomains)
  version: "1.1", // version "1.1" is the default (change for other subdomains)
  consumer_key: process.env.TWITTER_API_KEY || "", // from Twitter.
  consumer_secret: process.env.TWITTER_API_SECRET_KEY || "", // from Twitter.
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY || "", // from your User (oauth_token)
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET_KEY || "", // from your User (oauth_token_secret)
};

const queueQuestion: Tweet[] = [];
const queueSummary: any[] = [];
const queueReport: any[] = [];

const token = process.env.TWITTER_BEARER_TOKEN || "";
const recentSearchURL = "https://api.twitter.com/2/tweets/search/recent";

async function recentSearch(username: string) {
  // Edit query parameters below
  const parameters = {
    query: `from:${username} -is:retweet`,
    "tweet.fields": "author_id",
    max_results: 100,
  };

  const response = await axios.get(recentSearchURL, {
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

async function isTweetLooping(tweet: Tweet) {
  // check if in reply to of the incoming tweets is replying to the bot or not
  return tweet.in_reply_to_screen_name ===
    (process.env.TWITTER_ACCOUNT_TO_LISTEN as string).replace("@", "")
    ? true
    : false;
}

async function retrieveQuestion() {
  const client = new Twitter(twitterLiteConfig);

  const parameters = {
    track: process.env.TWITTER_ACCOUNT_TO_LISTEN || "",
  };

  client
    .stream("statuses/filter", parameters)
    .on("start", () => logger.info("Streaming start"))
    .on("data", async (data: Tweet) => {
      if ((await isTweetLooping(data)) === false) {
        queueQuestion.push(data);
      }
    })
    .on("ping", () => logger.info("Keepalive received"))
    .on("error", (error) => logger.error(error))
    .on("end", () => logger.info("Streaming end"));
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

async function sendAnswer(summary: any) {
  const client = new Twitter(twitterLiteConfig);
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

import axios from "axios";
import axiosRetry from "axios-retry";
import * as dotenv from "dotenv";
import sw from "stopword";
import TextCleaner from "text-cleaner";
import Twitter from "twitter-lite";
import { WordFrequency } from "./interfaces/word-frequency.interface";

dotenv.config();

axiosRetry(axios, {
  retries: Infinity,
  shouldResetTimeout: true,
  retryDelay: (retryNumber = 0) => {
    return 60000 * Math.pow(2, retryNumber);
  },
  retryCondition: (error): boolean => {
    console.log(JSON.stringify(error));
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

const queueQuestion: any[] = [];
const queueSummary: any[] = [];
const queueReport: any[] = [];

const token = process.env.TWITTER_BEARER_TOKEN || "";
const recentSearchURL = "https://api.twitter.com/2/tweets/search/recent";

async function recentSearch(username: string) {
  // Edit query parameters below
  const parameters = {
    query: `from:${username} -is:retweet`,
    "tweet.fields": "author_id",
    max_results: "100",
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

async function retrieveQuestion() {
  const client = new Twitter(twitterLiteConfig);

  const parameters = {
    track: process.env.TWITTER_ACCOUNT_TO_LISTEN || "",
  };

  client
    .stream("statuses/filter", parameters)
    .on("start", () => console.log("Streaming start"))
    .on("data", (data) => {
      queueQuestion.push(data);
    })
    .on("ping", () => console.log("Keepalive received"))
    .on("error", (error) => console.log("error", error))
    .on("end", () => console.log("Streaming end"));
}

async function generateSummary(question: any) {
  try {
    const recentTweets = await recentSearch(question.in_reply_to_user_id_str);
    const wordsArray = await generateWordsArray(recentTweets);
    const wordFrequency = await generateWordFrequency(wordsArray);
    return {
      wordFrequency: wordFrequency,
      replyToStatusId: question.id_str || "",
    };
  } catch (error) {
    console.log(error);
    return;
  }
}

async function sendAnswer(summary: any) {
  const client = new Twitter(twitterLiteConfig);
  const status = summary.wordFrequency.splice(0, 5).map((element: any) => element[0]).join(", ")
  try {
    return await client.post("statuses/update", {
      status: `Most frequent words: ${status.slice(0, 120)}`,
      in_reply_to_status_id: summary.replyToStatusId || "",
      auto_populate_reply_metadata: true,
    });
  } catch (error) {
    console.log(error);
    return;
  }
}

async function app() {
  retrieveQuestion();

  setInterval(async () => {
    const question = await queueQuestion.shift();
    if (question) {
      console.log(question);
      const summary = await generateSummary(question);
      console.log(summary);
      if (summary) queueSummary.push(summary);
    }
  }, 1000);

  setInterval(async () => {
    const summary = queueSummary.shift();
    if (summary) {
      try {
        sendAnswer(summary);
      } catch (error) {
        console.log(error);
      }
    }
  }, 1000);

  console.log("Service has been started!");
}

(async () => {
  app();
})();

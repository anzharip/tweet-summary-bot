import axios from "axios";
import axiosRetry from "axios-retry";
import * as dotenv from "dotenv";
import sw from "stopword";
import TextCleaner from "text-cleaner";
import Twitter from "twitter-lite";

dotenv.config();

axiosRetry(axios, {
  retries: Infinity,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error): boolean => {
    console.log(JSON.stringify(error.message));
    return true;
  },
});

const queueQuestion: any[] = [];
const queueSummary: any[] = [];
const queueReport: any[] = [];

// The code below sets the bearer token from your environment variables
// To set environment variables on Mac OS X, run the export command below from the terminal:
// export BEARER_TOKEN='YOUR-TOKEN'
const token = process.env.TWITTER_BEARER_TOKEN;

const rulesURL = "https://api.twitter.com/2/tweets/search/stream/rules";
const streamURL =
  "https://api.twitter.com/2/tweets/search/stream?expansions=attachments.poll_ids,attachments.media_keys,author_id,entities.mentions.username,geo.place_id,in_reply_to_user_id,referenced_tweets.id,referenced_tweets.id.author_id";
const recentSearchURL = "https://api.twitter.com/2/tweets/search/recent";

// Edit rules as desired here below
const rules = [
  { value: `${process.env.TWITTER_ACCOUNT_TO_LISTEN}`, tag: "monitor-mention" },
];

async function getAllRules() {
  const response = await axios.get(rulesURL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status !== 200) throw new Error(response.data);

  return response.data;
}

async function deleteAllRules(rules: any) {
  if (!Array.isArray(rules.data)) {
    return;
  }

  const ids = rules.data.map((rule: any) => rule.id);

  const data = {
    delete: {
      ids: ids,
    },
  };

  const response = await axios.post(rulesURL, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status !== 201) throw new Error(JSON.stringify(response.data));

  return response.data;
}

async function setRules() {
  const data = {
    add: rules,
  };

  const response = await axios.post(rulesURL, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status !== 201) throw new Error(JSON.stringify(response.data));

  return response.data;
}

async function streamConnect(token: any) {
  //Listen to the stream

  return axios
    .get(streamURL, {
      timeout: 20000,
      responseType: "stream",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .then((response) => {
      const data = response.data;
      data
        .on("data", (data: any) => {
          try {
            const json = JSON.parse(data);
            console.log({ json });
            queueQuestion.push(json);
          } catch (error) {
            // Keep alive signal received. Do nothing.
            console.log(JSON.stringify(error));
            console.log("keepalive received");
          }
        })
        .on("error", (error: any) => {
          console.log(error);
        })
        .on("end", (error: any) => {
          if (error) console.log("An error ocurred: " + error.message);
          else console.log("Stream end event. ");
        })
        .on("close", () => {
          console.log("Stream close event. ");
        });
      return response;
    })
    .catch((error) => console.log(JSON.stringify(error)));
}

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
  interface WordFrequency {
    [key: string]: number;
  }
  const wordFrequency: WordFrequency = {};
  words.forEach((element: string) => {
    if (Object.prototype.hasOwnProperty.call(wordFrequency, element)) {
      wordFrequency[element] += 1;
    } else {
      wordFrequency[element] = 1;
    }
  });

  const wordFrequencyArray = Object.entries(wordFrequency);
  wordFrequencyArray.sort((a, b) => b[1] - a[1]);

  const wordFrequencyArrayInPercent = wordFrequencyArray.map((element) => {
    element[1] = (element[1] / words.length) * 100;
    return element;
  });

  return wordFrequencyArrayInPercent.splice(0, 10);
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
  let currentRules;

  try {
    // Gets the complete list of rules currently applied to the stream
    currentRules = await getAllRules();

    // Delete all rules. Comment the line below if you want to keep your existing rules.
    await deleteAllRules(currentRules);

    // Add rules to the stream. Comment the line below if you don't want to add new rules.
    await setRules();
  } catch (error) {
    console.error(JSON.stringify(error));
  }

  // Listen to the stream.
  // This reconnection logic will attempt to reconnect when a disconnection is detected.
  // To avoid rate limites, this logic implements exponential backoff, so the wait time
  // will increase if the client cannot reconnect to the stream.

  await streamConnect(token);
}

async function generateSummary(question: any) {
  try {
    const recentTweets = await recentSearch(question.data.in_reply_to_user_id);
    const wordsArray = await generateWordsArray(recentTweets);
    const wordFrequency = await generateWordFrequency(wordsArray);
    return {
      wordFrequency: wordFrequency,
      replyToStatusId: question.data.id || "",
    };
  } catch (error) {
    console.log(error);
    return;
  }
}

async function sendAnswer(summary: any) {
  const client = new Twitter({
    subdomain: "api", // "api" is the default (change for other subdomains)
    version: "1.1", // version "1.1" is the default (change for other subdomains)
    consumer_key: process.env.TWITTER_API_KEY || "", // from Twitter.
    consumer_secret: process.env.TWITTER_API_SECRET_KEY || "", // from Twitter.
    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY || "", // from your User (oauth_token)
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET_KEY || "", // from your User (oauth_token_secret)
  });
  try {
    return await client.post("statuses/update", {
      status: JSON.stringify(summary.wordFrequency).slice(0, 120),
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

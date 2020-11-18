import sw from "stopword";
import TextCleaner from "text-cleaner";
import { WordFrequency } from "../../interfaces/word-frequency.interface";
import { axiosClient } from "../axios-retry-configuration";
import { analyseSentiment } from "../gcp/sentiment";
import { translateText } from "../gcp/translate";
import { logger } from "../logger";
import { regexTwitterHandle, regexURL } from "../regex";

const token = process.env.TWITTER_BEARER_TOKEN || "";
const recentSearchURL = "https://api.twitter.com/2/tweets/search/recent";

export async function recentSearch(username: string) {
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

export async function generateWordFrequency(words: string[]) {
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

export async function generateWordsArray(tweets: any) {
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

export async function generateSummary(question: any) {
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

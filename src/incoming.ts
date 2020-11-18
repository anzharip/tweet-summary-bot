import { Tweet } from "./interfaces/twitter/tweet.interface";
import { logger } from "./utility/logger";
import { queueQuestion } from "./utility/queue";
import { isTweetLooping } from "./utility/tweet-checks";
import { twitterClient } from "./utility/twitter-client";

export function retrieveQuestion(): void {
  const client = twitterClient();

  const parameters = {
    track: process.env.TWITTER_ACCOUNT_TO_LISTEN || "",
  };

  client
    .stream("statuses/filter", parameters)
    .on("start", () => logger.info("Streaming start"))
    .on("data", async (data: Tweet) => {
      if (isTweetLooping(data) === false) {
        queueQuestion.push(data);
      }
    })
    .on("ping", () => logger.info("Keepalive received"))
    .on("error", (error) => logger.error(error))
    .on("end", () => logger.info("Streaming end"));
}

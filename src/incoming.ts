import { Tweet } from "./interfaces/twitter/tweet.interface";
import { logger } from "./utility/logger";
import { queueQuestion } from "./utility/queue";
import { isTweetLooping } from "./utility/twitter/tweet-checks";
import { twitterClient } from "./utility/twitter/twitter-client";

export function retrieveQuestion(endRetries = 0): void {
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
    .on("error", (error) => {
      logger.error(error);
      throw new Error(`Stream error: ${JSON.stringify(error)}`);
    })
    .on("end", (error) => {
      logger.error(`Stream error: ${JSON.stringify(error)}`);
      if (endRetries < 11) {
        endRetries += 1;
        setInterval(
          () => retrieveQuestion(endRetries),
          Math.pow(2, endRetries) * 1000
        );
      } else {
        retrieveQuestion(0);
      }
    });
}

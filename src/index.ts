// Make sure dotenv import is as high as possible to make sure the the env
// variables is loaded properly before any other imports that depends on it
// (ref: https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import)
import "dotenv/config";
import { retrieveQuestion } from "./incoming";
import { sendAnswer } from "./outgoing";
import { logger } from "./utility/logger";
import { queueQuestion, queueSummary } from "./utility/queue";
import { generateSummary } from "./utility/twitter/tweet-utilities";

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

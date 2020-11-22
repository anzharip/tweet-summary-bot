# tweet-summary-bot

A twitter bot written in Typescript to check the most frequent words and sentiment analysis by a particular twitter user. Currently focused on English and Bahasa Indonesia.

## How it works:

1. Reply to a tweet of the user that you want to analyze, and mention the user defined in the `TWITTER_ACCOUNT_TO_LISTEN` environment variable.
2. The account set with `TWITTER_API_KEY, TWITTER_API_SECRET_KEY, TWITTER_ACCESS_TOKEN_KEY, TWITTER_ACCESS_TOKEN_SECRET_KEY, TWITTER_BEARER_TOKEN` will reply to the your tweet with the information.

![Screen Shot 2020-11-07 at 10 59 23](https://user-images.githubusercontent.com/10259593/98431468-4cec7b00-20e8-11eb-892d-380bc7a63364.png)

## Environment Variables

```bash
TWITTER_API_KEY=xxx
TWITTER_API_SECRET_KEY=xxx
TWITTER_ACCESS_TOKEN_KEY=xxx
TWITTER_ACCESS_TOKEN_SECRET_KEY=xxx
TWITTER_BEARER_TOKEN=xxx
TWITTER_ACCOUNT_TO_LISTEN=@sometwitterhandle
GOOGLE_API_TRANSLATE_TARGET_LANGUAGE=en
GOOGLE_APPLICATION_CREDENTIALS=google-application-credentials/credentials.json
HEALTHCHECK_PORT=3000
```

Notes:

1. More info about `GOOGLE_API_TRANSLATE_TARGET_LANGUAGE`: https://cloud.google.com/translate/docs/languages
2. More info about `GOOGLE_APPLICATION_CREDENTIALS`: https://cloud.google.com/docs/authentication/getting-started
3. You can do a periodic healthcheck on this service by hitting the http://0.0.0.0:3000/status endpoint.

## Running the app

```
# development
$ npm run start:dev

# production mode
$ npm run build && npm run start
```

# Prav

Prav is a Telegram bot for Urban Renovation. It uses Express, Telegraf and GCP services.

## Get started

- Create your bot with BotFather and get your Telegram token
- Install dependencies (`yarn` or `npm i`)
- Download `serviceAccounKey.json` from your Google Cloud Console

## Run it locally

Create `.env` file in project root and set next variables:

    NODE_ENV=dev
    GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
    BOT_TOKEN={YOUR_TELEGRAM_TOKEN}

Run using yarn

    yarn run dev

Run using npm

    npm run dev

## Deployment

Create app.yaml with following:

```yaml
runtime: nodejs10
env_variables:
  BOT_TOKEN: "{YOUR_TELEGRAM_TOKEN}"
```

Deploy to Google App Engine

    gcloud app deploy
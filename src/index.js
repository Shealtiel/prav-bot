const bot = require('./bot')

const env = process.env.NODE_ENV

if (env === 'production') {
  const port = process.env.PORT || 8080
  const secretUrl = process.env.BOT_TOKEN
  const projectId = process.env.GOOGLE_CLOUD_PROJECT

  bot.telegram.setWebhook(`https://${projectId}.appspot.com/${secretUrl}`)

  bot.startWebhook(`/${secretUrl}`, null, port)
} else {
  bot.startPolling()
}

const express = require('express')

const bot = require('./bot')

const env = process.env.NODE_ENV
const app = express()

// Use webhooks for 'production' and pooling for 'dev'
if (env === 'production') {
  const port = process.env.PORT || 8080
  const secretUrl = process.env.BOT_TOKEN
  const projectId = process.env.GOOGLE_CLOUD_PROJECT

  app.use(bot.webhookCallback(`/${secretUrl}`))
  app.get(`/${secretUrl}`, (_req, res) => res.send(200))
  app.listen(port, () => {
    console.log(`Server listening on port ${port}...`)
  })
  bot.telegram.setWebhook(`https://${projectId}.appspot.com/${secretUrl}`)
} else {
  bot.startPolling()
}

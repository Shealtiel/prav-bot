const path = require('path')
const Telegraf = require('telegraf')
const session = require('telegraf/session')
const Stage = require('telegraf/stage')
const { enter } = require('telegraf/stage')
const TelegrafI18n = require('telegraf-i18n')
const { reply } = require('telegraf-i18n')
const updateLogger = require('telegraf-update-logger')

const { users } = require('./init-firebase')
const scenes = require('./scenes')

const i18n = new TelegrafI18n({
  defaultLanguage: 'ru',
  allowMissing: true,
  directory: path.resolve(__dirname, 'locales')
})

const token = process.env.BOT_TOKEN
const bot = new Telegraf(token, {
  telegram: {
    webhookReply: true
  }
})
const stage = new Stage([scenes.ticketCreationFlow])

bot.use(
  updateLogger({
    colors: true
  })
)
bot.use(session())
bot.use(i18n.middleware())
bot.use(stage.middleware())

// Show greeting and save user info to firestore /users
bot.start(({ from, reply, i18n }) => {
  let userId = from.id
  let userInfo = from
  delete userInfo.id
  users.doc(`${userId}`).set(userInfo)

  reply(i18n.t('base_greeting', { name: from.first_name }))
})

// Show available commands
bot.help(reply('base_help'))

// Scenes
bot.command('add', enter('ticketCreationFlow'))

module.exports = bot

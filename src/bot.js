const path = require('path')
const Telegraf = require('telegraf')
const session = require('telegraf/session')
const Markup = require('telegraf/markup')
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
const bot = new Telegraf(token)
const stage = new Stage([scenes.ticketCreationFlow, scenes.ticketModerationScene])

stage.command('cancel', ({ scene, reply, i18n }) => {
  if (Object.keys(scene.state).length !== 0) {
    reply(i18n.t('cancelled'), Markup.removeKeyboard().extra())
  } else {
    reply(i18n.t('nothing_to_cancel'))
  }
  scene.leave()
})

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
  reply(i18n.t('greeting', { name: from.first_name }))
  let userId = from.id
  let userInfo = from
  delete userInfo.id
  users.doc(`${userId}`).set(userInfo)
})

// Show available commands
bot.help(reply('help'))

// Scenes
bot.command('add', enter('ticketCreationFlow'))
bot.command('mod', async ({ from, scene }) => {
  const user = await users.doc(`${from.id}`).get()
  const role = user.data().role
  if (role === 'admin' || role === 'mod') {
    return scene.enter('ticketModerationScene')
  }
})

module.exports = bot

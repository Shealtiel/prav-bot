const uuid = require('uuid')
const fileType = require('file-type')
const rp = require('request-promise')
const Scene = require('telegraf/scenes/base')
const Markup = require('telegraf/markup')
const { match, reply } = require('telegraf-i18n')

const { tickets, admin } = require('./init-firebase')

const bucket = admin.storage().bucket()

const categories = [
  'green_spaces',
  'garbage',
  'road',
  'sau',
  'ads',
  'landscaping'
]

const writeFileFromUrlToStorage = async (ticketId, fileUrl) => {
  const options = {
    method: 'GET',
    uri: fileUrl,
    encoding: null
  }
  let fileId = uuid()
  let buffer = await rp(options)
  let fileMeta = fileType(buffer)
  const path = `tickets/${ticketId}/images/${fileId}.${fileMeta.ext}`
  let fileStream = bucket
    .file(path)
    .createWriteStream({
      metadata: {
        contentType: fileMeta.mime
      }
    })
  await fileStream.write(buffer)
  fileStream.end()
  fileStream.on('finish', () => {
    console.log(`New photos uploaded for ticket: ${fileId}!`)
    return path
  })
}

const addButtons = ctx => {
  if (ctx.scene.ticket.desc && ctx.scene.ticket.loc) {
    ctx.reply(
      ctx.i18n.t('request_category'),
      Markup.keyboard(
        categories.map(string => {
          return ctx.i18n.t(string)
        }),
        {
          columns: 3
        }
      )
        .resize()
        .oneTime()
        .extra()
    )
  }
}

//
// Scene for creating and sending tickets
//

const ticketCreationFlow = new Scene('ticketCreationFlow')

ticketCreationFlow.use((ctx, next) => {
  const messageId = ctx.message
    ? ctx.message.message_id
    : ctx.editedMessage.message_id
  ctx.keyboardOptions = {
    reply_to_message_id: messageId
  }
  next()
})

ticketCreationFlow.enter(({ scene, from, reply, i18n }) => {
  scene.ticket = {}
  scene.ticket.userId = from.id
  scene.fileUrls = []
  scene.ticket.timestamp = admin.firestore.Timestamp.now()

  return reply(i18n.t('enter_creation'))
})

ticketCreationFlow.command('cancel', ({ reply, scene, i18n }) => {
  reply(i18n.t('cancelled'), Markup.removeKeyboard().extra())
  scene.leave()
})

ticketCreationFlow.help(reply('help_creation'))

// Send ticket to firestore

ticketCreationFlow.hears(
  categories.map(match),
  async ({ scene, reply, i18n, message }) => {
    scene.ticket.category = message.text

    let ref = await tickets.add(scene.ticket)
    for (let fileUrl of scene.fileUrls) {
      writeFileFromUrlToStorage(ref.id, fileUrl)
    }
    scene.leave()

    return reply(
      i18n.t('sended_ticket', { id: ref.id }),
      Markup.removeKeyboard().extra()
    )
  }
)

ticketCreationFlow.on(['text', 'edited_message'], ctx => {
  ctx.scene.ticket.desc = ctx.message
    ? ctx.message.text
    : ctx.editedMessage.text

  ctx.reply(ctx.i18n.t('added_desc'), ctx.keyboardOptions)
  return addButtons(ctx)
})

ticketCreationFlow.on('photo', async ctx => {
  const fileUrl = await ctx.telegram.getFileLink(
    ctx.message.photo.pop().file_id
  )
  ctx.scene.fileUrls.push(fileUrl)

  ctx.reply(ctx.i18n.t('added_photo'), ctx.keyboardOptions)
})

ticketCreationFlow.on('location', async ctx => {
  let newLoc = ctx.message.location
  ctx.scene.ticket.loc = await new admin.firestore.GeoPoint(
    newLoc.latitude,
    newLoc.longitude
  )

  ctx.reply(ctx.i18n.t('added_location'), ctx.keyboardOptions)
  return addButtons(ctx)
})

//
// Scene for moderating tickets
//

const ticketModerationScene = new Scene('ticketModerationScene')

ticketModerationScene.enter(reply('enter_mod'))
ticketModerationScene.leave(reply('leave_mod'))
ticketModerationScene.help(reply('help_mod'))
ticketModerationScene.command('cancel', ({ scene }) => scene.leave())
ticketModerationScene.command('list', async ({ reply, replyWithPhoto }) => {
  let list = await tickets
    .orderBy('timestamp')
    .limit(3)
    .get()
  // TODO: Add inline keyboard for navigating
  for (let ticket of list.docs) {
    const images = await bucket.getFiles({
      prefix: `tickets/${ticket.id}/images`
    })
    reply(`Id: ${ticket.id}`)
    for (let image of images[0]) {
      await replyWithPhoto({
        source: image.createReadStream()
      })
    }
    reply(`User: ${ticket.data().userId}`)
    reply(`Описание: ${ticket.data().desc}`)
  }
})

module.exports = {
  ticketCreationFlow,
  ticketModerationScene
}

const uuid = require('uuid')
const fileType = require('file-type')
const rp = require('request-promise')
const Scene = require('telegraf/scenes/base')
const Markup = require('telegraf/markup')
const { match, reply } = require('telegraf-i18n')

const { tickets, admin } = require('./init-firebase')
const bucket = admin.storage().bucket()
const categories = [
  'category_green_spaces',
  'category_garbage',
  'category_road',
  'category_sau',
  'category_ads',
  'category_landscaping'
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
  let fileStream = bucket.file(path).createWriteStream({
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
  if (ctx.scene.state.ticket.desc && ctx.scene.state.ticket.loc) {
    ctx.reply(
      ctx.i18n.t('creation_request_category'),
      Markup.keyboard(categories.map(string => ctx.i18n.t(string)), {
        columns: 3
      })
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
  scene.state.ticket = {}
  scene.state.ticket.userId = from.id
  scene.state.fileUrls = []
  scene.state.ticket.timestamp = admin.firestore.Timestamp.now()

  return reply(i18n.t('creation_enter'))
})

ticketCreationFlow.command('cancel', ({ reply, scene, i18n }) => {
  reply(i18n.t('creation_leave'), Markup.removeKeyboard().extra())
  scene.leave()
})

ticketCreationFlow.help(reply('creation_help'))

// Send ticket to firestore
ticketCreationFlow.hears(
  categories.map(match),
  async ({ scene, reply, i18n, message }) => {
    scene.state.ticket.category = message.text

    let ref = await tickets.add(scene.state.ticket)
    for (let fileUrl of scene.state.fileUrls) {
      writeFileFromUrlToStorage(ref.id, fileUrl)
    }
    scene.leave()

    return reply(
      i18n.t('creation_sended', { id: ref.id }),
      Markup.removeKeyboard().extra()
    )
  }
)

ticketCreationFlow.on(['text', 'edited_message'], ctx => {
  ctx.scene.state.ticket.desc = ctx.message
    ? ctx.message.text
    : ctx.editedMessage.text

  ctx.reply(ctx.i18n.t('creation_add'), ctx.keyboardOptions)
  return addButtons(ctx)
})

ticketCreationFlow.on('photo', async ctx => {
  const fileUrl = await ctx.telegram.getFileLink(
    ctx.message.photo.pop().file_id
  )
  ctx.scene.state.fileUrls.push(fileUrl)

  ctx.reply(ctx.i18n.t('creation_add'), ctx.keyboardOptions)
})

ticketCreationFlow.on('location', async ctx => {
  let newLoc = ctx.message.location
  ctx.scene.state.ticket.loc = await new admin.firestore.GeoPoint(
    newLoc.latitude,
    newLoc.longitude
  )

  ctx.reply(ctx.i18n.t('creation_add'), ctx.keyboardOptions)
  return addButtons(ctx)
})

module.exports = {
  ticketCreationFlow
}

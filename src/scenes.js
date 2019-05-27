const uuid = require('uuid')
const fileType = require('file-type')
const rp = require('request-promise')
const Scene = require('telegraf/scenes/base')
const Markup = require('telegraf/markup')
const { match } = require('telegraf-i18n')

const { tickets, admin } = require('./init-firebase')
const bucket = admin.storage().bucket()
const categories = [
  'category_green_spaces',
  'category_garbage',
  'category_road',
  'category_sau',
  'category_ads',
  'category_landscaping',
  'category_other'
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
  if (
    ctx.scene.state.ticket.desc &&
    ctx.scene.state.ticket.loc &&
    ctx.scene.state.fileUrls[0]
  ) {
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

function addReply (ctx) {
  const messageId = ctx.message
    ? ctx.message.message_id
    : ctx.editedMessage.message_id
  return {
    reply_to_message_id: messageId
  }
}

const sendTicketToFirestore = async ctx => {
  if (
    ctx.scene.state.ticket.desc &&
    ctx.scene.state.ticket.loc &&
    ctx.scene.state.fileUrls[0]
  ) {
    let ref = await tickets.add(ctx.scene.state.ticket)
    for (let fileUrl of ctx.scene.state.fileUrls) {
      writeFileFromUrlToStorage(ref.id, fileUrl)
    }
    ctx.scene.leave()

    return ctx.reply(
      ctx.i18n.t('creation_sended', { id: ref.id }),
      Markup.removeKeyboard().extra()
    )
  }
}

//
// Scene for creating and sending tickets
//

const ticketCreationFlow = new Scene('ticketCreationFlow')

ticketCreationFlow.enter(({ scene, from, reply, i18n }) => {
  scene.state.ticket = {}
  scene.state.ticket.status = 'new'
  scene.state.ticket.userId = from.id
  scene.state.fileUrls = []
  scene.state.ticket.timestamp = admin.firestore.Timestamp.now()

  return reply(i18n.t('creation_enter'))
})

ticketCreationFlow.command('cancel', ({ reply, scene, i18n }) => {
  scene.leave()
  return reply(i18n.t('creation_leave'), Markup.removeKeyboard().extra())
})

ticketCreationFlow.command('help', ({ reply, i18n }) =>
  reply(i18n.t('creation_help'))
)

// Send ticket to firestore
// TODO: Need refactor!
ticketCreationFlow.hears(match('category_green_spaces'), ctx => {
  ctx.scene.state.ticket.category = 'green_spaces'
  return sendTicketToFirestore(ctx)
})

ticketCreationFlow.hears(match('category_other'), ctx => {
  ctx.scene.state.ticket.category = 'other'
  return sendTicketToFirestore(ctx)
})

ticketCreationFlow.hears(match('category_garbage'), ctx => {
  ctx.scene.state.ticket.category = 'garbage'
  return sendTicketToFirestore(ctx)
})

ticketCreationFlow.hears(match('category_ads'), ctx => {
  ctx.scene.state.ticket.category = 'ads'
  return sendTicketToFirestore(ctx)
})

ticketCreationFlow.hears(match('category_landscaping'), ctx => {
  ctx.scene.state.ticket.category = 'landscaping'
  return sendTicketToFirestore(ctx)
})

ticketCreationFlow.hears(match('category_road'), ctx => {
  ctx.scene.state.ticket.category = 'road'
  return sendTicketToFirestore(ctx)
})

ticketCreationFlow.hears(match('category_sau'), ctx => {
  ctx.scene.state.ticket.category = 'sau'
  return sendTicketToFirestore(ctx)
})

ticketCreationFlow.on(['text', 'edited_message'], ctx => {
  ctx.scene.state.ticket.desc = ctx.message
    ? ctx.message.text
    : ctx.editedMessage.text

  addButtons(ctx)
  return ctx.reply(ctx.i18n.t('creation_add'), addReply(ctx))
})

ticketCreationFlow.on('photo', async ctx => {
  const fileUrl = await ctx.telegram.getFileLink(
    ctx.message.photo.pop().file_id
  )
  ctx.scene.state.fileUrls.push(fileUrl)

  addButtons(ctx)
  return ctx.reply(ctx.i18n.t('creation_add'), addReply(ctx))
})

ticketCreationFlow.on('location', async ctx => {
  let newLoc = ctx.message.location
  ctx.scene.state.ticket.loc = await new admin.firestore.GeoPoint(
    newLoc.latitude,
    newLoc.longitude
  )

  addButtons(ctx)
  return ctx.reply(ctx.i18n.t('creation_add'), addReply(ctx))
})

module.exports = {
  ticketCreationFlow
}

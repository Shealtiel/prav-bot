const uuid = require('uuid')
const fileType = require('file-type')
const rp = require('request-promise')
const Scene = require('telegraf/scenes/base')
const Markup = require('telegraf/markup')
const { match, reply } = require('telegraf-i18n')

const { tickets, admin } = require('./init-firebase')

const bucket = admin.storage().bucket()

const sendToDB = async ticket => {
  let newRef = await tickets.add(ticket)
  return newRef.id
}

const writeFileFromUrlToStorage = async (ticketId, fileUrl) => {
  let fileId = uuid()
  let options = {
    method: 'GET',
    uri: fileUrl,
    encoding: null
  }

  let buffer = await rp(options)
  let fileMeta = fileType(buffer)
  let fileStream = bucket
    .file(`tickets/${ticketId}/images/${fileId}.${fileMeta.ext}`)
    .createWriteStream({
      metadata: {
        contentType: fileMeta.mime
      }
    })
  await fileStream.write(buffer)
  fileStream.end()
  fileStream.on('finish', () => {
    console.log(`New photos uploaded for ticket: ${fileId}!`)
  })
}

const showSendButton = ctx => {
  const ticket = ctx.scene.state.ticket
  if (ticket.desc && ticket.loc) {
    return Markup.keyboard([ctx.i18n.t('send')])
      .resize()
      .oneTime()
      .extra()
  } else {
    return Markup.removeKeyboard().extra()
  }
}

//
// Scene for creating and sendind tickets
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

  return reply(i18n.t('enter_creation'))
})

ticketCreationFlow.help(reply('help_creation'))

// Send ticket to firestore
ticketCreationFlow.hears(match('send'), async ({ scene, reply, i18n }) => {
  let res = await sendToDB(scene.state.ticket)
  for (let fileUrl of scene.state.fileUrls) {
    writeFileFromUrlToStorage(res, fileUrl)
  }
  scene.leave()

  return reply(
    i18n.t('sended_ticket', { id: res }),
    Markup.removeKeyboard().extra()
  )
})

ticketCreationFlow.on(['text', 'edited_message'], ctx => {
  ctx.scene.state.ticket.desc = ctx.message
    ? ctx.message.text
    : ctx.editedMessage.text
  ctx.keyboardOptions.reply_markup = showSendButton(ctx).reply_markup
  return ctx.reply(ctx.i18n.t('added_desc'), ctx.keyboardOptions)
})

ticketCreationFlow.on('photo', async ctx => {
  const fileUrl = await ctx.telegram.getFileLink(
    ctx.message.photo.pop().file_id
  )
  ctx.scene.state.fileUrls.push(fileUrl)
  ctx.keyboardOptions.reply_markup = showSendButton(ctx).reply_markup
  return ctx.reply(ctx.i18n.t('added_photo'), ctx.keyboardOptions)
})

ticketCreationFlow.on('location', async ctx => {
  let newLoc = ctx.message.location
  ctx.scene.state.ticket.loc = await new admin.firestore.GeoPoint(
    newLoc.latitude,
    newLoc.longitude
  )
  ctx.keyboardOptions.reply_markup = showSendButton(ctx).reply_markup
  return ctx.reply(ctx.i18n.t('added_location'), ctx.keyboardOptions)
})

ticketCreationFlow.command('cancel', async ({ scene, i18n }) => {
  await reply(i18n.t('cancelled'), Markup.removeKeyboard().extra())
  scene.leave()
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

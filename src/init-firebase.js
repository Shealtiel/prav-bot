const admin = require('firebase-admin')

const serviceAccount = require('../serviceAccountKey.json')
const projectId = serviceAccount.project_id

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${projectId}.firebaseio.com`,
  storageBucket: `${projectId}.appspot.com`
})

const users = admin.firestore().collection('users')
const tickets = admin.firestore().collection('tickets')

module.exports = {
  admin,
  users,
  tickets
}

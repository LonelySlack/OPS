const admin = require('firebase-admin')

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
})

const sendPush = async (token, title, body) => {
  try {
    await admin.messaging().send({
      token,
      notification: {
        title,
        body,
      },
    })
  } catch (err) {
    console.error('Push error:', err)
  }
}

module.exports = { sendPush }
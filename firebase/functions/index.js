/* ============================================================
   Гомін — пуш через Firebase Cloud Messaging

   Функція спрацьовує на кожне нове повідомлення й надсилає
   сповіщення на пристрої одержувача. Потрібна лише для пушу,
   коли застосунок закрито: саме листування працює без неї.

   Розгортання:
     cd firebase
     firebase deploy --only functions

   Cloud Functions вимагають тарифу Blaze. Кому це не підходить —
   у теці push-relay лежить той самий пуш через власний сервер на
   безкоштовному плані.
   ============================================================ */
'use strict';

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/* Текст листування у сповіщення не кладемо: у шторці має бути
   видно, що написав друг, а не що саме. Відкритий застосунок
   покаже повідомлення сам. */
function bodyFor(msg, name) {
  const who = name || 'Нове повідомлення';
  if (msg.type === 'image') return who + ' надіслав(ла) фото';
  if (msg.type === 'voice') return who + ' надіслав(ла) голосове';
  return 'Нове повідомлення від ' + who;
}

exports.notifyOnMessage = onDocumentCreated(
  { document: 'chats/{chatId}/msgs/{msgId}', region: 'europe-central2' },
  async event => {
    const msg = event.data && event.data.data();
    if (!msg || !msg.from) return;

    const chatId = event.params.chatId;
    const chatSnap = await db.doc('chats/' + chatId).get();
    const chat = chatSnap.data();
    if (!chat || !Array.isArray(chat.members)) return;

    const to = chat.members.filter(uid => uid !== msg.from);
    if (!to.length) return;

    const fromSnap = await db.doc('users/' + msg.from).get();
    const from = fromSnap.exists ? fromSnap.data() : {};
    const name = from.name || (from.username ? '@' + from.username : '');
    const senderChatId = 'homin-' + (from.username || '');

    for (const uid of to) {
      const devices = await db.collection('users/' + uid + '/devices').get();
      const tokens = devices.docs.map(d => d.data().fcm).filter(Boolean);
      if (!tokens.length) continue;

      const res = await admin.messaging().sendEachForMulticast({
        tokens,
        webpush: {
          notification: {
            title: 'Гомін',
            body: bodyFor(msg, name),
            icon: 'icons/icon-192.png',
            badge: 'icons/favicon-64.png',
            tag: 'chat:' + senderChatId
          },
          fcmOptions: { link: './?a=chat&c=' + encodeURIComponent(senderChatId) }
        },
        data: { chatId: senderChatId, tag: 'chat:' + senderChatId }
      });

      /* Прибираємо токени пристроїв, яких уже немає. */
      const dead = [];
      res.responses.forEach((r, i) => {
        const code = r.error && r.error.code;
        if (code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-argument') dead.push(devices.docs[i].ref);
      });
      await Promise.all(dead.map(ref => ref.update({ fcm: admin.firestore.FieldValue.delete() })));
      if (res.failureCount) logger.warn('частину сповіщень не доставлено', res.failureCount);
    }
  }
);

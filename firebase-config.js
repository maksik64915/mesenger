/* ============================================================
   Гомін — дані вашого проєкту Firebase

   Хмара необовʼязкова: без неї застосунок працює як і раніше —
   напряму між пристроями. З нею акаунт перестає бути привʼязаним
   до одного телефона, повідомлення доходять до співрозмовника,
   який зараз офлайн, і працює пуш через FCM.

   Що зробити у console.firebase.google.com:
     1. Створити проєкт.
     2. Authentication → Sign-in method → увімкнути Email/Password.
     3. Firestore Database → Create database.
     4. Firestore → Rules → вставити firebase/firestore.rules.
     5. Project settings → Your apps → Web (</>) → скопіювати
        значення firebaseConfig сюди.
     6. Для пушу: Project settings → Cloud Messaging →
        Web Push certificates → Generate key pair → ключ у vapidKey.

   Те саме можна зробити просто в застосунку:
   Налаштування → Хмара → «Підключити Firebase» — і вставити той
   самий JSON. Тоді цей файл можна не чіпати.

   Ці значення не є секретом: вони видні кожному, хто відкриє
   сторінку. Доступ до даних обмежують правила Firestore, а не
   ці ключі.
   ============================================================ */
window.HOMIN_FIREBASE = {
  apiKey: "AIzaSyCHio7foRRV2Tdery8W_ubU3x_r1B_c-MQ",
  authDomain: "homin-129d2.firebaseapp.com",
  projectId: "homin-129d2",
  storageBucket: "homin-129d2.firebasestorage.app",
  messagingSenderId: "1078702982938",
  appId: "1:1078702982938:web:c70a4d9fff027780fbcea3",

  /* Cloud Messaging → Web Push certificates.
     Заповнений — і пуш вмикається сам, без жодних дій людини. */
  vapidKey: "BL3ZatUQlIeXxHxNv44ZpD40j1gjiIlw3OnevpsSfBIffr3Tb5oFMaqJccUIbqfr7z3nI_uOti5VAyk3ys8Yw5s",

  /* Необовʼязково: адреса власного ретранслятора з теки
     push-relay. Якщо Cloud Functions не розгортали, вкажіть її
     тут — застосунок підпишеться на пуш автоматично, і
     користувачам теж не доведеться нічого вводити. */
  relay: ""
};

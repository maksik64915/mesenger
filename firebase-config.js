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

  /* Адреса того, хто надсилатиме пуш, коли Гомін закрито.
     Найпростіше — безкоштовна функція Supabase (тека supabase/,
     картка не потрібна):

       relay: "https://<ваш-ref>.supabase.co/functions/v1/push"

     Або власний сервер із теки push-relay. Якщо ви розгорнули
     Cloud Functions у Firebase, це поле можна лишити порожнім. */
  relay: "https://dgejptbuknxzqkrloqao.supabase.co/functions/v1/push",

  /* Сервери для встановлення прямого звʼязку.

     STUN лише підказує вашу зовнішню адресу — цього досить у
     межах однієї мережі. Крізь NAT мобільного оператора трафік
     проводить тільки TURN, тож без нього дзвінок між різними
     мережами не встановиться (повідомлення однаково доходять
     через хмару).

     Тут стоять дані з metered.ca — вони працюють, перевірено.
     Якщо колись зміните — візьміть новий набір у кабінеті:
     TURN Server → Credentials → «Show ICE Servers Array». */
  ice: [
    { urls: "stun:stun.relay.metered.ca:80" },
    { urls: "turn:global.relay.metered.ca:80",
      username: "430ab4afb6c65a841ccee3d2", credential: "7oGuTLrBk1EuhlW9" },
    { urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: "430ab4afb6c65a841ccee3d2", credential: "7oGuTLrBk1EuhlW9" },
    { urls: "turn:global.relay.metered.ca:443",
      username: "430ab4afb6c65a841ccee3d2", credential: "7oGuTLrBk1EuhlW9" },
    { urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "430ab4afb6c65a841ccee3d2", credential: "7oGuTLrBk1EuhlW9" }
  ],

  /* Ті самі дані можна брати посиланням — тоді логін і пароль
     будуть тимчасовими й не лежатимуть у цьому файлі. У кабінеті
     metered.ca: «Show API Key» біля вашої credential, посилання
     виду https://<ваш>.metered.live/api/v1/turn/credentials?apiKey=…
     Якщо заповнити, воно старше за ice вище. */
  iceUrl: ""
};

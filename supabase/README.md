# Пуш через Supabase

Найпростіший спосіб увімкнути сповіщення, коли Гомін закрито:
безкоштовно, без картки й без власного сервера.

```
functions/push/index.ts   функція, що надсилає пуш
```

## Чому не Firebase

Пуш із закритим застосунком може надіслати лише той, у кого є
приватний ключ VAPID, — тобто сервер. У Firebase це Cloud
Functions, а вони вимагають тарифу Blaze із привʼязаною карткою.
Supabase виконує ту саму функцію на безкоштовному плані.

Хмара (акаунти, листування) при цьому лишається у Firebase —
Supabase тут відповідає лише за сповіщення.

## Що ця функція знає

Кому надіслати сигнал і від кого він. Тексту листування тут
немає: воно йде або напряму між пристроями, або зашифрованим
через Firestore.

## Найпростіше: один скрипт

1. Створіть проєкт на [supabase.com](https://supabase.com) —
   картка не потрібна.
2. Запустіть:

```bash
cd supabase && bash setup.sh
```

Скрипт створить ключі VAPID, покладе їх у секрети проєкту,
опублікує функцію, перевірить її й надрукує рядок, який
лишиться вставити в `firebase-config.js`. Спитає він лише
пошту та ref проєкту (це те, що в адресі кабінету:
`supabase.com/dashboard/project/<ref>`).

## Або вручну

```bash
npx web-push generate-vapid-keys
npx supabase login
npx supabase link --project-ref <ваш-ref>
npx supabase secrets set VAPID_PUBLIC=<публічний> VAPID_PRIVATE=<приватний> VAPID_SUBJECT=mailto:you@example.com
npx supabase functions deploy push --no-verify-jwt
```

`--no-verify-jwt` потрібен, щоб застосунок міг покликати функцію
без ключа Supabase: вона й так нічого не читає з бази, а межа
частоти стоїть усередині.

4. У `firebase-config.js`:

```js
relay: "https://<ваш-ref>.supabase.co/functions/v1/push"
```

Усе. Далі нічого робити не треба: застосунок сам візьме публічний
ключ, підпишеться на push-службу браузера й передасть свою адресу
підписки друзям. Коли друг напише вам, а Гомін буде закритий, його
застосунок постукає у вашу функцію — і телефон задзвонить.

## Якщо CLI лається на «Entrypoint path does not exist»

Значить, його запустили не з кореня проєкту: Supabase CLI шукає
функції за шляхом `supabase/functions/<назва>` від поточної теки.
`setup.sh` це вже враховує. Вручну — з кореня `homin/`:

```bash
npx supabase functions deploy push --no-verify-jwt
```

Попередження «Docker is not running» можна ігнорувати: докер
потрібен лише для локального запуску функції, а не для публікації.

## Перевірка

```bash
curl https://<ваш-ref>.supabase.co/functions/v1/push/key
```

має повернути `{"key":"…"}`. У самому застосунку:
**Налаштування → Хмара → «Перевірити проєкт»**.

## Змінні

| Змінна | Значення |
|---|---|
| `VAPID_PUBLIC` | публічний ключ |
| `VAPID_PRIVATE` | приватний ключ |
| `VAPID_SUBJECT` | `mailto:` вашої пошти — цього вимагають push-служби |
| `ALLOW_ORIGIN` | звідки приймати запити, через кому; типово `*` |

## Ендпойнти

```
GET  /key      -> {"key":"<публічний ключ VAPID>"}
POST /push     <- {"subscription":{...},"payload":{"title","body","chatId","tag"}}
GET  /health   -> {"ok":true}
```

Ті самі, що й у [`push-relay`](../push-relay) — застосунок не
розрізняє, хто саме за цією адресою.

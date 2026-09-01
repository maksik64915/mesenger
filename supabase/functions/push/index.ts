/* ============================================================
   Гомін — пуш-сповіщення через Supabase Edge Function

   Те саме, що робить тека push-relay, тільки не треба тримати
   власний сервер: Supabase виконує цю функцію сам і безкоштовно
   (без картки, на відміну від Firebase Cloud Functions).

   Навіщо взагалі: коли Гомін закрито, прямого звʼязку немає, і
   розбудити пристрій може лише push-служба браузера. Звертатися
   до неї дозволено тільки з підписом ключем VAPID, а тримати
   приватний ключ у браузері не можна.

   Що ця функція знає: кому надіслати сигнал і від кого він.
   Текст листування сюди не потрапляє — воно йде напряму або
   зашифрованим через Firestore.

   Розгортання:
     npx supabase login
     npx supabase link --project-ref <ваш-ref>
     npx supabase secrets set VAPID_PUBLIC=... VAPID_PRIVATE=... VAPID_SUBJECT=mailto:you@example.com
     npx supabase functions deploy push --no-verify-jwt

   Ключі VAPID створює npx web-push generate-vapid-keys
   (або node push-relay/server.js keys).

   Далі в firebase-config.js:
     relay: "https://<ваш-ref>.supabase.co/functions/v1/push"

   Ендпойнти ті самі, що й у push-relay:
     GET  /key    -> {"key":"<публічний ключ VAPID>"}
     POST /push   <- {"subscription":{...},"payload":{...}}
   ============================================================ */
import webpush from 'npm:web-push@3.6.7';

const PUBLIC = Deno.env.get('VAPID_PUBLIC') ?? '';
const PRIVATE = Deno.env.get('VAPID_PRIVATE') ?? '';
const SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
/* Через кому: https://you.github.io — або * , якщо байдуже, звідки стукають. */
const ORIGINS = (Deno.env.get('ALLOW_ORIGIN') ?? '*').split(',').map(s => s.trim());

if (PUBLIC && PRIVATE) webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);

/* Проста межа частоти: 60 сигналів за хвилину з адреси.
   Памʼять функції живе недовго, тож це радше запобіжник від
   випадкового циклу, ніж захист від зловмисника. */
const hits = new Map<string, { n: number; t: number }>();
function tooFast(ip: string) {
  const now = Date.now();
  const box = hits.get(ip) ?? { n: 0, t: now };
  if (now - box.t > 60_000) { box.n = 0; box.t = now; }
  box.n++;
  hits.set(ip, box);
  if (hits.size > 2000) hits.clear();
  return box.n > 60;
}

function cors(origin: string | null) {
  const allow = ORIGINS.includes('*') ? '*' : (origin && ORIGINS.includes(origin) ? origin : '');
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (allow) h['Access-Control-Allow-Origin'] = allow;
  return h;
}
function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origin) }
  });
}
function valid(sub: any) {
  return sub && typeof sub.endpoint === 'string' && sub.endpoint.startsWith('https://')
    && sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string';
}
const trim = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

  const path = new URL(req.url).pathname.replace(/\/+$/, '');

  if (req.method === 'GET' && path.endsWith('/key')) {
    if (!PUBLIC) return json({ error: 'no-keys' }, 500, origin);
    return json({ key: PUBLIC }, 200, origin);
  }
  if (req.method === 'GET' && path.endsWith('/health')) return json({ ok: true }, 200, origin);

  if (req.method !== 'POST') return json({ error: 'not-found' }, 404, origin);
  if (!PUBLIC || !PRIVATE) return json({ error: 'no-keys' }, 500, origin);

  const ip = (req.headers.get('x-forwarded-for') ?? '?').split(',')[0].trim();
  if (tooFast(ip)) return json({ error: 'slow-down' }, 429, origin);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad-json' }, 400, origin); }
  if (!valid(body?.subscription)) return json({ error: 'bad-subscription' }, 400, origin);

  const p = body.payload ?? {};
  /* назовні віддаємо тільки те, що показує сповіщення */
  const payload = JSON.stringify({
    title: trim(p.title, 60) || 'Гомін',
    body: trim(p.body, 160) || 'Нове повідомлення',
    chatId: trim(p.chatId, 120),
    tag: trim(p.tag, 120) || 'homin'
  });

  try {
    await webpush.sendNotification(body.subscription, payload, { TTL: 3600, urgency: 'high' });
    return json({ ok: true }, 200, origin);
  } catch (err: any) {
    const code = err?.statusCode;
    /* 404/410 — підписка вже мертва: хай відправник знає */
    if (code === 404 || code === 410) return json({ error: 'gone' }, 410, origin);
    console.error('push failed:', code ?? err?.message);
    return json({ error: 'push-failed', code: code ?? 0 }, 502, origin);
  }
});

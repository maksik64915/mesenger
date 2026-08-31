#!/usr/bin/env node
/* ============================================================
   Гомін — ретранслятор пуш-сповіщень

   Навіщо. Поки Гомін відкритий, він отримує повідомлення напряму
   від співрозмовника і показує сповіщення сам. Коли застосунок
   закрито, зʼєднання немає — розбудити пристрій може лише
   push-служба браузера (FCM, Mozilla, Apple). Звертатися до неї
   можна тільки з підписом ключем VAPID, а тримати приватний ключ
   у браузері не можна. Оцей сервер — усе, що для цього потрібно.

   Що він знає. Кому надіслати сигнал і від кого він. Тексту
   листування, фото, голосових і дзвінків тут немає: вони йдуть
   напряму між пристроями.

   Запуск:
     npm install
     npm run keys        # один раз: створити ключі VAPID
     npm start           # PORT=8787 за замовчуванням

   Далі в застосунку: Налаштування → Сповіщення →
   «Пуш коли застосунок закритий» → адреса цього сервера.

   Ендпойнти:
     GET  /key     -> {"key":"<публічний ключ VAPID>"}
     POST /push    <- {"subscription":{...}, "payload":{...}}
     GET  /health  -> {"ok":true}
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const PORT = Number(process.env.PORT || 8787);
const KEYS_FILE = process.env.VAPID_FILE || path.join(__dirname, 'vapid.json');
const CONTACT = process.env.VAPID_CONTACT || 'mailto:admin@example.com';
/* Через кому: https://you.github.io  — або * , якщо байдуже, звідки стукають. */
const ORIGINS = (process.env.ALLOW_ORIGIN || '*').split(',').map(s => s.trim());

/* ---------- ключі ---------- */
function loadKeys() {
  if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE) {
    return { publicKey: process.env.VAPID_PUBLIC, privateKey: process.env.VAPID_PRIVATE };
  }
  if (fs.existsSync(KEYS_FILE)) return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  return null;
}
if (process.argv[2] === 'keys') {
  const k = webpush.generateVAPIDKeys();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(k, null, 2) + '\n', { mode: 0o600 });
  console.log('Ключі записано у ' + KEYS_FILE);
  console.log('Публічний: ' + k.publicKey);
  process.exit(0);
}
const keys = loadKeys();
if (!keys) {
  console.error('Немає ключів VAPID. Спершу виконайте:  npm run keys');
  process.exit(1);
}
webpush.setVapidDetails(CONTACT, keys.publicKey, keys.privateKey);

/* ---------- проста межа частоти: 60 сигналів за хвилину з адреси ---------- */
const hits = new Map();
function tooFast(ip) {
  const now = Date.now();
  const box = hits.get(ip) || { n: 0, t: now };
  if (now - box.t > 60000) { box.n = 0; box.t = now; }
  box.n++;
  hits.set(ip, box);
  if (hits.size > 5000) hits.clear();
  return box.n > 60;
}

/* ---------- дрібниці ---------- */
function cors(req, res) {
  const origin = req.headers.origin || '';
  const allow = ORIGINS.includes('*') ? '*' : (ORIGINS.includes(origin) ? origin : '');
  if (allow) res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('too-big')); req.destroy(); return; }
      parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}
function valid(sub) {
  return sub && typeof sub.endpoint === 'string' &&
         /^https:\/\//.test(sub.endpoint) &&
         sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string';
}
function trim(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }

/* ---------- сервер ---------- */
const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/key') return json(res, 200, { key: keys.publicKey });
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true });

  if (req.method === 'POST' && url.pathname === '/push') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
    if (tooFast(String(ip).split(',')[0].trim())) return json(res, 429, { error: 'slow-down' });

    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch (e) { return json(res, 400, { error: 'bad-json' }); }

    if (!valid(body.subscription)) return json(res, 400, { error: 'bad-subscription' });

    const p = body.payload || {};
    /* назовні віддаємо тільки те, що показує сповіщення */
    const payload = JSON.stringify({
      title: trim(p.title, 60) || 'Гомін',
      body: trim(p.body, 160) || 'Нове повідомлення',
      chatId: trim(p.chatId, 120),
      tag: trim(p.tag, 120) || 'homin'
    });

    try {
      await webpush.sendNotification(body.subscription, payload, { TTL: 3600, urgency: 'high' });
      return json(res, 200, { ok: true });
    } catch (err) {
      const code = err && err.statusCode;
      /* 404/410 — підписка вже мертва: хай відправник знає */
      if (code === 404 || code === 410) return json(res, 410, { error: 'gone' });
      console.error('push failed:', code || (err && err.message));
      return json(res, 502, { error: 'push-failed', code: code || 0 });
    }
  }

  json(res, 404, { error: 'not-found' });
});

server.listen(PORT, () => {
  console.log('Ретранслятор Гомона слухає порт ' + PORT);
  console.log('Публічний ключ VAPID: ' + keys.publicKey);
  console.log('Дозволені джерела: ' + ORIGINS.join(', '));
});

#!/usr/bin/env bash
# ============================================================
#   Гомін — розгортання пуш-сповіщень на Supabase
#
#   Робить усе за один раз: створює ключі VAPID, кладе їх у
#   секрети проєкту, публікує функцію й друкує рядок, який
#   лишається вставити у firebase-config.js.
#
#   Потрібні лише node (він у вас є, якщо працює npx) і
#   безкоштовний акаунт на supabase.com — картка не потрібна.
#
#   Запуск:
#       cd supabase && bash setup.sh
# ============================================================
set -e

# Supabase CLI шукає функції за шляхом supabase/functions/<назва>,
# рахуючи від теки, з якої його запустили. Тому працюємо з кореня
# проєкту, а не зсередини supabase/.
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
cd "$ROOT"

echo
echo "=== Гомін · пуш через Supabase ==="
echo

if ! command -v npx >/dev/null 2>&1; then
  echo "Потрібен Node.js — встановіть його з nodejs.org і запустіть знову."
  exit 1
fi

# --- 1. ключі VAPID -----------------------------------------
if [ -f "$HERE/vapid.json" ]; then
  echo "· Ключі VAPID уже є (supabase/vapid.json), беремо їх."
else
  echo "· Створюємо ключі VAPID…"
  npx --yes web-push generate-vapid-keys --json > "$HERE/vapid.json"
fi
PUB=$(node -p "require('$HERE/vapid.json').publicKey")
PRIV=$(node -p "require('$HERE/vapid.json').privateKey")
echo "  публічний ключ: ${PUB:0:24}…"

# --- 2. пошта для VAPID -------------------------------------
if [ -z "$VAPID_SUBJECT" ]; then
  read -r -p "· Ваша пошта (її вимагають push-служби): " MAIL
  VAPID_SUBJECT="mailto:${MAIL}"
fi

# --- 3. проєкт Supabase -------------------------------------
# Якщо вхід і привʼязка вже були — не повторюємо їх.
if [ -f supabase/.temp/project-ref ]; then
  PROJECT_REF="$(cat supabase/.temp/project-ref)"
  echo "· Проєкт уже привʼязано: $PROJECT_REF"
else
  echo
  echo "· Зараз відкриється браузер для входу в Supabase."
  npx --yes supabase login
fi

if [ -z "$PROJECT_REF" ]; then
  echo
  echo "  Ref проєкту — це те, що в адресі кабінету:"
  echo "  https://supabase.com/dashboard/project/<ЦЕ_І_Є_REF>"
  read -r -p "· Ref проєкту: " PROJECT_REF
fi

if [ ! -f supabase/.temp/project-ref ]; then
  npx --yes supabase link --project-ref "$PROJECT_REF"
fi

# --- 4. секрети й публікація --------------------------------
echo
echo "· Кладемо ключі в секрети проєкту…"
npx --yes supabase secrets set \
  VAPID_PUBLIC="$PUB" \
  VAPID_PRIVATE="$PRIV" \
  VAPID_SUBJECT="$VAPID_SUBJECT"

echo
echo "· Публікуємо функцію…"
npx --yes supabase functions deploy push --no-verify-jwt

URL="https://${PROJECT_REF}.supabase.co/functions/v1/push"

# --- 5. перевірка -------------------------------------------
echo
echo "· Перевіряємо…"
if curl -fsS "${URL}/key" >/dev/null 2>&1; then
  echo "  функція відповідає ✓"
else
  echo "  функція поки не відповідає — спробуйте за хвилину:"
  echo "  curl ${URL}/key"
fi

echo
echo "============================================================"
echo " Готово. Лишився один рядок у firebase-config.js:"
echo
echo "   relay: \"${URL}\","
echo
echo " І підніміть номер у index.html:"
echo "   <script src=\"firebase-config.js?v=20\"></script>"
echo "============================================================"
echo
echo " supabase/vapid.json бережіть: у ньому приватний ключ. У git він не"
echo " потрапить — його вже вписано в .gitignore."

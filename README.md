# Конторское ДЗ

Закрытое веб-приложение (PWA) с домашкой группы ИМОЗ-24-2.

Здесь только код сайта. Задания и сканы хранятся в Supabase и видны лишь после входа
по коду на почту из списка группы.

- `index.html`, `app.js`, `styles.css` — приложение; `config.js` — публичные параметры Supabase.
- `sw.js`, `manifest.webmanifest`, `icons/` — установка на телефон и офлайн-режим.
- `install.html` — инструкция по установке для группы.
- `vendor/supabase.js` — @supabase/supabase-js (UMD), лежит локально, без CDN.

Публикация: push в `claude/**` → Action переносит коммиты в `main` → GitHub Pages.

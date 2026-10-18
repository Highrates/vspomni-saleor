-- Оптовый FAQ: кликабельная ссылка на корп. Telegram.
-- Запуск на Nest Postgres (prod / local):
--   psql "$DATABASE_URL" -f deploy/sql/fix-faq-wholesale-telegram.sql

UPDATE "FaqItem"
SET
  answer = 'Мы предоставляем специальные условия для оптовых заказов. Свяжитесь, пожалуйста, с менеджером для получения информации по ценам и условиям в <a href="https://t.me/vspomni_corp" target="_blank" rel="noopener noreferrer">онлайн-чате Telegram</a>.',
  "updatedAt" = NOW()
WHERE active = true
  AND (
    question ILIKE '%оптов%'
    OR answer ILIKE '%оптов%заказ%'
  );

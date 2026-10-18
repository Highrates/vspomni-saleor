-- FAQ: подарочные сертификаты (идемпотентно по тексту вопроса)
INSERT INTO "FaqItem" (id, question, answer, "sortOrder", active, "createdAt", "updatedAt")
SELECT 'faq_gift_what',
  'Что такое подарочный сертификат Jcos?',
  'Это предоплата на баланс: код на фиксированную сумму. При оформлении заказа введите код в поле «Промокод или сертификат» — сумма спишется с баланса, остаток можно доплатить картой. Сертификат — не скидка и не промокод.',
  100,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "FaqItem" WHERE question = 'Что такое подарочный сертификат Jcos?'
);

INSERT INTO "FaqItem" (id, question, answer, "sortOrder", active, "createdAt", "updatedAt")
SELECT 'faq_gift_buy',
  'Как купить подарочный сертификат?',
  'На странице «Подарочные сертификаты» выберите номинал, укажите контакты и оплатите через ЮKassa. Код придёт на email сразу после оплаты. Можно указать email получателя — тогда код уйдёт ему, а вам — подтверждение оплаты.',
  101,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "FaqItem" WHERE question = 'Как купить подарочный сертификат?'
);

INSERT INTO "FaqItem" (id, question, answer, "sortOrder", active, "createdAt", "updatedAt")
SELECT 'faq_gift_use',
  'Как использовать сертификат и можно ли совместить с промокодом?',
  'В корзине или на оформлении заказа введите код. За один заказ — один сертификат. Одновременно с промокодом применить нельзя. Если сертификат покрывает всю сумму, картой платить не нужно.',
  102,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "FaqItem" WHERE question = 'Как использовать сертификат и можно ли совместить с промокодом?'
);

INSERT INTO "FaqItem" (id, question, answer, "sortOrder", active, "createdAt", "updatedAt")
SELECT 'faq_gift_balance',
  'Что если сумма заказа меньше номинала сертификата?',
  'С баланса спишется только сумма заказа (или доступный остаток). Неиспользованный остаток сохранится на том же коде, пока сертификат действителен.',
  103,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "FaqItem" WHERE question = 'Что если сумма заказа меньше номинала сертификата?'
);

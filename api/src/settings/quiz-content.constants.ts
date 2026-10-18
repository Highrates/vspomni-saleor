/** Known quiz content keys + text fallbacks (Vspomni parity). */

export const QUIZ_TEXT_FALLBACKS: Record<string, string> = {
  greeting:
    'Пройдите квиз и получите персональный подбор косметики по задачам вашей кожи и промокод для покупок!',
  choose_care: 'Что вас интересует?',
  menu_face_hello:
    'Отлично! Сейчас мы зададим несколько вопросов о вашей коже, чтобы подобрать идеальный уход.',
  face_q_age: 'Сколько вам лет?',
  face_q_spf: 'Используете ли вы SPF-крем ежедневно?',
  face_q_skin: 'Какие проблемы с кожей вас беспокоят?',
  face_q_skin2: 'Какие задачи ухода для вас актуальны?',
  face_q_edema: 'Беспокоит ли вас отёчность лица по утрам?',
  face_selfi:
    'При желании загрузите фото кожи (до 3 штук). Это поможет нам лучше понять ваши потребности. Фото не влияет на алгоритм подбора.',
  hair_cleansing:
    'Правильное очищение — основа здоровых волос. Начните с мягкого шампуня без агрессивных ПАВ, подходящего вашему типу волос.',
  hair_care:
    'После очищения важно питание и увлажнение. Маски и кондиционеры с натуральными маслами восстанавливают структуру волос.',
  face_steps: 'Подбираем ваш персональный уход…',
  face_study: 'Изучаем ваши ответы',
  end_face_care: 'Ваш персональный уход готов!',
};

export const QUIZ_RESULT_TEXT_FALLBACKS: Record<string, string> = {
  step_1_spf: '',
  step_1_nospf: '',
  no_answers: '',
  other_steps_1: '',
  other_steps_2: '',
  other_steps_3: '',
  other_steps_4: '',
  other_steps_5: '',
  other_steps_6: '',
  other_steps_7: '',
  other_steps_8_1: '',
  other_steps_8_2: '',
  face_edema: '',
  face_edema2: '',
};

export const QUIZ_ALL_TEXT_FALLBACKS: Record<string, string> = {
  ...QUIZ_TEXT_FALLBACKS,
  ...QUIZ_RESULT_TEXT_FALLBACKS,
};

export const QUIZ_MEDIA_KEYS = [
  'file_1',
  'file_1.1',
  'file_2',
  'file_3',
  'file_4',
  'file_4.1',
  'file_5',
  'file_5.1',
  'file_6',
  'file_6.1',
  'file_7',
  'file_7.1',
  'file_8',
  'file_9',
  'file_9.1',
  'file_10',
  'file_10.1',
  'file_11',
  'file_12',
] as const;

export const QUIZ_UI_TEXT_KEYS = Object.keys(QUIZ_TEXT_FALLBACKS);

export const QUIZ_RESULT_TEXT_KEYS = Object.keys(QUIZ_RESULT_TEXT_FALLBACKS);

const PRODUCT_LINK_HINT =
  ' Добавьте ссылку /product/{slug} в HTML/plain — на витрине появятся карточки товара.';

export const QUIZ_ALL_CONTENT_KEYS = [
  ...QUIZ_UI_TEXT_KEYS,
  ...QUIZ_RESULT_TEXT_KEYS,
  ...QUIZ_MEDIA_KEYS,
];

export const QUIZ_KEY_HINTS_RU: Record<string, string> = {
  greeting: 'Приветствие на старте квиза',
  choose_care: 'Выбор направления (лицо / волосы)',
  menu_face_hello: 'Переход к блоку лица',
  face_q_age: 'Вопрос о возрасте',
  face_q_spf: 'Вопрос об SPF',
  face_q_skin: 'Проблемы кожи',
  face_q_skin2: 'Задачи ухода',
  face_q_edema: 'Отёчность',
  face_selfi: 'Загрузка фото',
  hair_cleansing: 'Рекомендация: очищение волос',
  hair_care: 'Рекомендация: уход за волосами',
  face_steps: 'Экран ожидания подбора',
  face_study: 'Подпись «изучаем ответы»',
  end_face_care: 'Финальный экран результата',

  step_1_spf: `Первый блок: пользователь использует SPF (+ медиа file_2).${PRODUCT_LINK_HINT}`,
  step_1_nospf: `Первый блок: без SPF (+ медиа file_3).${PRODUCT_LINK_HINT}`,
  no_answers: 'Нет выбранных задач ухода — запасной текст вместо матрицы',

  other_steps_1: `Young · P1 — чувствительность / сухость (+ file_4, file_4.1).${PRODUCT_LINK_HINT}`,
  other_steps_2: `Young · P2 — постакне (+ file_5, file_5.1).${PRODUCT_LINK_HINT}`,
  other_steps_3: `Young · P3 — тёмные круги (+ file_6, file_6.1).${PRODUCT_LINK_HINT}`,
  other_steps_4: `Young · P4 — морщины / «кожа в порядке» (+ file_7, file_7.1).${PRODUCT_LINK_HINT}`,

  other_steps_5: `Mature · P1 — сухость / чувствительность (+ file_8).${PRODUCT_LINK_HINT}`,
  other_steps_6: `Mature · P2 — постакне (+ file_9, file_9.1).${PRODUCT_LINK_HINT}`,
  other_steps_7: `Mature · P3 — тёмные круги (+ file_10, file_10.1).${PRODUCT_LINK_HINT}`,
  other_steps_8_1: `Mature · P4 — морщины, текст 1 из 2 (+ file_11).${PRODUCT_LINK_HINT}`,
  other_steps_8_2: `Mature · P4 — морщины, текст 2 из 2 (+ file_12).${PRODUCT_LINK_HINT}`,

  face_edema: `Отёчность, приоритет 1 (основная рекомендация).${PRODUCT_LINK_HINT}`,
  face_edema2: `Отёчность, приоритет 2+ (альтернативная рекомендация).${PRODUCT_LINK_HINT}`,
};

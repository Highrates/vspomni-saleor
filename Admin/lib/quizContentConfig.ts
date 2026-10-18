/** Quiz content keys (parity with backend quiz-content.constants). */

export const QUIZ_UI_TEXT_KEYS = [
  'greeting',
  'choose_care',
  'menu_face_hello',
  'face_q_age',
  'face_q_spf',
  'face_q_skin',
  'face_q_skin2',
  'face_q_edema',
  'face_selfi',
  'hair_cleansing',
  'hair_care',
  'face_steps',
  'face_study',
  'end_face_care',
] as const;

export const QUIZ_RESULT_TEXT_KEYS = [
  'step_1_spf',
  'step_1_nospf',
  'no_answers',
  'other_steps_1',
  'other_steps_2',
  'other_steps_3',
  'other_steps_4',
  'other_steps_5',
  'other_steps_6',
  'other_steps_7',
  'other_steps_8_1',
  'other_steps_8_2',
  'face_edema',
  'face_edema2',
] as const;

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

export const QUIZ_RESULT_TEXT_KEY_SET = new Set<string>(QUIZ_RESULT_TEXT_KEYS);

const PRODUCT_LINK_HINT =
  ' Добавьте товары кнопкой «Добавить товар» или ссылку /product/{slug} в HTML/plain — на витрине появятся карточки.';

/** Группы экрана результата — порядок как в алгоритме подбора. */
export const QUIZ_RESULT_GROUPS: {
  title: string;
  description: string;
  keys: readonly (typeof QUIZ_RESULT_TEXT_KEYS)[number][];
}[] = [
  {
    title: 'Старт результата',
    description: 'Первый блок после подбора: SPF и запасной текст, если задач не выбрано.',
    keys: ['step_1_spf', 'step_1_nospf', 'no_answers'],
  },
  {
    title: 'Молодая кожа — приоритеты 1–4',
    description:
      'Матрица young × priority. Медиа рядом: file_4/_4.1 … file_7/_7.1 (вкладка «Медиа»).',
    keys: ['other_steps_1', 'other_steps_2', 'other_steps_3', 'other_steps_4'],
  },
  {
    title: 'Зрелая кожа — приоритеты 1–4',
    description:
      'Матрица mature × priority. У P4 два текста подряд (8_1 и 8_2) + file_11 / file_12.',
    keys: ['other_steps_5', 'other_steps_6', 'other_steps_7', 'other_steps_8_1', 'other_steps_8_2'],
  },
  {
    title: 'Отёчность',
    description: 'Доп. блок при ответе про утреннюю отёчность: приоритет 1 → face_edema, иначе face_edema2.',
    keys: ['face_edema', 'face_edema2'],
  },
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

  file_1: 'Медиа: общий / старт',
  'file_1.1': 'Медиа: общий / старт (вариант)',
  file_2: 'Медиа к step_1_spf',
  file_3: 'Медиа к step_1_nospf',
  file_4: 'Young P1 — основное',
  'file_4.1': 'Young P1 — доп.',
  file_5: 'Young P2 — основное',
  'file_5.1': 'Young P2 — доп.',
  file_6: 'Young P3 — основное',
  'file_6.1': 'Young P3 — доп.',
  file_7: 'Young P4 — основное',
  'file_7.1': 'Young P4 — доп.',
  file_8: 'Mature P1',
  file_9: 'Mature P2 — основное',
  'file_9.1': 'Mature P2 — доп.',
  file_10: 'Mature P3 — основное',
  'file_10.1': 'Mature P3 — доп.',
  file_11: 'Mature P4 — к other_steps_8_1',
  file_12: 'Mature P4 — к other_steps_8_2',
};

'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminCheckbox } from '@/components/admin/AdminCheckbox/AdminCheckbox';
import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminModal, AdminModalActions } from '@/components/admin/AdminModal/AdminModal';
import { AdminSelect, AdminTextArea, AdminTextField } from '@/components/AdminTextField/AdminTextField';
import type {
  DiscountConditionItem,
  DiscountConditionKind,
  DiscountConditions,
  DiscountRewardType,
} from '@/lib/adminDiscountTypes';
import { DISCOUNT_CONDITION_KIND_LABELS } from '@/lib/adminDiscountTypes';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import {
  DISCOUNT_CONDITIONS_SCOPE_HINT,
  DISCOUNT_REWARD_BASE_HINT,
} from './discountHints';

const ALL_KINDS = Object.keys(DISCOUNT_CONDITION_KIND_LABELS) as DiscountConditionKind[];

export type ConditionDraft = {
  key: string;
  kind: DiscountConditionKind;
  value: string;
};

export type RuleDraft = {
  key: string;
  /** Стабильный id с бэка; у новых правил отсутствует. */
  id?: string;
  name: string;
  logic: 'AND' | 'OR';
  /** Пустой массив = без условий (conditions: null), если useConditions=false. */
  conditionItems: ConditionDraft[];
  /** false → сохраняем conditions: null; true → нужен ≥1 item. */
  useConditions: boolean;
  description: string;
  rewardType: DiscountRewardType;
  rewardValue: string;
};

export function emptyCondition(usedKinds: DiscountConditionKind[] = []): ConditionDraft {
  const kind = ALL_KINDS.find((k) => !usedKinds.includes(k)) ?? 'MIN_QTY';
  return {
    key: `c-${Math.random().toString(36).slice(2, 9)}`,
    kind,
    value: '',
  };
}

export function emptyRule(): RuleDraft {
  return {
    key: `r-${Math.random().toString(36).slice(2, 9)}`,
    name: '',
    logic: 'AND',
    conditionItems: [],
    useConditions: false,
    description: '',
    rewardType: 'PERCENT',
    rewardValue: '10',
  };
}

export function cloneRule(rule: RuleDraft): RuleDraft {
  return {
    ...rule,
    conditionItems: rule.conditionItems.map((c) => ({ ...c })),
  };
}

export function conditionsFromApi(raw: DiscountConditions | null | undefined): {
  logic: 'AND' | 'OR';
  conditionItems: ConditionDraft[];
  useConditions: boolean;
} {
  if (!raw?.items?.length) {
    return { logic: 'AND', conditionItems: [], useConditions: false };
  }
  return {
    logic: raw.logic === 'OR' ? 'OR' : 'AND',
    useConditions: true,
    conditionItems: raw.items.map((it) => ({
      key: `c-${Math.random().toString(36).slice(2, 9)}`,
      kind: it.kind,
      value: String(it.value),
    })),
  };
}

export function normalizeConditionsDraft(
  logic: 'AND' | 'OR',
  items: ConditionDraft[],
  ruleName: string,
  useConditions: boolean,
): DiscountConditions | null {
  if (!useConditions || !items.length) return null;
  const seen = new Set<DiscountConditionKind>();
  const parsed: DiscountConditionItem[] = [];
  for (const it of items) {
    if (seen.has(it.kind)) {
      throw new Error(`Правило «${ruleName}»: дубликат типа условия`);
    }
    seen.add(it.kind);
    const value = Number(it.value);
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`Правило «${ruleName}»: некорректное значение условия`);
    }
    parsed.push({ kind: it.kind, value });
  }
  return { logic: items.length >= 2 ? logic : 'AND', items: parsed };
}

function shortConditionPart(kind: DiscountConditionKind, value: string): string {
  const v = value.trim() || '—';
  switch (kind) {
    case 'MIN_QTY':
      return `≥${v} шт`;
    case 'MIN_AMOUNT':
      return `≥${v} ₽`;
    case 'MIN_LINES':
      return `≥${v} поз.`;
    default:
      return v;
  }
}

export function formatRuleConditions(rule: RuleDraft): string {
  if (!rule.useConditions || !rule.conditionItems.length) return 'Без условий';
  const parts = rule.conditionItems.map((c) => shortConditionPart(c.kind, c.value));
  if (parts.length === 1) return parts[0]!;
  const joiner = ' · ';
  const logicLabel = rule.logic === 'OR' ? 'или' : 'и';
  return `${parts.join(joiner)} (${logicLabel})`;
}

export function formatRuleReward(rule: RuleDraft): string {
  const n = rule.rewardValue.trim() || '—';
  return rule.rewardType === 'PERCENT' ? `${n}%` : `${n} ₽`;
}

function validateRuleDraft(rule: RuleDraft): string | null {
  if (!rule.name.trim()) return 'Укажите название правила';
  const rewardValue = Number(rule.rewardValue);
  if (!Number.isInteger(rewardValue) || rewardValue < 1) {
    return 'Значение вознаграждения: целое число ≥ 1';
  }
  if (rule.rewardType === 'PERCENT' && rewardValue > 100) {
    return 'Процент скидки: от 1 до 100';
  }
  if (rule.useConditions) {
    if (!rule.conditionItems.length) return 'Добавьте хотя бы одно условие';
    const seen = new Set<DiscountConditionKind>();
    for (const it of rule.conditionItems) {
      if (seen.has(it.kind)) return 'Каждый тип условия можно указать только один раз';
      seen.add(it.kind);
      const value = Number(it.value);
      if (!Number.isInteger(value) || value < 1) {
        return 'Некорректное значение условия';
      }
    }
  }
  return null;
}

export function DiscountRuleModal({
  open,
  mode,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  initial: RuleDraft | null;
  onClose: () => void;
  onSave: (rule: RuleDraft) => void;
}) {
  const [draft, setDraft] = useState<RuleDraft>(emptyRule());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !initial) return;
    setDraft(cloneRule(initial));
    setError(null);
  }, [open, initial]);

  const usedKinds = useMemo(
    () => draft.conditionItems.map((c) => c.kind),
    [draft.conditionItems],
  );
  const canAddCondition = draft.conditionItems.length < ALL_KINDS.length;

  function patch(p: Partial<RuleDraft>) {
    setDraft((prev) => ({ ...prev, ...p }));
  }

  function updateCondition(condKey: string, p: Partial<ConditionDraft>) {
    setDraft((prev) => ({
      ...prev,
      conditionItems: prev.conditionItems.map((c) =>
        c.key === condKey ? { ...c, ...p } : c,
      ),
    }));
  }

  function setUseConditions(on: boolean) {
    if (on) {
      patch({
        useConditions: true,
        conditionItems: draft.conditionItems.length
          ? draft.conditionItems
          : [emptyCondition()],
      });
    } else {
      patch({ useConditions: false, conditionItems: [] });
    }
  }

  function confirm() {
    const err = validateRuleDraft(draft);
    if (err) {
      setError(err);
      return;
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      logic: draft.conditionItems.length >= 2 ? draft.logic : 'AND',
    });
  }

  return (
    <AdminModal
      open={open}
      title={mode === 'create' ? 'Новое правило' : 'Редактировать правило'}
      onClose={onClose}
      wide
      footer={
        <AdminModalActions
          onCancel={onClose}
          onConfirm={confirm}
          confirmLabel={mode === 'create' ? 'Добавить' : 'Сохранить'}
        />
      }
    >
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <AdminTextField
        label="Название"
        value={draft.name}
        onChange={(e) => patch({ name: e.target.value })}
        required
      />

      <div className={styles.coverBlock}>
        <p className={styles.coverLabel}>Условия</p>
        <p className={styles.muted}>{DISCOUNT_CONDITIONS_SCOPE_HINT}</p>

        <div className={styles.labelCheckboxRow}>
          <AdminCheckbox
            id="rule-use-conditions"
            className={styles.adminCheckboxForm}
            checked={draft.useConditions}
            onChange={(e) => setUseConditions(e.target.checked)}
          />
          <label htmlFor="rule-use-conditions">Включить пороги</label>
        </div>

        {draft.useConditions ? (
          <>
            {draft.conditionItems.length >= 2 ? (
              <AdminSelect
                label="Связка"
                value={draft.logic}
                onChange={(e) => patch({ logic: e.target.value as 'AND' | 'OR' })}
              >
                <option value="AND">Все условия (И)</option>
                <option value="OR">Любое условие (ИЛИ)</option>
              </AdminSelect>
            ) : null}

            {draft.conditionItems.map((cond) => {
              const kindsUsedByOthers = usedKinds.filter((k) => k !== cond.kind);
              return (
                <div key={cond.key} className={styles.conditionRow}>
                  <AdminSelect
                    label="Тип"
                    value={cond.kind}
                    onChange={(e) =>
                      updateCondition(cond.key, {
                        kind: e.target.value as DiscountConditionKind,
                      })
                    }
                  >
                    {ALL_KINDS.map((k) => (
                      <option key={k} value={k} disabled={kindsUsedByOthers.includes(k)}>
                        {DISCOUNT_CONDITION_KIND_LABELS[k]}
                      </option>
                    ))}
                  </AdminSelect>
                  <AdminTextField
                    label="Значение"
                    type="number"
                    min={1}
                    value={cond.value}
                    onChange={(e) => updateCondition(cond.key, { value: e.target.value })}
                    required
                  />
                  <AdminCompactBtn
                    type="button"
                    variant="outline"
                    onClick={() =>
                      patch({
                        conditionItems: draft.conditionItems.filter((c) => c.key !== cond.key),
                      })
                    }
                  >
                    Убрать
                  </AdminCompactBtn>
                </div>
              );
            })}

            {canAddCondition ? (
              <div className={styles.conditionAddRow}>
                <AdminCompactBtn
                  type="button"
                  variant="outline"
                  onClick={() =>
                    patch({
                      conditionItems: [...draft.conditionItems, emptyCondition(usedKinds)],
                    })
                  }
                >
                  + Условие
                </AdminCompactBtn>
              </div>
            ) : null}
          </>
        ) : (
          <p className={styles.muted}>Без порогов — правило срабатывает всегда в области скидки.</p>
        )}
      </div>

      <div className={styles.fieldsRow2}>
        <AdminSelect
          label="Вознаграждение"
          value={draft.rewardType}
          onChange={(e) =>
            patch({ rewardType: e.target.value as DiscountRewardType })
          }
        >
          <option value="PERCENT">Процент (%)</option>
          <option value="FIXED">Фиксировано (₽)</option>
        </AdminSelect>
        <AdminTextField
          label={draft.rewardType === 'PERCENT' ? 'Значение, %' : 'Значение, ₽'}
          type="number"
          min={1}
          max={draft.rewardType === 'PERCENT' ? 100 : undefined}
          value={draft.rewardValue}
          onChange={(e) => patch({ rewardValue: e.target.value })}
          required
        />
      </div>
      <p className={styles.muted}>{DISCOUNT_REWARD_BASE_HINT}</p>

      <AdminTextArea
        label="Описание правила"
        value={draft.description}
        onChange={(e) => patch({ description: e.target.value })}
        rows={2}
      />
    </AdminModal>
  );
}

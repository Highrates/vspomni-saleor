export type QuizReportPeriodKind = '7d' | '30d' | '90d' | 'custom';

export type QuizReportOverview = {
  period: {
    kind: QuizReportPeriodKind;
    from: string;
    to: string;
  };
  starts: number;
  completions: number;
  conversionRate: number;
  avgDurationSec: number;
  zones: { face: number; hair: number };
  funnel: {
    key: string;
    label: string;
    zone: 'face' | 'hair' | null;
    views: number;
    completes: number;
  }[];
  topResultBlocks: { key: string; count: number }[];
};

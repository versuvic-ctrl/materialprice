export type Period = 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface PeriodOption {
  value: Period;
  label: string;
  days?: number;
  intervalType: 'week' | 'month' | 'year' | 'custom';
}

export const PERIOD_OPTIONS: PeriodOption[] = [
  { value: 'weekly', label: '주간', days: 7, intervalType: 'week' },
  { value: 'monthly', label: '월간', days: 30, intervalType: 'month' },
  { value: 'yearly', label: '연간', days: 365, intervalType: 'year' },
];
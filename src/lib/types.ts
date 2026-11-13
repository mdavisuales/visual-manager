export type FormState = {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  code?: string;
  late?: boolean;
  daysAhead?: number;
};

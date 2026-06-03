export type AppToastTone = 'danger' | 'neutral' | 'success' | 'warning';

export type AppToastOptions = Readonly<{
  duration?: number;
  title?: string | null;
  tone?: AppToastTone;
}>;

export type AppToastEvent = Readonly<{
  duration?: number;
  id: number;
  message: string;
  title?: string | null;
  tone: AppToastTone;
}>;

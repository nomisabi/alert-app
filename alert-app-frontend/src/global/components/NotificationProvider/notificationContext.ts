import { createContext } from 'react';

export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

export type Notify = (message: string, severity?: NotificationSeverity) => void;

// Kept apart from the provider component, so React Fast Refresh works (one component per file)
export const NotificationContext = createContext<Notify | null>(null);

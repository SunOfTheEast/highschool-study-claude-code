import { createContext, type ReactNode, useContext } from 'react';
import type { CompanionBridge } from '../companion/contracts';
import type {
  CalendarAppointment,
  LearningContextReference,
} from '../../shared/contracts';
import type { CalendarNotificationStatus } from './bridge';

export type DesktopTools = {
  openSettings(): void;
  openHelp(): void;
  showNotification(title: string, body: string): Promise<void>;
  reconcileCalendarNotifications(
    appointments: readonly CalendarAppointment[],
  ): Promise<CalendarNotificationStatus>;
  openCalendarAppointment(appointment: CalendarAppointment): Promise<void>;
  openReview?(learningSetPath: string, contexts: LearningContextReference[]): Promise<void>;
  companion: CompanionBridge | null;
};

const DesktopToolsContext = createContext<DesktopTools | null>(null);

export function DesktopToolsProvider({
  value,
  children,
}: {
  value: DesktopTools;
  children: ReactNode;
}) {
  return <DesktopToolsContext.Provider value={value}>{children}</DesktopToolsContext.Provider>;
}

export function useDesktopTools(): DesktopTools | null {
  return useContext(DesktopToolsContext);
}

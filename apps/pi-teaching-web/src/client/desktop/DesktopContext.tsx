import { createContext, type ReactNode, useContext } from 'react';
import type { CompanionBridge } from '../companion/contracts';

export type DesktopTools = {
  openSettings(): void;
  openHelp(): void;
  showNotification(title: string, body: string): Promise<void>;
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

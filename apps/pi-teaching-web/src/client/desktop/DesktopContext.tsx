import { createContext, type ReactNode, useContext } from 'react';

export type DesktopTools = {
  openSettings(): void;
  openHelp(): void;
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

export function createReconnectGate() {
  let hasOpened = false;
  return {
    opened(): boolean {
      const reconnect = hasOpened;
      hasOpened = true;
      return reconnect;
    },
  };
}

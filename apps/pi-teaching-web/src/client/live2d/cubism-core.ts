let initialization: Promise<void> | null = null;

function installed(): boolean {
  return Boolean((globalThis as typeof globalThis & { Live2DCubismCore?: unknown }).Live2DCubismCore);
}

export function ensureCubismCore(coreSource: string): Promise<void> {
  if (installed()) return Promise.resolve();
  if (initialization) return initialization;

  initialization = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined' || !coreSource.trim()) {
      reject(new Error('CUBISM_CORE_UNAVAILABLE'));
      return;
    }

    const sourceUrl = URL.createObjectURL(new Blob([coreSource], { type: 'text/javascript' }));
    const script = document.createElement('script');
    script.async = true;
    script.src = sourceUrl;

    const release = () => {
      script.remove();
      URL.revokeObjectURL(sourceUrl);
    };
    script.onload = () => {
      release();
      if (installed()) resolve();
      else reject(new Error('CUBISM_CORE_DID_NOT_INITIALIZE'));
    };
    script.onerror = () => {
      release();
      reject(new Error('CUBISM_CORE_LOAD_FAILED'));
    };
    document.head.append(script);
  }).catch((error) => {
    initialization = null;
    throw error;
  });

  return initialization;
}

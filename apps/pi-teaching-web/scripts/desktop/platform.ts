export type DesktopTarget = {
  triple: 'aarch64-apple-darwin' | 'x86_64-pc-windows-msvc';
  bunTarget: 'bun-darwin-arm64' | 'bun-windows-x64-baseline';
  executableSuffix: '' | '.exe';
  bundleKind: 'dmg' | 'nsis';
};

export const desktopTargets = {
  'aarch64-apple-darwin': {
    triple: 'aarch64-apple-darwin',
    bunTarget: 'bun-darwin-arm64',
    executableSuffix: '',
    bundleKind: 'dmg',
  },
  'x86_64-pc-windows-msvc': {
    triple: 'x86_64-pc-windows-msvc',
    bunTarget: 'bun-windows-x64-baseline',
    executableSuffix: '.exe',
    bundleKind: 'nsis',
  },
} as const satisfies Record<DesktopTarget['triple'], DesktopTarget>;

type TargetEnvironment = Record<string, string | undefined>;

export function resolveDesktopTarget(
  environment: TargetEnvironment = process.env,
  platform = process.platform,
  architecture = process.arch,
): DesktopTarget {
  const configured = environment.STUDYFORGE_DESKTOP_TARGET;
  if (configured && configured in desktopTargets) {
    return desktopTargets[configured as keyof typeof desktopTargets];
  }
  if (configured) throw new Error(`STUDYFORGE_DESKTOP_TARGET_UNSUPPORTED: ${configured}`);
  if (platform === 'darwin' && architecture === 'arm64') {
    return desktopTargets['aarch64-apple-darwin'];
  }
  if (platform === 'win32' && architecture === 'x64') {
    return desktopTargets['x86_64-pc-windows-msvc'];
  }
  throw new Error(`STUDYFORGE_DESKTOP_TARGET_UNSUPPORTED: ${platform}-${architecture}`);
}

export function executableName(name: string, target: DesktopTarget): string {
  return `${name}${target.executableSuffix}`;
}

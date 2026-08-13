import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  requiredWindowsInstallFiles,
  windowsInstallLayout,
} from '../../scripts/desktop/verify-windows-install';

const appRoot = join(import.meta.dir, '../..');
const repositoryRoot = join(appRoot, '../..');

test('verifies the installed Windows app rather than build-tree stand-ins', () => {
  const layout = windowsInstallLayout('C:\\Users\\Student Name\\StudyForge 学生版');
  expect(layout).toEqual({
    root: 'C:\\Users\\Student Name\\StudyForge 学生版',
    app: 'C:\\Users\\Student Name\\StudyForge 学生版\\studyforge-desktop.exe',
    runtime: 'C:\\Users\\Student Name\\StudyForge 学生版\\studyforge-runtime.exe',
    pi: 'C:\\Users\\Student Name\\StudyForge 学生版\\studyforge-pi.exe',
    resourceRoot: 'C:\\Users\\Student Name\\StudyForge 学生版\\studyforge',
    bash: 'C:\\Users\\Student Name\\StudyForge 学生版\\studyforge\\platform\\windows\\portable-git\\bin\\bash.exe',
    rg: 'C:\\Users\\Student Name\\StudyForge 学生版\\studyforge\\platform\\windows\\tools\\rg.exe',
    fd: 'C:\\Users\\Student Name\\StudyForge 学生版\\studyforge\\platform\\windows\\tools\\fd.exe',
  });
  for (const path of [
    'studyforge-desktop.exe',
    'studyforge-runtime.exe',
    'studyforge-pi.exe',
    'studyforge/help/windows-installation.md',
    'studyforge/platform/windows/portable-git/bin/bash.exe',
    'studyforge/platform/windows/tools/rg.exe',
    'studyforge/platform/windows/tools/fd.exe',
    'studyforge/platform/windows/ARTIFACTS.json',
    'studyforge/platform/windows/THIRD_PARTY_NOTICES.md',
  ]) expect(requiredWindowsInstallFiles as readonly string[]).toContain(path);
});

test('builds, installs, verifies, and uninstalls the Windows x64 package in CI', () => {
  const packageJson = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'));
  expect(packageJson.scripts['desktop:build:windows'])
    .toBe('bun run scripts/desktop/build-release.ts x86_64-pc-windows-msvc');
  expect(packageJson.scripts['desktop:verify:windows'])
    .toBe('bun run scripts/desktop/verify-windows-install.ts');

  const workflow = readFileSync(
    join(repositoryRoot, '.github/workflows/windows-desktop.yml'),
    'utf8',
  );
  for (const text of [
    'windows-latest',
    "Join-Path $env:RUNNER_TEMP 'sf'",
    'worktree add --detach $shortRoot HEAD',
    'bun run desktop:build:windows',
    'StudyForge 学生 Beta',
    'bun run desktop:verify:windows',
    'Start-Process -FilePath $installer.FullName',
    '$installProcess.ExitCode',
    'Start-Process -FilePath $uninstaller',
    '$uninstallProcess.ExitCode',
    'uninstall.exe',
    'actions/upload-artifact',
  ]) expect(workflow).toContain(text);
  expect(workflow).not.toContain('subst ');
  expect(workflow).not.toContain('& $installer.FullName /S');
  expect(workflow).not.toContain('& $uninstaller /S');
});

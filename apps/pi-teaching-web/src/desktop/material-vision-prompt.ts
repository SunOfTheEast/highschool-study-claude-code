import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceResourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../resources');

export function loadMaterialVisionPrompt(resourceRoot?: string): string {
  const root = resourceRoot
    ?? process.env.STUDYFORGE_RESOURCE_ROOT?.trim()
    ?? sourceResourceRoot;
  const value = readFileSync(
    join(root, 'workers', 'study-material-vision-reader.md'),
    'utf8',
  ).trim();
  if (!value) throw new Error('MATERIAL_VISION_PROMPT_EMPTY');
  return value;
}

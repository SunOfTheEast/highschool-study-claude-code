import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createReadOnlyStudyTools } from '../../../src/runtime/study-tools';

export default function studyReadonlyTools(pi: ExtensionAPI) {
  for (const tool of createReadOnlyStudyTools(process.cwd())) {
    pi.registerTool(tool);
  }
}

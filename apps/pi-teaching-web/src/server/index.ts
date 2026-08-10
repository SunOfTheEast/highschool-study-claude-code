import { registerBunOAuthFlows } from '@earendil-works/pi-ai/bun-oauth';
import {
  formatReadyReceipt,
  parseRuntimeArguments,
  startStudyForgeServer,
} from './start-server';
import { registerStudyForgeBunRuntime } from '../runtime/bun-runtime';
import { runRuntimeSelfTest } from './runtime-self-test';

registerBunOAuthFlows();
registerStudyForgeBunRuntime();
const argv = process.argv.slice(2);
if (argv.includes('--runtime-self-test')) {
  const resourceRoot = argv[argv.indexOf('--resource-root') + 1];
  console.log(JSON.stringify(await runRuntimeSelfTest(resourceRoot ?? '')));
} else {
  const started = await startStudyForgeServer(parseRuntimeArguments(argv));
  console.log(formatReadyReceipt(started.receipt));
}

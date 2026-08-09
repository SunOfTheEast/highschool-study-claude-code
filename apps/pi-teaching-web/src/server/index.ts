import { registerBunOAuthFlows } from '@earendil-works/pi-ai/bun-oauth';
import {
  formatReadyReceipt,
  parseRuntimeArguments,
  startStudyForgeServer,
} from './start-server';

registerBunOAuthFlows();
const started = await startStudyForgeServer(parseRuntimeArguments(process.argv.slice(2)));
console.log(formatReadyReceipt(started.receipt));

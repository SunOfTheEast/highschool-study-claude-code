import {
  formatReadyReceipt,
  parseRuntimeArguments,
  startStudyForgeServer,
} from './start-server';

const started = await startStudyForgeServer(parseRuntimeArguments(process.argv.slice(2)));
console.log(formatReadyReceipt(started.receipt));

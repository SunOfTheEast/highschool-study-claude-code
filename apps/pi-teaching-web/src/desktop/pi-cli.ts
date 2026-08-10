import { registerBunOAuthFlows } from '@earendil-works/pi-ai/bun-oauth';
import { main } from '@earendil-works/pi-coding-agent';
import { configureHttpDispatcher } from '../../node_modules/@earendil-works/pi-coding-agent/dist/core/http-dispatcher.js';
import { registerStudyForgeBunRuntime } from '../runtime/bun-runtime';

process.title = 'pi';
process.env.PI_CODING_AGENT = 'true';
process.emitWarning = (() => {}) as typeof process.emitWarning;
registerBunOAuthFlows();
registerStudyForgeBunRuntime();
configureHttpDispatcher();
await main(process.argv.slice(2));

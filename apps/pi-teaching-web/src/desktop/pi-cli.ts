import { main } from '@earendil-works/pi-coding-agent';
import { configureHttpDispatcher } from '../../node_modules/@earendil-works/pi-coding-agent/dist/core/http-dispatcher.js';

process.title = 'pi';
process.env.PI_CODING_AGENT = 'true';
process.emitWarning = (() => {}) as typeof process.emitWarning;
configureHttpDispatcher();
await main(process.argv.slice(2));

import { bedrockProviderModule } from '@earendil-works/pi-ai/bedrock-provider';
import { setBedrockProviderModule } from '@earendil-works/pi-ai/compat';

export function registerStudyForgeBunRuntime() {
  setBedrockProviderModule(bedrockProviderModule);
  return { bedrock: 'registered' as const };
}

import type {
  Api,
  AuthInteraction,
  AuthType,
  Model,
} from '@earendil-works/pi-ai';
import { getSupportedThinkingLevels } from '@earendil-works/pi-ai';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import {
  type DesktopModelSelection,
  type DesktopThinkingLevel,
} from './contracts';

export type DesktopProviderDescriptor = {
  id: string;
  name: string;
  configured: boolean;
  authLabel: string | null;
  loginMethods: Array<{ type: AuthType; label: string }>;
};

export type DesktopModelDescriptor = {
  provider: string;
  id: string;
  name: string;
  thinkingLevels: DesktopThinkingLevel[];
};

type RuntimeFactory = (options: {
  authPath: string;
  modelsPath: string;
}) => Promise<ModelRuntime>;

function thinkingLevels(model: Model<Api>) {
  return getSupportedThinkingLevels(model) as DesktopThinkingLevel[];
}

export class DesktopModelService {
  constructor(readonly runtime: ModelRuntime) {}

  async catalog(): Promise<{
    providers: DesktopProviderDescriptor[];
    models: DesktopModelDescriptor[];
  }> {
    const providers = this.runtime.getProviders().map((provider) => {
      const status = this.runtime.getProviderAuthStatus(provider.id);
      const loginMethods: DesktopProviderDescriptor['loginMethods'] = [];
      if (provider.auth.apiKey?.login) {
        loginMethods.push({ type: 'api_key', label: provider.auth.apiKey.name });
      }
      if (provider.auth.oauth) {
        loginMethods.push({
          type: 'oauth',
          label: provider.auth.oauth.loginLabel ?? provider.auth.oauth.name,
        });
      }
      return {
        id: provider.id,
        name: provider.name,
        configured: status.configured,
        authLabel: status.label ?? null,
        loginMethods,
      };
    });
    const models = (await this.runtime.getAvailable()).map((model) => ({
      provider: model.provider,
      id: model.id,
      name: model.name,
      thinkingLevels: thinkingLevels(model),
    }));
    return { providers, models };
  }

  async resolve(selection: DesktopModelSelection): Promise<Model<Api>> {
    const model = (await this.runtime.getAvailable(selection.provider)).find((candidate) => (
      candidate.provider === selection.provider && candidate.id === selection.model
    ));
    if (!model) {
      throw new Error(`STUDYFORGE_MODEL_UNAVAILABLE: ${selection.provider}/${selection.model}`);
    }
    if (!thinkingLevels(model).includes(selection.thinking)) {
      throw new Error(`STUDYFORGE_THINKING_UNAVAILABLE: ${selection.thinking}`);
    }
    return model;
  }

  async apiKey(provider: string): Promise<string | null> {
    return (await this.runtime.getAuth(provider))?.auth.apiKey ?? null;
  }

  login(provider: string, type: AuthType, interaction: AuthInteraction) {
    return this.runtime.login(provider, type, interaction);
  }

  logout(provider: string) {
    return this.runtime.logout(provider);
  }
}

export async function createDesktopModelService(input: {
  authPath: string;
  modelsPath: string;
  createRuntime?: RuntimeFactory;
}): Promise<DesktopModelService> {
  const createRuntime = input.createRuntime ?? ((options) => ModelRuntime.create(options));
  const runtime = await createRuntime({ authPath: input.authPath, modelsPath: input.modelsPath });
  return new DesktopModelService(runtime);
}

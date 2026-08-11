import { api } from '../api';
import type { PeerLive2DManifest } from '../../shared/contracts';

export type PeerLive2DPackage = {
  manifest: PeerLive2DManifest;
  coreSource: string;
  modelFiles: File[];
};

export type PeerLive2DPackageApi = Pick<
  typeof api,
  'peerLive2DManifest' | 'peerLive2DFile'
>;

export async function loadPeerLive2DPackage(
  actorId: 'peer-axia',
  signal?: AbortSignal,
  source: PeerLive2DPackageApi = api,
): Promise<PeerLive2DPackage | null> {
  if (signal?.aborted) return null;

  try {
    const manifest = await source.peerLive2DManifest(actorId);
    if (!manifest || signal?.aborted) return null;

    const [core, ...modelBlobs] = await Promise.all([
      source.peerLive2DFile(actorId, manifest.coreFile, signal),
      ...manifest.modelFiles.map((path) => source.peerLive2DFile(actorId, path, signal)),
    ]);
    if (!core || modelBlobs.length !== manifest.modelFiles.length || modelBlobs.some((blob) => !blob)) {
      return null;
    }

    const coreSource = await core.text();
    if (!coreSource.trim() || signal?.aborted) return null;

    const modelFiles = modelBlobs.map((blob, index) => {
      const path = manifest.modelFiles[index]!;
      const file = new File([blob!], path.split('/').at(-1)!, { type: blob!.type });
      Object.defineProperty(file, 'webkitRelativePath', {
        configurable: false,
        enumerable: true,
        value: path,
      });
      return file;
    });

    return { manifest, coreSource, modelFiles };
  } catch {
    return null;
  }
}

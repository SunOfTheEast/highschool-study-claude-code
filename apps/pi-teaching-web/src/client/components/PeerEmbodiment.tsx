import type { PeerConversationItem } from '../../shared/contracts';
import type { PeerMouth, PeerPlaybackPhase } from '../peer-playback';

export function PeerEmbodiment({
  item,
  phase,
  mouth,
  portraitUrl,
  muted,
  onStop,
  onToggleMute,
}: {
  item: PeerConversationItem | null;
  phase: PeerPlaybackPhase;
  mouth: PeerMouth;
  portraitUrl: string | null;
  muted: boolean;
  onStop(): void;
  onToggleMute(): void;
}) {
  if (!item || phase === 'idle') return null;
  return (
    <aside
      className="peer-embodiment"
      data-expression={item.expression}
      data-mouth={mouth}
      data-phase={phase}
      aria-label="阿夏语音"
    >
      <div className="peer-portrait" aria-hidden="true">
        {portraitUrl
          ? <img src={portraitUrl} alt="" />
          : <span className="peer-portrait-placeholder"><i>夏</i></span>}
        {portraitUrl && <span className="peer-mouth" />}
      </div>
      <div className="peer-embodiment-caption">
        <span>{phase === 'loading' ? '阿夏正在准备声音' : '阿夏正在说'}</span>
        <div>
          <button type="button" aria-label="停止阿夏语音" onClick={onStop}>停止</button>
          <button
            type="button"
            aria-label={muted ? '开启阿夏语音' : '静音阿夏'}
            onClick={onToggleMute}
          >
            {muted ? '开声' : '静音'}
          </button>
        </div>
      </div>
    </aside>
  );
}

export default PeerEmbodiment;

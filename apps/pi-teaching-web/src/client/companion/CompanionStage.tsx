import type { PeerVisualState } from '../live2d/contracts';
import type { PeerPlaybackView } from '../peer-playback';
import { PeerEmbodiment } from '../components/PeerEmbodiment';
import { companionBubbleText } from './main-playback';

export function CompanionStage({
  text,
  state,
  playback,
}: {
  text: string;
  state: PeerVisualState;
  playback: PeerPlaybackView;
}) {
  const bubble = state.phase === 'speaking' ? companionBubbleText(text) : '';
  return (
    <main className="companion-stage" data-phase={state.phase}>
      {bubble && <p className="companion-bubble">{bubble}</p>}
      <PeerEmbodiment
        state={state}
        playbackActive={playback.phase !== 'idle'}
        muted={playback.muted}
        onStop={playback.stop}
        onToggleMute={playback.toggleMute}
      />
    </main>
  );
}

export default CompanionStage;

import { useState, type ChangeEvent, type ReactNode } from 'react';
import type {
  ConversationItem,
  PersonaPresentation,
  SessionKey,
  WorkflowView,
} from '../../shared/contracts';
import { api } from '../api';
import { DeepModeToggle } from './DeepModeToggle';
import { MarkdownView } from './MarkdownView';
import { MemoryReviewCard } from './MemoryReviewCard';
import { TaskRail } from './TaskRail';

type ComposerImage = { id: string; name: string; preview: string; path?: string };

export function ChatPanel({
  sessionKey,
  items,
  work,
  error,
  composerEnabled,
  lessonId,
  persona,
  deepMode,
  workflows,
  workflowControlsEnabled,
  workflowRailInline = false,
  gate,
  stage,
  onSend,
  onPersonaOpen,
  onDeepMode,
  onWorkflowAction,
  onMemoryReview,
}: {
  sessionKey: SessionKey;
  items: ConversationItem[];
  work: string;
  error: string | undefined;
  composerEnabled: boolean;
  lessonId?: string;
  persona: PersonaPresentation | null;
  deepMode: boolean;
  workflows: WorkflowView[];
  workflowControlsEnabled: boolean;
  workflowRailInline?: boolean;
  gate: ReactNode;
  stage?: ReactNode;
  onSend(text: string, imagePaths: string[]): Promise<void>;
  onPersonaOpen(): void;
  onDeepMode(enabled: boolean): Promise<void>;
  onWorkflowAction(id: string, action: 'confirm' | 'cancel'): Promise<void>;
  onMemoryReview(review: Extract<ConversationItem, { kind: 'memory-review' }>['review']): void;
}) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<ComposerImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const currentPersona = persona?.choices.find((choice) => choice.id === persona.id);

  const selectImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (!lessonId || files.length === 0) return;
    const pending = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      preview: URL.createObjectURL(file),
      file,
    }));
    setImages((current) => [...current, ...pending]);
    setUploading(true);
    setImageError('');
    try {
      const uploaded = await Promise.all(
        pending.map(async (item) => ({ id: item.id, ...(await api.uploadImage(lessonId, item.file)) })),
      );
      const paths = new Map<string, string>(uploaded.map((item) => [item.id, item.path]));
      setImages((current) => current.map((item) => {
        const path = paths.get(item.id);
        return path ? { ...item, path } : item;
      }));
    } catch {
      setImageError('图片上传失败，请重新选择。');
    } finally {
      setUploading(false);
    }
  };

  const clearImages = () => {
    for (const image of images) URL.revokeObjectURL(image.preview);
    setImages([]);
  };

  return (
    <section className="chat">
      <header className="chat-header">
        <span>当前输入只发送到</span>
        <strong>{sessionKey}</strong>
        {workflowControlsEnabled && (
          <DeepModeToggle enabled={deepMode} onChange={onDeepMode} />
        )}
        <button
          type="button"
          className="persona-avatar"
          aria-label="打开陪伴风格"
          title={currentPersona?.name ?? '陪伴风格'}
          disabled={!persona}
          onClick={onPersonaOpen}
        >
          {currentPersona?.portraitUrl
            ? <img src={currentPersona.portraitUrl} alt="" />
            : currentPersona?.glyph ?? '伴'}
        </button>
        <i className={composerEnabled ? 'live' : ''}>{composerEnabled ? '可对话' : '仅预览'}</i>
      </header>

      {workflowControlsEnabled && workflowRailInline && (
        <TaskRail workflows={workflows} onAction={onWorkflowAction} />
      )}

      {stage}
      <div className="timeline">
        {gate}
        {items.map((item) => item.kind === 'message' ? (
          <article key={item.message.id} className={`message ${item.message.role}`}>
            <span className="message-role">
              {item.message.role === 'student'
                ? '你'
                : item.message.role === 'coach' ? '学习顾问' : '课堂导师'}
            </span>
            <div><MarkdownView>{item.message.text}</MarkdownView></div>
          </article>
        ) : (
          <MemoryReviewCard
            key={item.review.id}
            review={item.review}
            onOpen={() => onMemoryReview(item.review)}
          />
        ))}
        {!gate && items.length === 0 && (
          <div className="empty-conversation">
            <span>从这里开始</span>
            <p>说说你现在的目标、卡住的地方，或者想先复盘哪一节课。</p>
          </div>
        )}
      </div>

      <div className="chat-feedback" aria-live="polite">
        {work && <p className="work-status"><span />{work}</p>}
        {(error || imageError) && <p className="session-error" role="alert">{error || imageError}</p>}
      </div>

      {composerEnabled && (
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            const value = text.trim();
            const imagePaths = images.flatMap((image) => image.path ? [image.path] : []);
            if (uploading || (!value && imagePaths.length === 0)) return;
            void onSend(value || '请查看我附上的图片。', imagePaths).then(() => {
              setText('');
              clearImages();
            });
          }}
        >
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="写下你的想法或解题过程…"
            rows={3}
          />
          {images.length > 0 && (
            <div className="image-previews">
              {images.map((image) => (
                <figure key={image.id}>
                  <img src={image.preview} alt={image.name} />
                  <figcaption>{image.path ? '已就绪' : '上传中'}</figcaption>
                </figure>
              ))}
            </div>
          )}
          <div className="composer-footer">
            <span className="composer-tools">
              {lessonId && (
                <label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(event) => void selectImages(event)}
                  />
                  ＋ 图片
                </label>
              )}
              <small>Markdown · LaTeX</small>
            </span>
            <button type="submit" disabled={uploading}>发送 <i aria-hidden="true">↗</i></button>
          </div>
        </form>
      )}
    </section>
  );
}

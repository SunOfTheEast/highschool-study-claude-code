import { useState, type ChangeEvent, type ReactNode } from 'react';
import type { ChatMessage, PersonaPresentation, SessionKey } from '../../shared/contracts';
import { api } from '../api';
import { MarkdownView } from './MarkdownView';

type ComposerImage = { id: string; name: string; preview: string; path?: string };

export function ChatPanel({
  sessionKey,
  messages,
  work,
  error,
  composerEnabled,
  lessonId,
  persona,
  gate,
  onSend,
  onPersona,
}: {
  sessionKey: SessionKey;
  messages: ChatMessage[];
  work: string;
  error: string | undefined;
  composerEnabled: boolean;
  lessonId?: string;
  persona: PersonaPresentation | null;
  gate: ReactNode;
  onSend(text: string, imagePaths: string[]): Promise<void>;
  onPersona(id: string): Promise<void>;
}) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<ComposerImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState('');

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
        <span className="persona-avatar" aria-hidden="true">
          {persona?.id === 'calm-senpai' ? '静' : persona?.id === 'energetic-classmate' ? '元' : '教'}
        </span>
        <label className="persona-picker">
          <span>课堂人设</span>
          <select
            aria-label="课堂人设"
            value={persona?.id ?? 'neutral-tutor'}
            disabled={!persona || !composerEnabled}
            onChange={(event) => void onPersona(event.target.value)}
          >
            {(persona?.choices ?? [{ id: 'neutral-tutor', name: '中性教师' }]).map((choice) => (
              <option key={choice.id} value={choice.id}>{choice.name}</option>
            ))}
          </select>
        </label>
        <i className={composerEnabled ? 'live' : ''}>{composerEnabled ? '可对话' : '仅预览'}</i>
      </header>

      <div className="timeline">
        {gate}
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            <span className="message-role">
              {message.role === 'student' ? '你' : message.role === 'coach' ? 'Coach' : 'Tutor'}
            </span>
            <div><MarkdownView>{message.text}</MarkdownView></div>
          </article>
        ))}
        {!gate && messages.length === 0 && (
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

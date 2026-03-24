import * as React from 'react';
import DOMPurify from 'dompurify';

export interface MarkupPreviewProps {
  /** Markup source (HTML or Markdown) */
  content?: string | undefined;

  /** Rendering format */
  format?: 'html' | 'markdown' | undefined;

  /** Shown when content is empty */
  emptyHint?: string | undefined;

  className?: string | undefined;
  style?: React.CSSProperties | undefined;
}

/**
 * Minimal markdown renderer.
 * You may replace this with marked / markdown-it later.
 */
function renderMarkdown(markdown: string): string {
  let html = markdown
    // headings
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')

    // bold / italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')

    // line breaks
    .replace(/\n/g, '<br />');

  return html;
}

/**
 * Sanitize HTML safely.
 * This is the only place where dangerous HTML is handled.
 */
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },

    // Optional hardening — uncomment if desired:
    FORBID_TAGS: ['style', 'script', 'iframe'],
    FORBID_ATTR: ['style', 'onerror', 'onclick'],
  });
}

export function MarkupPreview({
  content,
  format = 'html',
  emptyHint = 'No content',
  className,
  style,
}: MarkupPreviewProps) {
  const source = content?.trim();

  if (!source) {
    return (
      <div
        className={className}
        style={{ fontStyle: 'italic', opacity: 0.7, ...style }}
      >
        {emptyHint}
      </div>
    );
  }

  const rawHtml =
    format === 'markdown'
      ? renderMarkdown(source)
      : source;

  const safeHtml = sanitizeHtml(rawHtml);

  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
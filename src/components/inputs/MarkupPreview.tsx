import * as React from 'react';

/**
 * NOTE:
 * If you already use a sanitizer elsewhere, plug it in here.
 * This implementation assumes trusted content (same as HtmlPreview did).
 */

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
 * Replace with a real library (marked, markdown-it, etc.) if already used elsewhere.
 */
function renderMarkdown(markdown: string): string {
  // VERY minimal – intentional
  // Headings
  let html = markdown
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>');

  // Bold / italic
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Line breaks
  html = html.replace(/\n/g, '<br />');

  return html;
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

  const html =
    format === 'markdown'
      ? renderMarkdown(source)
      : source;

  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
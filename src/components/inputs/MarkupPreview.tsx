import * as React from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

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
 * Configure marked once.
 * Keep this minimal and predictable.
 */
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Sanitize HTML safely.
 * This is the single trust boundary.
 */
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },

    // Optional hardening (uncomment if desired)
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

  // 1) Convert markup → HTML
  const rawHtml =
    format === 'markdown'
      ? marked.parse(source, { async: false })
      : source;

  // 2) Sanitize HTML
  const safeHtml = sanitizeHtml(rawHtml);

  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
import * as React from 'react';
import '../../styles/htmlpreview.css';

export interface HtmlPreviewProps {
  /** Raw HTML string to preview (unsanitized). */
  html?: string | undefined;

  /** Optional heading (e.g., "Description"). */
  title?: string | undefined;

  /** Optional note shown when content is empty. */
  emptyHint?: string | undefined;

  /** Optional container style/class hooks */
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
}

/**
 * Minimal allow-list HTML sanitizer: keeps a safe subset of tags/attrs,
 * strips scripts/event handlers/styles/unknown attributes.
 * NOTE: If you later add a full sanitizer (e.g., DOMPurify), swap this.
 */
function sanitizeHtml(input: string): string {
  // Quick bail-outs
  if (!input) return '';

  // 1) Remove <script>, <style>, and anything with on* handlers
  let s = input
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')        // onClick="..."
    .replace(/\son\w+='[^']*'/gi, '')        // onClick='...'
    .replace(/\son\w+=\S+/gi, '');           // onClick=xyz

  // 2) Allow-list tags and attributes
  //    Allowed tags: headings, p/div/span, lists, anchors, hr/br, strong/em, code/pre, table, img (src,alt)
  const ALLOWED_TAGS = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'div', 'span', 'br', 'hr',
    'ul', 'ol', 'li',
    'a', 'strong', 'em', 'b', 'i', 'u', 'code', 'pre',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'img',
  ]);
  const ALLOWED_ATTR = new Map<string, Set<string>>([
    ['a', new Set(['href', 'title', 'target', 'rel'])],
    ['img', new Set(['src', 'alt'])],
    ['*', new Set(['class'])], // limited global: class (optional)
  ]);

  // 3) Strip attributes not in allow-list, strip non-allowed tags
  //    We do a simple tag-by-tag rewrite using the browser's parser for safety.
  const container = document.createElement('div');
  container.innerHTML = s;

  const cleanseNode = (node: Element | ChildNode) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      // Replace node by its textContent (or children if block)
      const replacement = document.createTextNode(el.textContent || '');
      el.replaceWith(replacement);
      return;
    }

    // Allowed attributes for this tag
    const allowedForTag = new Set<string>([
      ...(ALLOWED_ATTR.get('*') ?? new Set()),
      ...(ALLOWED_ATTR.get(tag) ?? new Set()),
    ]);

    // Remove style attribute always; prune others
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();

      // Kill styles and data-*, javascript: URLs, and anything not allowed
      if (name === 'style' || name.startsWith('data-')) {
        el.removeAttribute(attr.name);
        return;
      }

      if (!allowedForTag.has(name)) {
        el.removeAttribute(attr.name);
        return;
      }

      // Prevent javascript: in href/src
      if ((name === 'href' || name === 'src') && /^javascript:/i.test(attr.value || '')) {
        el.removeAttribute(attr.name);
      }

      // For <a>, enforce rel + target safety if target is set
      if (tag === 'a' && name === 'target') {
        const targetVal = (attr.value || '').toLowerCase();
        if (['_blank', '_self', '_parent', '_top'].indexOf(targetVal) === -1) {
          el.setAttribute('target', '_self');
        }
        if (!el.getAttribute('rel')) {
          el.setAttribute('rel', 'noopener noreferrer');
        }
      }
    });

    // Recurse
    [...el.childNodes].forEach(cleanseNode);
  };

  [...container.childNodes].forEach(cleanseNode);
  return container.innerHTML;
}

export function HtmlPreview({
  html,
  title,
  emptyHint = 'No content',
  className,
  style,
}: HtmlPreviewProps) {
  const sanitized = React.useMemo(() => sanitizeHtml(html ?? ''), [html]);

  return (
    <div className={className} style={style}>
      {title && <h4 style={{ margin: '6px 0' }}>{title}</h4>}
      {sanitized
        ? <div dangerouslySetInnerHTML={{ __html: sanitized }} />
        : <div style={{ color: 'var(--muted)' }}>{emptyHint}</div>}
    </div>
  );
}
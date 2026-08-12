import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Markdown renderer for creator-authored copy.
 *
 * Renders a deliberately small subset straight into React elements instead of
 * converting to an HTML string. Product descriptions are untrusted user
 * content, so the important property here is that `dangerouslySetInnerHTML`
 * never appears in the path: an injected `<script>`, an `onerror=` attribute
 * or a stray `<iframe>` is text, not markup, and no sanitiser has to be
 * trusted to catch it. Anything outside the supported subset degrades to plain
 * text rather than vanishing, so a creator never silently loses content.
 *
 * Supported: `##`/`###` headings, paragraphs, `-` lists, `**bold**`,
 * `` `code` `` and `[label](href)` links.
 */

/** Splits on inline spans while keeping the delimiters (capturing group). */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

/**
 * Only absolute HTTPS and site-relative links survive. `javascript:`, `data:`
 * and protocol-relative (`//host`) URLs are rejected and fall through to plain
 * text — the three shapes that turn a link into an XSS or phishing vector.
 */
function isSafeHref(href: string): boolean {
  if (href.startsWith('//')) return false;
  return href.startsWith('https://') || href.startsWith('/');
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((token, index) => {
      const key = `${keyPrefix}-${index}`;

      if (token.startsWith('**') && token.endsWith('**')) {
        return <strong key={key}>{token.slice(2, -2)}</strong>;
      }

      if (token.startsWith('`') && token.endsWith('`')) {
        return (
          <code
            key={key}
            className="rounded-[5px] bg-bg px-[5px] py-[2px] font-mono text-[0.9em]"
          >
            {token.slice(1, -1)}
          </code>
        );
      }

      const link = LINK.exec(token);
      if (link) {
        const label = link[1] ?? '';
        const href = link[2] ?? '';

        if (!isSafeHref(href)) return <Fragment key={key}>{token}</Fragment>;

        return (
          <a
            key={key}
            href={href}
            // ugc + nofollow: creator-authored links must not pass ranking
            // signal, and noopener severs the reverse window handle.
            rel="nofollow ugc noopener noreferrer"
            target="_blank"
            className="text-blue-700 underline underline-offset-2"
          >
            {label}
          </a>
        );
      }

      return <Fragment key={key}>{token}</Fragment>;
    });
}

export function Markdown({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    const key = `p-${blocks.length}`;
    blocks.push(
      <p key={key} className="text-[15.5px] leading-[1.75] text-[#475569]">
        {renderInline(text, key)}
      </p>
    );
    paragraph = [];
  }

  function flushList() {
    if (list.length === 0) return;
    const key = `ul-${blocks.length}`;
    blocks.push(
      <ul key={key} className="flex flex-col gap-2 pl-1">
        {list.map((item, index) => (
          <li
            key={`${key}-${index}`}
            className="flex gap-3 text-[15.5px] leading-[1.7] text-[#475569]"
          >
            <span aria-hidden="true" className="text-blue">
              •
            </span>
            <span>{renderInline(item, `${key}-${index}`)}</span>
          </li>
        ))}
      </ul>
    );
    list = [];
  }

  for (const raw of source.split('\n')) {
    const line = raw.trim();

    if (line === '') {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      const key = `h3-${blocks.length}`;
      blocks.push(
        <h3 key={key} className="mt-2 text-[18px] font-extrabold">
          {renderInline(line.slice(4), key)}
        </h3>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      const key = `h2-${blocks.length}`;
      blocks.push(
        <h3 key={key} className="mt-3 text-[21px] font-extrabold">
          {renderInline(line.slice(3), key)}
        </h3>
      );
      continue;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return <div className={cn('flex flex-col gap-4', className)}>{blocks}</div>;
}

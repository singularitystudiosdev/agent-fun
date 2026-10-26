import type { ReactNode } from 'react';

type Block = { kind: 'p'; text: string } | { kind: 'h'; text: string } | { kind: 'ul'; items: string[] };

const HEADING = /^#{1,6}\s+/;
const BULLET = /^[-*]\s+/;

/**
 * Plain-text listing description -> blocks. A blank line ends a paragraph; a line starting "- " (or "* ") is a bullet,
 * consecutive bullets form one list; a line starting "## " is a subheading. Other consecutive lines join into one
 * paragraph. Never HTML: every block renders as React text, so markup in the source shows as text.
 */
export function parseDescription(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };
  const flushList = () => {
    if (list?.length) blocks.push({ kind: 'ul', items: list });
    list = null;
  };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
    } else if (HEADING.test(line)) {
      flushPara();
      flushList();
      blocks.push({ kind: 'h', text: line.replace(HEADING, '') });
    } else if (BULLET.test(line)) {
      flushPara();
      (list ??= []).push(line.replace(BULLET, ''));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

/** The full listing description: paragraphs, subheadings (h3, under the page's "About this bounty" h2) and bullet lists. */
export function BountyDescription({ text }: { text: string }) {
  const blocks = parseDescription(text);
  if (!blocks.length) return <p className="text-body-base text-pk-content-tertiary">No description provided.</p>;
  return (
    <div className="flex flex-col gap-2 text-body-base text-pk-content-secondary">
      {blocks.map((b, i): ReactNode => {
        if (b.kind === 'h')
          return (
            <h3 key={i} className="pt-2 text-body-base font-semibold text-pk-content-primary first:pt-0">
              {b.text}
            </h3>
          );
        if (b.kind === 'ul')
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5 marker:text-pk-content-tertiary">
              {b.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        return (
          <p key={i} className="text-pretty">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Builds short side-by-side excerpts from two policy texts for API responses.
 */

import { diffWords } from 'diff';

const EXCERPT_LIMIT = 2_000;

export interface PolicyExcerpts {
  fromExcerpt: string;
  toExcerpt: string;
  removedSpan: string;
  addedSpan: string;
}

/** Caps a string so change reports do not return full policy documents. */
function cap(value: string): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= EXCERPT_LIMIT) {
    return trimmed;
  }
  return `${trimmed.slice(0, EXCERPT_LIMIT)}…`;
}

/** Returns capped previous/current excerpts plus the joined added and removed spans. */
export function buildPolicyExcerpts(
  previousText: string,
  currentText: string,
): PolicyExcerpts {
  const parts = diffWords(previousText, currentText);
  const removed: string[] = [];
  const added: string[] = [];

  for (const part of parts) {
    if (part.removed) {
      removed.push(part.value);
    } else if (part.added) {
      added.push(part.value);
    }
  }

  return {
    fromExcerpt: cap(previousText),
    toExcerpt: cap(currentText),
    removedSpan: cap(removed.join(' ')),
    addedSpan: cap(added.join(' ')),
  };
}
/**
 * Builds short side-by-side excerpts from two policy texts for API responses.
 */

const EXCERPT_LIMIT = 2_000;
const MAX_SENTENCES = 4;
const MIN_WORDS = 8;
const MAX_WORDS = 50;

export interface PolicyExcerpts {
  fromExcerpt: string;
  toExcerpt: string;
  removedSpan: string;
  addedSpan: string;
}

/** Caps a string so change reports do not return full policy documents. */
function cap(value: string): string {
  const trimmed = value.replace(/[ \t]+/g, ' ').trim();
  if (trimmed.length <= EXCERPT_LIMIT) {
    return trimmed;
  }
  return `${trimmed.slice(0, EXCERPT_LIMIT)}…`;
}

/** Separates headings that were glued onto the previous sentence. */
function preparePolicyText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/([.!?])([A-Z"])/g, '$1 $2')
    .trim();
}

/** Drops page chrome and fragments that are not a readable policy sentence. */
function isUsefulSentence(sentence: string): boolean {
  const words = sentence.split(/\s+/);
  if (words.length < MIN_WORDS || words.length > MAX_WORDS) {
    return false;
  }
  if (sentence.length < 40 || sentence.length > 400) {
    return false;
  }
  if (!/[.!?]"?$/.test(sentence)) {
    return false;
  }
  if (words.some((word) => word.length > 28)) {
    return false;
  }
  if (/[a-z][A-Z]/.test(sentence)) {
    return false;
  }
  if (
    /closenew|try itwhatsapp|archived versions|back to top|policyhawk demonstration|did not publish this section/i.test(
      sentence,
    )
  ) {
    return false;
  }
  return true;
}

/** Splits policy text into sentences that can stand alone in a report. */
function usefulSentences(text: string): string[] {
  return preparePolicyText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(isUsefulSentence);
}

/** Finds one complete sentence in a policy that contains the first matching hint. */
export function findPolicySentence(text: string, hints: string[]): string {
  const sentences = usefulSentences(text);
  for (const hint of hints) {
    const needle = hint.toLowerCase();
    const found = sentences.find((sentence) => sentence.toLowerCase().includes(needle));
    if (found) {
      return found;
    }
  }
  return '';
}

function sentenceKey(sentence: string): string {
  return sentence.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Returns the sentences present on one side of the comparison and missing on the other. */
function differingSentences(source: string[], other: string[]): string[] {
  const otherKeys = new Set(other.map(sentenceKey));
  return source
    .filter((sentence) => !otherKeys.has(sentenceKey(sentence)))
    .slice(0, MAX_SENTENCES);
}

/** Returns capped previous/current excerpts plus the sentences that differ. */
export function buildPolicyExcerpts(
  previousText: string,
  currentText: string,
): PolicyExcerpts {
  const previousSentences = usefulSentences(previousText);
  const currentSentences = usefulSentences(currentText);
  const removed = differingSentences(previousSentences, currentSentences);
  const added = differingSentences(currentSentences, previousSentences);
  const removedSpan = removed.join('\n\n');
  const addedSpan = added.join('\n\n');

  return {
    fromExcerpt: cap(removedSpan || previousText),
    toExcerpt: cap(addedSpan || currentText),
    removedSpan,
    addedSpan,
  };
}

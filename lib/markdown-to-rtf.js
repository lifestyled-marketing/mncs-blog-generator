function escapeRtf(text) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (ch === '\\') {
      out += '\\\\';
    } else if (ch === '{') {
      out += '\\{';
    } else if (ch === '}') {
      out += '\\}';
    } else if (cp < 0x80) {
      out += ch;
    } else if (cp <= 0xffff) {
      const signed = cp >= 0x8000 ? cp - 0x10000 : cp;
      out += `\\u${signed}?`;
    } else {
      const adj = cp - 0x10000;
      const high = 0xd800 + (adj >> 10);
      const low = 0xdc00 + (adj & 0x3ff);
      out += `\\u${high - 0x10000}?\\u${low - 0x10000}?`;
    }
  }
  return out;
}

function processInline(text) {
  let s = escapeRtf(text);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  s = s.replace(/\*\*([^*]+?)\*\*/g, '{\\b $1}');
  s = s.replace(/__([^_]+?)__/g, '{\\b $1}');
  s = s.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\*)/g, '$1{\\i $2}');
  s = s.replace(/(^|[^_\w])_([^_\n]+?)_(?!_)/g, '$1{\\i $2}');
  s = s.replace(/`([^`]+?)`/g, '$1');
  return s;
}

const HEADING_SIZES = { 1: 36, 2: 32, 3: 28, 4: 26, 5: 24, 6: 24 };

export function markdownToRtf(markdown) {
  const header =
    '{\\rtf1\\ansi\\ansicpg1252\\deff0' +
    '{\\fonttbl{\\f0\\fswiss Calibri;}}' +
    '\\f0\\fs24 ';
  const footer = '}';

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const parts = [];
  let paragraph = [];
  let inFence = false;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    parts.push(processInline(paragraph.join(' ')) + '\\par\\par ');
    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      flushParagraph();
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      parts.push(escapeRtf(line) + '\\line ');
      continue;
    }

    if (trimmed === '') {
      flushParagraph();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      const size = HEADING_SIZES[level];
      parts.push(`{\\fs${size}\\b ${processInline(headingMatch[2])}}\\par\\par `);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      parts.push(`\\bullet\\tab ${processInline(ulMatch[1])}\\par `);
      continue;
    }

    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      parts.push(`${olMatch[1]}.\\tab ${processInline(olMatch[2])}\\par `);
      continue;
    }

    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      flushParagraph();
      parts.push('\\par ');
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      parts.push(`{\\i ${processInline(trimmed.replace(/^>\s?/, ''))}}\\par\\par `);
      continue;
    }

    paragraph.push(trimmed);
  }
  flushParagraph();

  return header + parts.join('') + footer;
}

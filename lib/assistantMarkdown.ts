// lib/assistantMarkdown.ts
// Phân tích Markdown ngắn mà trợ lý AI trả về (BE yêu cầu mô hình trả lời bằng gạch đầu dòng) thành khối + đoạn chữ,
// để component vẽ bằng <Text>. Không thêm thư viện (react-markdown của web là thư viện DOM).
//
// Giống web (skipHtml, ảnh → chữ alt): thẻ HTML bị bỏ, ảnh chỉ còn chữ alt, liên kết chỉ giữ chữ hiển thị
// (không mở được — địa chỉ do mô hình sinh ra không đáng tin để mở trong app).

export interface InlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export interface ListItem {
  /** 0 = cấp ngoài cùng; tối đa 3 */
  depth: number;
  /** "•", "◦" hoặc số thứ tự như "1." */
  marker: string;
  spans: InlineSpan[];
}

export type MarkdownBlock =
  | { type: 'paragraph'; spans: InlineSpan[] }
  | { type: 'heading'; level: 1 | 2 | 3; spans: InlineSpan[] }
  | { type: 'list'; items: ListItem[] }
  | { type: 'quote'; spans: InlineSpan[] }
  | { type: 'code'; text: string }
  | { type: 'table'; header: InlineSpan[][]; rows: InlineSpan[][][] }
  | { type: 'rule' };

type Style = Pick<InlineSpan, 'bold' | 'italic' | 'code'>;

const MAX_LIST_DEPTH = 3;
const ESCAPABLE = '\\`*_{}[]()#+-.!|~>';
const LIST_ITEM = /^(\s*)([-*+•]|\d{1,9}[.)])\s+(.*)$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/;
const QUOTE = /^\s{0,3}>/;
const FENCE = /^\s*(```|~~~)/;
const IMAGE = /^!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/;
const LINK = /^\[([^\]]+)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/;
const BREAK_TAG = /^<br\s*\/?>/i;
const HTML_TAG = /^<\/?[a-zA-Z][^>\n]*>/;
const TABLE_SEPARATOR_CELL = /^:?-+:?$/;

// Chữ cái (kể cả tiếng Việt có dấu: có phân biệt hoa/thường) hoặc chữ số — không dùng \p{L} để chạy được trên mọi engine JS
const isWord = (ch: string | undefined) => ch !== undefined && (ch.toLowerCase() !== ch.toUpperCase() || (ch >= '0' && ch <= '9'));
const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch);

// ─── Chữ trong dòng ─────────────────────────────────────────────────────────────

/** Vị trí đóng của dấu in đậm/nghiêng; với dấu đôi lấy đuôi của chuỗi sao liền nhau (***a*** → đóng ở hai sao cuối) */
function findClosing(text: string, from: number, delim: string) {
  const char = delim[0];
  let idx = text.indexOf(delim, from);
  while (idx !== -1) {
    if (text[idx - 1] === '\\') {
      idx = text.indexOf(delim, idx + 1);
      continue;
    }
    if (delim.length === 1) {
      // dấu đơn nằm trong dấu đôi (**) thì bỏ qua cả cặp
      if (text[idx + 1] === char) {
        idx = text.indexOf(delim, idx + 2);
        continue;
      }
      return idx;
    }
    let end = idx;
    while (text[end + delim.length] === char) end += 1;
    return end;
  }
  return -1;
}

function walk(text: string, style: Style, out: InlineSpan[]) {
  let plain = '';
  const flush = () => {
    if (plain) {
      out.push({ text: plain, ...style });
      plain = '';
    }
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === '\\' && i + 1 < text.length && ESCAPABLE.includes(text[i + 1])) {
      plain += text[i + 1];
      i += 2;
      continue;
    }

    if (ch === '<') {
      const rest = text.slice(i);
      const br = BREAK_TAG.exec(rest);
      if (br) {
        plain += '\n';
        i += br[0].length;
        continue;
      }
      const tag = HTML_TAG.exec(rest);
      if (tag) {
        i += tag[0].length;
        continue;
      }
    }

    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        out.push({ text: text.slice(i + 1, end), ...style, code: true });
        i = end + 1;
        continue;
      }
    }

    if (ch === '!' && text[i + 1] === '[') {
      const image = IMAGE.exec(text.slice(i));
      if (image) {
        plain += image[1];
        i += image[0].length;
        continue;
      }
    }

    if (ch === '[') {
      const link = LINK.exec(text.slice(i));
      if (link) {
        flush();
        walk(link[1], style, out);
        i += link[0].length;
        continue;
      }
    }

    if ((ch === '*' || ch === '_') && text[i + 1] === ch && !isSpace(text[i + 2])) {
      const end = findClosing(text, i + 2, ch + ch);
      if (end > i + 2 && !isSpace(text[end - 1])) {
        flush();
        walk(text.slice(i + 2, end), { ...style, bold: true }, out);
        i = end + 2;
        continue;
      }
    }

    if (ch === '*' || ch === '_') {
      const opens = !isSpace(text[i + 1]) && (ch === '*' || !isWord(text[i - 1]));
      if (opens) {
        const end = findClosing(text, i + 1, ch);
        const closes = end > i + 1 && !isSpace(text[end - 1]) && (ch === '*' || !isWord(text[end + 1]));
        if (closes) {
          flush();
          walk(text.slice(i + 1, end), { ...style, italic: true }, out);
          i = end + 1;
          continue;
        }
      }
    }

    if (ch === '~' && text[i + 1] === '~') {
      const end = text.indexOf('~~', i + 2);
      if (end > i + 2) {
        // Không có kiểu gạch ngang trong app: giữ nguyên nội dung
        flush();
        walk(text.slice(i + 2, end), style, out);
        i = end + 2;
        continue;
      }
    }

    plain += ch;
    i += 1;
  }
  flush();
}

const sameStyle = (a: InlineSpan, b: InlineSpan) => Boolean(a.bold) === Boolean(b.bold) && Boolean(a.italic) === Boolean(b.italic) && Boolean(a.code) === Boolean(b.code);

/** "Xin **chào** `bạn`" → các đoạn chữ kèm kiểu (in đậm, nghiêng, mã) */
export function parseInline(text: string): InlineSpan[] {
  const raw: InlineSpan[] = [];
  walk(text, {}, raw);
  const merged: InlineSpan[] = [];
  for (const span of raw) {
    const last = merged[merged.length - 1];
    if (last && sameStyle(last, span)) last.text += span.text;
    else merged.push({ ...span });
  }
  return merged;
}

/** Chữ thuần (bỏ ký hiệu Markdown) — dùng khi sao chép hoặc đọc cho trình đọc màn hình */
export function inlineToPlain(spans: readonly InlineSpan[]) {
  return spans.map((s) => s.text).join('');
}

// ─── Khối ───────────────────────────────────────────────────────────────────────

function splitRow(line: string) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const cells: string[] = [];
  let cell = '';
  for (let i = 0; i < row.length; i += 1) {
    if (row[i] === '\\' && row[i + 1] === '|') {
      cell += '|';
      i += 1;
    } else if (row[i] === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += row[i];
    }
  }
  cells.push(cell.trim());
  return cells;
}

function isTableStart(lines: readonly string[], index: number) {
  const header = lines[index];
  const separator = lines[index + 1];
  if (separator === undefined || !header.includes('|') || !separator.includes('|')) return false;
  const cells = splitRow(separator);
  return cells.length >= 1 && cells.every((c) => TABLE_SEPARATOR_CELL.test(c));
}

function startsBlock(lines: readonly string[], index: number) {
  const line = lines[index];
  return FENCE.test(line) || RULE.test(line) || HEADING.test(line) || QUOTE.test(line) || LIST_ITEM.test(line) || isTableStart(lines, index);
}

function parseList(lines: readonly string[], start: number) {
  const indents: number[] = [];
  const depthFor = (indent: number) => {
    while (indents.length && indents[indents.length - 1] > indent) indents.pop();
    if (!indents.length || indents[indents.length - 1] < indent) indents.push(indent);
    return Math.min(indents.length - 1, MAX_LIST_DEPTH);
  };

  const raws: { depth: number; marker: string; text: string }[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const item = LIST_ITEM.exec(line);
    if (item) {
      const depth = depthFor(item[1].length);
      const ordered = /^\d/.test(item[2]);
      raws.push({ depth, marker: ordered ? `${item[2].replace(/[.)]$/, '')}.` : depth === 0 ? '•' : '◦', text: item[3] });
      i += 1;
    } else if (!line.trim()) {
      // dòng trống chỉ ngắt danh sách khi sau đó không còn mục nào
      let next = i + 1;
      while (next < lines.length && !lines[next].trim()) next += 1;
      if (next < lines.length && LIST_ITEM.test(lines[next])) i = next;
      else break;
    } else if (/^\s+\S/.test(line) && raws.length && !startsBlock(lines, i)) {
      raws[raws.length - 1].text += ` ${line.trim()}`;
      i += 1;
    } else {
      break;
    }
  }
  return { block: { type: 'list', items: raws.map((r) => ({ depth: r.depth, marker: r.marker, spans: parseInline(r.text) })) } as MarkdownBlock, next: i };
}

/** Markdown → danh sách khối để vẽ */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const blocks: MarkdownBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: Math.min(heading[1].length, 3) as 1 | 2 | 3, spans: parseInline(heading[2]) });
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        body.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', spans: parseInline(body.join('\n')) });
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        const cells = splitRow(lines[i]);
        // đủ cột theo tiêu đề: thiếu thì thêm ô trống, thừa thì bỏ
        rows.push(Array.from({ length: header.length }, (_, c) => cells[c] ?? ''));
        i += 1;
      }
      blocks.push({ type: 'table', header: header.map(parseInline), rows: rows.map((r) => r.map(parseInline)) });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const { block, next } = parseList(lines, i);
      blocks.push(block);
      i = next;
      continue;
    }

    const paragraph = [line.trim()];
    i += 1;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', spans: parseInline(paragraph.join('\n')) });
  }

  return blocks;
}

// ─── Chữ thuần ──────────────────────────────────────────────────────────────────

/** Bản chữ thuần của câu trả lời (không còn ký hiệu Markdown) để sao chép sang nơi khác */
export function markdownToPlainText(source: string) {
  const lines: string[] = [];
  for (const block of parseMarkdown(source)) {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
      case 'quote':
        lines.push(inlineToPlain(block.spans));
        break;
      case 'list':
        for (const item of block.items) lines.push(`${'  '.repeat(item.depth)}${item.marker} ${inlineToPlain(item.spans)}`);
        break;
      case 'code':
        lines.push(block.text);
        break;
      case 'table':
        lines.push(block.header.map(inlineToPlain).join(' | '));
        for (const row of block.rows) lines.push(row.map(inlineToPlain).join(' | '));
        break;
      case 'rule':
        break;
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

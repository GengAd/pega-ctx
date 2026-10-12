// Line of each value of a JSON text, by JSON Pointer: a lint message points at the line to fix.
// The text is valid JSON (JSON.parse first); this reader only follows its structure.
export function lineOf(text) {
  const lines = new Map();
  let i = 0;
  let line = 1;
  const skip = () => {
    while (i < text.length && /\s/.test(text[i])) {
      if (text[i] === '\n') line++;
      i++;
    }
  };
  const string = () => {
    const start = i++;
    while (text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    i++;
    return JSON.parse(text.slice(start, i));
  };
  const value = (pointer) => {
    skip();
    lines.set(pointer, line);
    const c = text[i];
    if (c === '{') {
      i++;
      skip();
      if (text[i] === '}') return void i++;
      for (;;) {
        skip();
        const k = string();
        skip();
        i++; // :
        value(`${pointer}/${k.replaceAll('~', '~0').replaceAll('/', '~1')}`);
        skip();
        if (text[i++] === '}') return;
      }
    }
    if (c === '[') {
      i++;
      skip();
      if (text[i] === ']') return void i++;
      for (let n = 0; ; n++) {
        value(`${pointer}/${n}`);
        skip();
        if (text[i++] === ']') return;
      }
    }
    if (c === '"') return void string();
    while (i < text.length && !/[\s,\]}]/.test(text[i])) i++;
  };
  value('');
  // The closest known parent for a pointer that is not in the text (a missing field: its object).
  return (pointer) => {
    for (let p = pointer; ; p = p.slice(0, p.lastIndexOf('/'))) {
      if (lines.has(p)) return lines.get(p);
      if (!p) return 1;
    }
  };
}

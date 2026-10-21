// A bounded tail of printed text, for the console strip under the iPhone
// preview: the last `maxLines` line segments, each at most `maxLineChars`
// characters (a longer line keeps its end, after a leading ellipsis).
// Appending costs time in proportion to the new text, never to everything
// printed before, so a program that prints half a million characters without
// a newline stays cheap.
export function createConsoleTail({ maxLines = 6, maxLineChars = 2000 } = {}) {
  let lines = [''];
  let clipped = [false];
  // A line is allowed to grow to twice the cap before it is cut back, so the
  // copy that cutting costs happens once per maxLineChars appended characters.
  const compact = (i) => {
    if (lines[i].length > 2 * maxLineChars) { lines[i] = lines[i].slice(-maxLineChars); clipped[i] = true; }
  };
  return {
    append(chunk) {
      const parts = String(chunk).split('\n');
      if (parts.length > maxLines) {
        // every earlier line has scrolled out of view
        lines = parts.slice(-maxLines);
        clipped = lines.map(() => false);
      } else {
        lines[lines.length - 1] += parts[0];
        for (let k = 1; k < parts.length; k++) { lines.push(parts[k]); clipped.push(false); }
        if (lines.length > maxLines) {
          lines = lines.slice(-maxLines);
          clipped = clipped.slice(-maxLines);
        }
      }
      for (let i = 0; i < lines.length; i++) compact(i);
    },
    text() {
      return lines.map((l, i) => (clipped[i] || l.length > maxLineChars ? '…' + l.slice(-(maxLineChars - 1)) : l)).join('\n');
    },
    // Characters held, at most maxLines * 2 * maxLineChars.
    size() { return lines.reduce((n, l) => n + l.length, 0); },
    lineCount() { return lines.length; },
  };
}

// Helpers for placing generated text inside an HTML page without letting it
// break out of the element it is written into.

// JavaScript source for an inline <script>: the HTML parser ends the element at
// the first "</script" and treats "<!--" specially, so both are neutralized in a
// way that leaves the JavaScript meaning unchanged.
export function inlineScript(js) {
  return String(js).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
}

// A JSON value embedded in inline JavaScript: every character the HTML parser
// could act on becomes a \u escape, which is still valid JSON and JavaScript.
export function jsonForScript(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

// Text for element content or a quoted attribute value.
export function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

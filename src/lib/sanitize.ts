import "server-only";
import sanitizeHtml from "sanitize-html";

/** Mantém apenas a marcação produzida pelo editor de notas explicativas. */
export function sanitizeNoteHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "h1", "h2", "h3", "strong", "b", "em", "i", "u", "s", "sub", "sup", "code", "pre",
      "blockquote", "ul", "ol", "li", "hr", "a", "span", "mark", "img",
      "table", "colgroup", "col", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      "*": ["style"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title"],
      mark: ["data-color", "style"],
      td: ["colspan", "rowspan", "colwidth", "style"],
      th: ["colspan", "rowspan", "colwidth", "style"],
      col: ["style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i],
        "text-align": [/^(left|right|center|justify)$/],
        "font-family": [/^[\w\s,'"()-]+$/],
        "font-size": [/^\d+(px|pt|em|rem)$/],
        width: [/^\d+(px|%)$/],
        "min-width": [/^\d+(px|%)$/],
      },
    },
  });
}

// Petits utilitaires DOM de l'interface « Studio » (sans framework).

type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number | boolean | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    if (name === 'class') element.className = String(value);
    else if (name === 'text') element.textContent = String(value);
    else element.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children)
    if (child !== null && child !== undefined && child !== false) element.append(child);
  return element;
}

const SVG_ICONS = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  sliders:
    '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.4"/><path d="M12 17h.01"/>',
  keyboard:
    '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8"/>',
} as const;

export type IconName = keyof typeof SVG_ICONS;

export function icon(name: IconName, size = 17, strokeWidth = 2): SVGSVGElement {
  const template = document.createElement('template');
  template.innerHTML = `<svg width="${String(size)}" height="${String(size)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${String(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG_ICONS[name]}</svg>`;
  return template.content.firstElementChild as SVGSVGElement;
}

/** Logo : deux moitiés et leurs pouces. */
export function brandMark(size = 22): SVGSVGElement {
  const template = document.createElement('template');
  template.innerHTML = `<svg width="${String(size)}" height="${String(size)}" viewBox="0 0 24 24" aria-hidden="true" class="mark"><rect x="2" y="5" width="8.5" height="12" rx="2.6" fill="currentColor"/><rect x="13.5" y="5" width="8.5" height="12" rx="2.6" fill="currentColor" opacity=".45"/><rect x="6.5" y="15" width="4" height="4" rx="1.4" fill="currentColor" transform="rotate(20 8.5 17)"/><rect x="13.5" y="15" width="4" height="4" rx="1.4" fill="currentColor" opacity=".45" transform="rotate(-20 15.5 17)"/></svg>`;
  return template.content.firstElementChild as SVGSVGElement;
}

/** Comparaison sans accents ni casse. */
export const fold = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

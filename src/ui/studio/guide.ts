// Guide intégré : les principales modifications pas à pas (touches, appui et maintien, tap-dance, couches,
// combos, macros, lumière, essai et sauvegarde). Un exemple cliqué se place dans « Keycode avancé ».
import { t, type MessageKey } from '../../i18n';
import { h, icon } from './dom';

export type GuideTopic =
  'keys' | 'shortcuts' | 'hold' | 'tapDance' | 'layers' | 'combos' | 'macros' | 'light' | 'try';
export type GuideTab = 'keys' | 'light' | 'dynamic' | 'try';

interface Example {
  readonly code: string;
  readonly text: MessageKey;
}

interface Topic {
  readonly id: GuideTopic;
  readonly title: MessageKey;
  /** Keycodes concernés, affichés à côté du titre. */
  readonly tag?: string;
  readonly intro: MessageKey;
  readonly steps: readonly MessageKey[];
  readonly examples?: readonly Example[];
  readonly note?: MessageKey;
  readonly tab?: GuideTab;
}

const TOPICS: readonly Topic[] = [
  {
    id: 'keys',
    title: 'guide.keys.title',
    intro: 'guide.keys.intro',
    steps: ['guide.keys.s1', 'guide.keys.s2', 'guide.keys.s3'],
    note: 'guide.keys.note',
  },
  {
    id: 'shortcuts',
    title: 'guide.shortcuts.title',
    tag: 'LCTL(kc)…',
    intro: 'guide.shortcuts.intro',
    steps: ['guide.shortcuts.s1', 'guide.shortcuts.s2'],
    examples: [
      { code: 'LCTL(KC_TAB)', text: 'guide.shortcuts.ex1' },
      { code: 'LSFT(KC_1)', text: 'guide.shortcuts.ex2' },
      { code: 'LCTL(LSFT(KC_ESC))', text: 'guide.shortcuts.ex3' },
      { code: 'RALT(KC_0)', text: 'guide.shortcuts.ex4' },
    ],
    note: 'guide.shortcuts.note',
  },
  {
    id: 'hold',
    title: 'guide.hold.title',
    tag: 'LT · MT',
    intro: 'guide.hold.intro',
    steps: ['guide.hold.s1', 'guide.hold.s2', 'guide.hold.s3'],
    examples: [
      { code: 'LT(1, KC_SPC)', text: 'guide.hold.ex1' },
      { code: 'LCTL_T(KC_ESC)', text: 'guide.hold.ex2' },
      { code: 'LSFT_T(KC_ENT)', text: 'guide.hold.ex3' },
      { code: 'MT(MOD_LCTL | MOD_LSFT, KC_TAB)', text: 'guide.hold.ex4' },
    ],
    note: 'guide.hold.note',
  },
  {
    id: 'tapDance',
    title: 'guide.tapDance.title',
    tag: 'TD(n)',
    intro: 'guide.tapDance.intro',
    steps: ['guide.tapDance.s1', 'guide.tapDance.s2', 'guide.tapDance.s3'],
    note: 'guide.tapDance.note',
    tab: 'dynamic',
  },
  {
    id: 'layers',
    title: 'guide.layers.title',
    tag: 'MO · TO · TG · OSL',
    intro: 'guide.layers.intro',
    steps: [],
    examples: [
      { code: 'MO(1)', text: 'guide.layers.ex1' },
      { code: 'TO(2)', text: 'guide.layers.ex2' },
      { code: 'TG(3)', text: 'guide.layers.ex3' },
      { code: 'OSL(1)', text: 'guide.layers.ex4' },
    ],
    note: 'guide.layers.note',
  },
  {
    id: 'combos',
    title: 'guide.combos.title',
    intro: 'guide.combos.intro',
    steps: ['guide.combos.s1', 'guide.combos.s2'],
    note: 'guide.combos.note',
    tab: 'dynamic',
  },
  {
    id: 'macros',
    title: 'guide.macros.title',
    tag: 'M(n)',
    intro: 'guide.macros.intro',
    steps: ['guide.macros.s1', 'guide.macros.s2', 'guide.macros.s3'],
    tab: 'dynamic',
  },
  {
    id: 'light',
    title: 'guide.light.title',
    intro: 'guide.light.intro',
    steps: ['guide.light.s1', 'guide.light.s2', 'guide.light.s3'],
    tab: 'light',
  },
  {
    id: 'try',
    title: 'guide.try.title',
    intro: 'guide.try.intro',
    steps: ['guide.try.s1', 'guide.try.s2'],
    tab: 'try',
  },
];

const TAB_LABEL: Record<GuideTab, MessageKey> = {
  keys: 'guide.goKeys',
  light: 'guide.goLight',
  dynamic: 'guide.goDynamic',
  try: 'guide.goTry',
};

/** Keycodes des exemples (vérifiés par les tests : ils doivent se lire dans « Keycode avancé »). */
export const GUIDE_EXAMPLES: readonly string[] = TOPICS.flatMap((topic) =>
  (topic.examples ?? []).map((example) => example.code),
);

/** Rubriques, pour la palette de commandes. */
export function guideTopics(): { readonly id: GuideTopic; readonly title: string }[] {
  return TOPICS.map((topic) => ({ id: topic.id, title: t(topic.title) }));
}

export interface GuideOptions {
  /** Place un keycode dans « Keycode avancé » (onglet Touches) ; Appliquer l'affecte à la touche choisie. */
  readonly onUseCode: (code: string) => void;
  readonly onOpenTab: (tab: GuideTab) => void;
  /** Phrase propre au clavier connecté, ajoutée à la rubrique des couches (raccourci « trois appuis »). */
  readonly layersExtra?: () => string | undefined;
}

export class Guide {
  readonly element: HTMLElement;
  private readonly topics = new Map<GuideTopic, HTMLDetailsElement>();
  private readonly layersExtra = h('p', { class: 'gnote', hidden: true });

  constructor(private readonly options: GuideOptions) {
    const close = h('button', {
      class: 'btn primary',
      type: 'button',
      id: 'guide-close',
      text: t('guide.close'),
    });
    close.addEventListener('click', () => {
      this.close();
    });
    this.element = h(
      'div',
      { class: 'scrim', id: 'guide', hidden: true },
      h(
        'div',
        {
          class: 'sheet glass guide',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'guide-title',
        },
        h('h2', { id: 'guide-title', text: t('guide.title') }),
        h('p', { text: t('guide.intro') }),
        h('div', { class: 'guide-list' }, ...TOPICS.map((topic) => this.renderTopic(topic))),
        h('div', { class: 'btns' }, close),
      ),
    );
    this.element.addEventListener('pointerdown', (event) => {
      if (event.target === this.element) this.close();
    });
  }

  get open(): boolean {
    return !this.element.hidden;
  }

  /** Ouvre le guide, sur une rubrique dépliée si `topic` est donné. */
  show(topic?: GuideTopic): void {
    const extra = this.options.layersExtra?.();
    this.layersExtra.textContent = extra ?? '';
    this.layersExtra.hidden = !extra;
    this.element.hidden = false;
    if (topic) for (const [id, details] of this.topics) details.open = id === topic;
    const target = topic ? this.topics.get(topic) : undefined;
    target?.scrollIntoView({ block: 'nearest' });
    (target ?? this.element).querySelector<HTMLElement>('summary')?.focus();
  }

  close(): void {
    this.element.hidden = true;
  }

  private renderTopic(topic: Topic): HTMLDetailsElement {
    const body = h('div', { class: 'gbody' }, h('p', { text: t(topic.intro) }));
    if (topic.steps.length)
      body.append(h('ol', {}, ...topic.steps.map((step) => h('li', { text: t(step) }))));
    if (topic.examples)
      body.append(
        h(
          'div',
          { class: 'gex' },
          ...topic.examples.map((example) => {
            const use = h(
              'button',
              {
                type: 'button',
                class: 'gcode',
                'aria-label': t('guide.useCode', { code: example.code }),
                title: t('guide.useCode', { code: example.code }),
              },
              example.code,
            );
            use.addEventListener('click', () => {
              this.close();
              this.options.onUseCode(example.code);
            });
            return h('div', { class: 'gex-row' }, use, h('span', { text: t(example.text) }));
          }),
        ),
      );
    if (topic.id === 'layers') body.append(this.layersExtra);
    if (topic.note) body.append(h('p', { class: 'gnote', text: t(topic.note) }));
    const tab = topic.tab;
    if (tab) {
      const go = h('button', { class: 'btn', type: 'button', text: t(TAB_LABEL[tab]) });
      go.addEventListener('click', () => {
        this.close();
        this.options.onOpenTab(tab);
      });
      body.append(go);
    }
    const details = h(
      'details',
      { class: 'gtopic', id: `guide-${topic.id}` },
      h(
        'summary',
        {},
        h('span', { text: t(topic.title) }),
        topic.tag ? h('small', { text: topic.tag }) : null,
        icon('chevron', 14, 2.2),
      ),
      body,
    );
    this.topics.set(topic.id, details);
    return details;
  }
}

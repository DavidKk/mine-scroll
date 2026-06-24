import { wrapWithCustomScrollbar } from './custom-scrollbar.ts';

export type GameLogKind = 'ai' | 'player' | 'scroll' | 'danger' | 'system';

export interface GameLogController {
  append(text: string, kind?: GameLogKind): void;
  clear(): void;
}

function clipSelectionToElement(el: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return '';

  const range = sel.getRangeAt(0);
  const node = range.commonAncestorContainer;
  if (!el.contains(node.nodeType === Node.TEXT_NODE ? node.parentNode : node)) return '';

  const bounds = document.createRange();
  bounds.selectNodeContents(el);

  const clipped = document.createRange();
  try {
    if (range.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) {
      clipped.setStart(bounds.startContainer, bounds.startOffset);
    } else {
      clipped.setStart(range.startContainer, range.startOffset);
    }
    if (range.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) {
      clipped.setEnd(bounds.endContainer, bounds.endOffset);
    } else {
      clipped.setEnd(range.endContainer, range.endOffset);
    }
    return clipped.toString();
  } catch {
    return range.toString();
  }
}

function collectLogText(list: HTMLElement): string {
  return [...list.querySelectorAll('.game-log__entry')]
    .map((entry) => {
      const time = entry.querySelector('.game-log__time')?.textContent ?? '';
      const text = entry.querySelector('.game-log__text')?.textContent ?? '';
      return `${time} ${text}`.trimEnd();
    })
    .join('\n');
}

function nodeInElement(node: Node, el: HTMLElement): boolean {
  const target = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  return Boolean(target && el.contains(target));
}

export function createGameLog(container: HTMLElement, maxEntries = 1000): GameLogController {
  const panel = document.createElement('div');
  panel.className = 'game-log';

  const header = document.createElement('div');
  header.className = 'game-log__header';

  const title = document.createElement('span');
  title.className = 'game-log__title';
  title.textContent = 'Match Log';

  const actions = document.createElement('div');
  actions.className = 'game-log__actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'game-log__action';
  copyBtn.textContent = 'COPY';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'game-log__action';
  clearBtn.textContent = 'Clear';

  actions.append(copyBtn, clearBtn);
  header.append(title, actions);

  const live = document.createElement('div');
  live.className = 'game-log__sr';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'false');

  const list = document.createElement('div');
  list.className = 'game-log__list';
  list.tabIndex = 0;
  list.setAttribute('role', 'textbox');
  list.setAttribute('aria-readonly', 'true');
  list.setAttribute('aria-multiline', 'true');
  list.setAttribute('aria-label', 'Match log entries');

  panel.append(header, list, live);
  container.append(panel);

  wrapWithCustomScrollbar(list, 'scroll-host--log');

  list.parentElement?.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    list.focus({ preventScroll: true });
  });

  function selectAllInList(): void {
    list.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(list);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function clampSelectionToList(): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const startIn = nodeInElement(range.startContainer, list);
    const endIn = nodeInElement(range.endContainer, list);
    if (!startIn && !endIn) return;

    const bounds = document.createRange();
    bounds.selectNodeContents(list);

    const needsClamp =
      !startIn ||
      !endIn ||
      range.compareBoundaryPoints(Range.START_TO_START, bounds) < 0 ||
      range.compareBoundaryPoints(Range.END_TO_END, bounds) > 0;

    if (!needsClamp) return;

    const clipped = document.createRange();
    try {
      if (!startIn || range.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) {
        clipped.setStart(bounds.startContainer, bounds.startOffset);
      } else {
        clipped.setStart(range.startContainer, range.startOffset);
      }
      if (!endIn || range.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) {
        clipped.setEnd(bounds.endContainer, bounds.endOffset);
      } else {
        clipped.setEnd(range.endContainer, range.endOffset);
      }
      sel.removeAllRanges();
      sel.addRange(clipped);
    } catch {
      sel.removeAllRanges();
      sel.addRange(bounds);
    }
  }

  list.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    list.focus({ preventScroll: true });
  });

  list.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return;
    event.preventDefault();
    event.stopPropagation();
    selectAllInList();
  });

  document.addEventListener('selectionchange', clampSelectionToList);

  list.addEventListener('copy', (event) => {
    if (document.activeElement !== list) return;
    const text = clipSelectionToElement(list);
    if (!text) return;
    event.preventDefault();
    event.clipboardData?.setData('text/plain', text);
  });

  async function copyLog(): Promise<void> {
    const text = collectLogText(list);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied';
      window.setTimeout(() => {
        copyBtn.textContent = 'COPY';
      }, 1200);
    } catch {
      copyBtn.textContent = 'Failed';
      window.setTimeout(() => {
        copyBtn.textContent = 'COPY';
      }, 1200);
    }
  }

  function append(text: string, kind: GameLogKind = 'system'): void {
    const line = document.createElement('div');
    line.className = `game-log__entry game-log__entry--${kind}`;

    const time = document.createElement('time');
    time.className = 'game-log__time';
    time.textContent = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const msg = document.createElement('span');
    msg.className = 'game-log__text';
    msg.textContent = text;

    line.append(time, msg);
    list.append(line);
    live.textContent = text;

    while (list.children.length > maxEntries) {
      list.firstChild?.remove();
    }

    list.scrollTop = list.scrollHeight;
  }

  function clear(): void {
    list.replaceChildren();
    live.textContent = '';
  }

  copyBtn.addEventListener('click', () => {
    void copyLog();
  });
  clearBtn.addEventListener('click', clear);

  return { append, clear };
}

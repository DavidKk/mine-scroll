/** 2px indicator scrollbar: not draggable, position only. */
export function attachCustomScrollbar(
  view: HTMLElement,
  indicator: HTMLElement,
  thumb: HTMLElement,
): () => void {
  function update(): void {
    const { scrollTop, scrollHeight, clientHeight } = view;
    if (scrollHeight <= clientHeight + 1) {
      indicator.classList.add('scroll-indicator--hidden');
      return;
    }
    indicator.classList.remove('scroll-indicator--hidden');
    const track = clientHeight;
    const thumbH = Math.max(12, track * (clientHeight / scrollHeight));
    const maxScroll = scrollHeight - clientHeight;
    const top = maxScroll > 0 ? (scrollTop / maxScroll) * (track - thumbH) : 0;
    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translateY(${top}px)`;
  }

  view.addEventListener('scroll', update, { passive: true });
  const ro = new ResizeObserver(update);
  ro.observe(view);
  update();

  return () => {
    view.removeEventListener('scroll', update);
    ro.disconnect();
  };
}

/** Wrap a scrollable region and mount the custom scrollbar. */
export function wrapWithCustomScrollbar(el: HTMLElement, hostClass = ''): () => void {
  if (el.parentElement?.classList.contains('scroll-host')) {
    const indicator = el.parentElement.querySelector('.scroll-indicator');
    const thumb = el.parentElement.querySelector('.scroll-indicator__thumb');
    if (indicator instanceof HTMLElement && thumb instanceof HTMLElement) {
      return attachCustomScrollbar(el, indicator, thumb);
    }
  }

  const host = document.createElement('div');
  host.className = hostClass ? `scroll-host ${hostClass}` : 'scroll-host';

  const indicator = document.createElement('div');
  indicator.className = 'scroll-indicator';
  indicator.setAttribute('aria-hidden', 'true');

  const thumb = document.createElement('div');
  thumb.className = 'scroll-indicator__thumb';
  indicator.append(thumb);

  el.classList.add('scroll-view');
  el.parentNode?.insertBefore(host, el);
  host.append(el, indicator);

  return attachCustomScrollbar(el, indicator, thumb);
}

/** Page-level scroll indicator (html/body). */
export function attachPageScrollbar(): () => void {
  const indicator = document.createElement('div');
  indicator.className = 'scroll-indicator scroll-indicator--page';
  indicator.setAttribute('aria-hidden', 'true');

  const thumb = document.createElement('div');
  thumb.className = 'scroll-indicator__thumb';
  indicator.append(thumb);
  document.body.append(indicator);

  function metrics(): { scrollTop: number; scrollHeight: number; clientHeight: number } {
    const el = document.documentElement;
    return {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    };
  }

  function update(): void {
    const { scrollTop, scrollHeight, clientHeight } = metrics();
    if (scrollHeight <= clientHeight + 1) {
      indicator.classList.add('scroll-indicator--hidden');
      return;
    }
    indicator.classList.remove('scroll-indicator--hidden');
    const track = clientHeight;
    const thumbH = Math.max(12, track * (clientHeight / scrollHeight));
    const maxScroll = scrollHeight - clientHeight;
    const top = maxScroll > 0 ? (scrollTop / maxScroll) * (track - thumbH) : 0;
    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translateY(${top}px)`;
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();

  return () => {
    window.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    indicator.remove();
  };
}

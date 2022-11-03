import { slidingWindows } from 'https://deno.land/std@0.159.0/collections/sliding_windows.ts';
import morphdom from 'https://esm.sh/morphdom@2.6.1?no-dts';

// const _log = Reflect.get(window, '_log');

function setKeybinds() {
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    switch (event.key) {
      case 'j':
        window.scrollBy({ top: 50 });
        break;
      case 'k':
        window.scrollBy({ top: -50 });
        break;
      case 'd':
        window.scrollBy({ top: window.innerHeight / 2 });
        break;
      case 'u':
        window.scrollBy({ top: -window.innerHeight / 2 });
        break;
      case 'g':
        window.scrollTo({ top: 0 });
        break;
      case 'G':
        window.scrollTo({ top: document.body.scrollHeight });
        break;
    }
  });
}

addEventListener('DOMContentLoaded', () => {
  const markdownBody = document.getElementById('markdown-body') as HTMLDivElement;
  const base = document.getElementById('base') as HTMLBaseElement;
  const peek = Reflect.get(window, 'peek');

  markdownBody.classList.add(peek.theme);

  setKeybinds();

  let source: { lcount: number };
  let blocks: HTMLElement[][];

  const decoder = new TextDecoder();
  const socket = new WebSocket(`ws://${peek.serverUrl}/`);

  socket.binaryType = 'arraybuffer';

  socket.onmessage = (event) => {
    const data = JSON.parse(decoder.decode(event.data));

    switch (data.action) {
      case 'show':
        onPreview(data);
        break;
      case 'scroll':
        onScroll(data);
        break;
      case 'base':
        base.href = data.base;
        break;
      default:
        break;
    }
  };

  const onPreview = (() => {
    const observer = new MutationObserver(() => {
      blocks = slidingWindows(Array.from(document.querySelectorAll('[data-line-begin]')), 2, {
        step: 1,
        partial: true,
      });
    });

    observer.observe(markdownBody, { childList: true });

    return (data: { html: string; lcount: number }) => {
      source = { lcount: data.lcount };
      morphdom(
        markdownBody,
        `<div>${data.html}</div>`,
        {
          childrenOnly: true,
          onBeforeElUpdated: (fromEl: HTMLElement, toEl: HTMLElement) => {
            if (fromEl.hasAttribute('open')) {
              toEl.setAttribute('open', 'true');
            }
            return !fromEl.isEqualNode(toEl);
          },
          getNodeKey: () => null,
        },
      );
    };
  })();

  const onScroll = (() => {
    function getBlockOnLine(line: number) {
      return blocks.findLast((block) => line >= Number(block[0].dataset.lineBegin));
    }

    function getOffset(elem: HTMLElement): number {
      let current: HTMLElement | null = elem;
      let top = 0;

      while (top === 0 && current) {
        top = current.getBoundingClientRect().top;
        current = current.parentElement;
      }

      return top + window.scrollY;
    }

    return (data: { line: number }) => {
      const block = getBlockOnLine(data.line) || blocks[0];
      const target = block[0];
      const next = target ? block[1] : blocks[0][0];

      const offsetBegin = target ? getOffset(target) : 0;
      const offsetEnd = next ? getOffset(next) : markdownBody.scrollHeight;

      const lineBegin = target ? Number(target.dataset.lineBegin) : 1;
      const lineEnd = next ? Number(next.dataset.lineBegin) : source.lcount + 1;

      const pixPerLine = (offsetEnd - offsetBegin) / (lineEnd - lineBegin);
      const scrollPix = (data.line - lineBegin) * pixPerLine;

      window.scroll({ top: offsetBegin + scrollPix - window.innerHeight / 2 + pixPerLine / 2 });
    };
  })();
});

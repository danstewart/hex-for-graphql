interface Props {
  /** 'x' = vertical bar (resizes widths), 'y' = horizontal bar (resizes heights) */
  axis: 'x' | 'y';
  /** Current size of the pane being resized (px), captured at drag start */
  size: number;
  min: number;
  max: number;
  onResize: (newSize: number) => void;
}

export function Resizer({ axis, size, min, max, onResize }: Props) {
  const isX = axis === 'x';

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const startPos = isX ? e.clientX : e.clientY;
    const startSize = size;

    function onMove(ev: MouseEvent) {
      const pos = isX ? ev.clientX : ev.clientY;
      // For x-axis: rightward = bigger sidebar. For y-axis: upward = bigger bottom panel.
      const delta = isX ? pos - startPos : startPos - pos;
      onResize(Math.max(min, Math.min(max, startSize + delta)));
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = isX ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div
      className={[
        'group shrink-0 relative z-10 flex items-center justify-center',
        isX ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
      ].join(' ')}
      onMouseDown={handleMouseDown}
    >
      {/* Thin visible line */}
      <div
        className={[
          isX ? 'w-px h-full' : 'h-px w-full',
          'bg-gray-700 group-hover:bg-indigo-500 transition-colors duration-100',
        ].join(' ')}
      />
    </div>
  );
}

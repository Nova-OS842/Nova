# Nova OS Window Resizing

Nova OS uses DOM elements as application windows, so resizing must be implemented separately from the browser's own `window.resize` event. The browser `resize` event concerns the browser viewport; it does not provide Windows-style resizing for a `<div>` app window. For app windows, Nova uses Pointer Events and pointer capture.

## 1. Give every app a common window element

Every app opened through `WindowManager.open()` receives the same structure:

```html
<article class="window">
  <header class="window-header">...</header>
  <div class="window-body">...</div>
</article>
```

Because resizing is attached to `.window`, every application automatically gets the same behavior.

## 2. Detect the edge or corner under the pointer

Use the window's `getBoundingClientRect()` and compare the pointer coordinates with a small border hit area:

```js
function resizeEdge(el, x, y) {
  const r = el.getBoundingClientRect();
  const margin = 9;
  let edge = '';

  if (y - r.top <= margin) edge += 'n';
  else if (r.bottom - y <= margin) edge += 's';

  if (x - r.left <= margin) edge += 'w';
  else if (r.right - x <= margin) edge += 'e';

  return edge;
}
```

This produces `e`, `w`, `n`, `s`, `ne`, `nw`, `se`, or `sw`.

## 3. Change the cursor only at the border

Do not put a large invisible resize element over the entire window. Set a `data-resize-edge` attribute and use CSS:

```css
.window[data-resize-edge="e"],
.window[data-resize-edge="e"] * { cursor: e-resize !important; }
```

Repeat for the other seven directions.

## 4. Start resizing before application content handles the click

Register the resize `pointerdown` listener in capture phase. This is important because an app may have buttons, iframes, editors, or other pointer handlers inside the window.

```js
document.addEventListener('pointerdown', event => {
  const el = event.target.closest?.('.window');
  if (!el) return;

  const edge = resizeEdge(el, event.clientX, event.clientY);
  if (!edge) return;

  event.preventDefault();
  event.stopPropagation();
  startResize(windowObject, event, edge);
}, true);
```

## 5. Calculate the new rectangle

Store the original rectangle and pointer position. East/south edges increase width/height. West/north edges also move the left/top position:

```js
const dx = event.clientX - startX;
const dy = event.clientY - startY;

if (edge.includes('e')) width = startWidth + dx;
if (edge.includes('s')) height = startHeight + dy;
if (edge.includes('w')) {
  width = startWidth - dx;
  left = startLeft + (startWidth - width);
}
if (edge.includes('n')) {
  height = startHeight - dy;
  top = startTop + (startHeight - height);
}
```

Always enforce minimum dimensions so an application cannot be resized to an unusable size.

## 6. Keep the drag alive with Pointer Capture

Pointer capture prevents the resize from breaking when the pointer leaves the thin border while the user is dragging:

```js
windowElement.setPointerCapture(event.pointerId);
```

Listen for `pointermove`, `pointerup`, and `pointercancel`, then release the capture when the operation ends.

Pointer Events are preferable here because they provide one input model for mouse, pen, and touch and support pointer capture. citeturn0search1turn0search5

## 7. Do not confuse app resizing with browser resizing

`window.resize` fires when the browser viewport changes. It should only be used to clamp/reposition Nova's app windows after the viewport itself changes. It is not the mechanism used to drag an app window's edge. citeturn0search0

## 8. Save the new size

When the pointer is released, read the window rectangle and save its `left`, `top`, `width`, and `height` through Nova's existing `Store` system. The next time the app opens, restore those values.

## 9. Games artwork must use `contain`

For game cards where the entire supplied game image needs to remain visible:

```css
.game-poster-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}
```

`cover` fills the card but crops artwork. `contain` preserves the entire image, with available background space around it when the source aspect ratio differs from the card.

## 10. Apply the system centrally

The important architectural rule is: **do not implement resizing separately inside Games, Movies, Settings, Chat, or other apps.** The `WindowManager` owns window movement, resizing, maximizing, minimizing, snapping, focus, and persistence. Apps only own their content.

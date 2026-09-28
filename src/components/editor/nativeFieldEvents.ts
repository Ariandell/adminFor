/** Keep Editor.js block shortcuts out of native form fields without breaking browser editing. */
export function protectNativeFields(wrapper: HTMLElement): void {
  const stopAtField = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('input, textarea, select, [contenteditable="true"]')) return;
    // Save is a page-level action, including when a quiz or image caption has focus.
    if (event instanceof KeyboardEvent && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') return;
    event.stopPropagation();
  };

  for (const eventName of ['keydown', 'keyup', 'keypress', 'paste', 'cut', 'copy']) {
    wrapper.addEventListener(eventName, stopAtField);
  }
}

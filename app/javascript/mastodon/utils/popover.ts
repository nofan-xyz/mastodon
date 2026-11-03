/** Native top-layer menus need a portal fallback in older browser engines. */
export function supportsNativePopover() {
  return (
    typeof HTMLElement !== 'undefined' &&
    typeof HTMLElement.prototype.showPopover === 'function' &&
    typeof HTMLElement.prototype.hidePopover === 'function'
  );
}

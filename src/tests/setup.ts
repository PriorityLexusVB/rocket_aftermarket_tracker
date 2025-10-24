// Vitest setup: provide light DOM globals if needed
// Optional: stub scrollIntoView in jsdom
if (!Element.prototype.scrollIntoView) {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  Element.prototype.scrollIntoView = function () {}
}

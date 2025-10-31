// Vitest setup: provide light DOM globals if needed
import { expect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

// Add testing-library jest-dom custom matchers
expect.extend(matchers)

// Optional: stub scrollIntoView in jsdom
if (!Element.prototype.scrollIntoView) {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  Element.prototype.scrollIntoView = function () {}
}

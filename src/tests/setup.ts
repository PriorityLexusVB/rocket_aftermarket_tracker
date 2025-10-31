// Vitest setup: provide light DOM globals if needed
import { expect, beforeAll } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

// Add testing-library jest-dom custom matchers
// e.g., toBeInTheDocument, toHaveTextContent, etc.
expect.extend(matchers)

// Ensure `import.meta.env` exists and set the V2 flag for all tests
beforeAll(() => {
  // Do not replace the whole env object; just ensure and set the flag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // @ts-ignore Vitest runs tests in ESM; import.meta is available at runtime
  const meta: any = import.meta
  meta.env = {
    ...(meta.env || {}),
    VITE_DEAL_FORM_V2: 'true',
  }
})

// Optional: stub scrollIntoView in DOM env
if (!Element.prototype.scrollIntoView) {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  Element.prototype.scrollIntoView = function () {}
}

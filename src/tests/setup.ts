// Vitest setup: provide light DOM globals if needed
import { expect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

// Add testing-library jest-dom custom matchers
<<<<<<< HEAD
expect.extend(matchers)

=======
// e.g., toBeInTheDocument, toHaveTextContent, etc.
expect.extend(matchers)
>>>>>>> b98c4d7 (feat(deal-form): enhance loaner handling and error management)
// Optional: stub scrollIntoView in jsdom
if (!Element.prototype.scrollIntoView) {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  Element.prototype.scrollIntoView = function () {}
}

import { createPortal } from 'react-dom'

const Portal = ({ children, container }) => {
  const target = container ?? document.body
  return createPortal(children, target)
}

export { Portal }

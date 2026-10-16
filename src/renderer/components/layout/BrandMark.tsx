import type { FC } from 'react'
import mark from '../../../../resources/icon.svg?url'
import darkMark from '../../../../resources/icon-dark.svg?url'

interface BrandMarkProps {
  size?: number
}

export const BrandMark: FC<BrandMarkProps> = ({ size = 24 }) => (
  <>
    <img
      src={mark}
      width={size}
      height={size}
      alt=""
      aria-hidden
      className="shrink-0 dark:hidden"
      draggable={false}
    />
    <img
      src={darkMark}
      width={size}
      height={size}
      alt=""
      aria-hidden
      className="hidden shrink-0 dark:block"
      draggable={false}
    />
  </>
)

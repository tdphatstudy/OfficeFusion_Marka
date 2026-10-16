import type { FC } from 'react'
import mark from '../../../../resources/icon.svg?url'

interface BrandMarkProps {
  size?: number
}

export const BrandMark: FC<BrandMarkProps> = ({ size = 28 }) => (
  <img
    src={mark}
    width={size}
    height={size}
    alt=""
    aria-hidden
    className="shrink-0"
    draggable={false}
  />
)

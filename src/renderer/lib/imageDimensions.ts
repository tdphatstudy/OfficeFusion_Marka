export function imageWidth(value: unknown): number | null {
  const width = Number(value)
  return Number.isInteger(width) && width >= 80 && width <= 2400 ? width : null
}

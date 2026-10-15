export function navigateToHeading(line: number, index: number): void {
  window.dispatchEvent(new CustomEvent('marka:navigate', { detail: { line, index } }))
}

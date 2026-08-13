export function getWebViewportScale(width: number, height: number): number {
  const viewportArea = Math.max(1, width) * Math.max(1, height);
  return Math.max(0.8, Math.min(1.6, Math.sqrt(viewportArea / (1200 * 675))));
}

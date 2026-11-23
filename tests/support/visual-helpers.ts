import type { Locator, Page } from '@playwright/test';
export const frozenTime = new Date('2026-11-08T11:30:00.000Z');
export async function freezeClock(page: Page) {
  await page.clock.setFixedTime(frozenTime);
}
export function rgbToHex(rgb: string) {
  const numbers = rgb.match(/\d+/g);
  if (!numbers || numbers.length < 3) throw new Error(`Invalid RGB: ${rgb}`);
  return `#${numbers
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`;
}
export async function fontFamily(locator: Locator) {
  return locator.evaluate((el) => getComputedStyle(el).fontFamily);
}
export async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element has no bounding box');
  return box;
}
export function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

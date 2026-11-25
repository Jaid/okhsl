import type {Channels} from '../src/main.ts'

import {expect, test} from 'bun:test'

import {okhslToSrgb, srgbToOkhsl} from '../src/conversion.ts'
import {bytes, fromHsl, fromRgb} from '../src/main.ts'

test('sRGB and standard HSL agree on the reference OkHSL primaries', () => {
  for (const [rgb, hue, picker] of [
    [[255, 0, 0], 0, [29, 100, 57]],
    [[0, 255, 0], 120, [142, 100, 84]],
    [[0, 0, 255], 240, [264, 100, 37]],
  ] satisfies Array<[Channels, number, Channels]>) {
    expect(fromRgb(rgb)).toEqual(picker)
    expect(fromHsl(hue, 100, 50)).toEqual(picker)
  }
})
test('all sRGB byte grays round-trip through neutral OkHSL', () => {
  for (let gray = 0; gray <= 255; gray++) {
    const [h, s, l] = srgbToOkhsl(gray, gray, gray)
    expect([h, s]).toEqual([0, 0])
    expect(okhslToSrgb(0.75, s, l).map(Math.round)).toEqual([gray, gray, gray])
  }
})
test('black and white remain stable at floating-point lightness limits', () => {
  for (const l of [0, Number.MIN_VALUE, 1e-300, 1e-100]) {
    expect(bytes(260, 100, l)).toEqual([0, 0, 0])
  }
  for (const l of [99.99999999999999, 100]) {
    expect(bytes(260, 100, l)).toEqual([255, 255, 255])
  }
  expect(fromRgb(Number.MIN_VALUE, 0, 0).every(Number.isFinite)).toBe(true)
  expect(fromHsl(44, 88, 100)).toEqual([0, 0, 100])
})
test('unquantized interior colors invert across the 80% saturation transition', () => {
  for (let hue = 0; hue < 360; hue += 13) {
    for (const s of [0.1, 0.79999, 0.8, 0.80001, 0.99]) {
      for (const l of [0.05, 0.5, 0.95]) {
        const [h, actualS, actualL] = srgbToOkhsl(...okhslToSrgb(hue / 360, s, l))
        const hueError = Math.abs(h * 360 - hue)
        expect(Math.min(hueError, 360 - hueError)).toBeLessThan(0.001)
        expect(actualS).toBeCloseTo(s, 4)
        expect(actualL).toBeCloseTo(l, 6)
      }
    }
  }
})
test('fully saturated colors land within one byte of an sRGB gamut edge', () => {
  for (let hue = 0; hue < 360; hue += 7) {
    for (const lightness of [1, 25, 50, 75, 99]) {
      const rgb = bytes(hue, 100, lightness)
      expect(rgb.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255)).toBe(true)
      expect(Math.min(Math.min(...rgb), 255 - Math.max(...rgb))).toBeLessThanOrEqual(1)
    }
  }
})

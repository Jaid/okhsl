import type {Channels, ChannelsWithAlpha} from '../src/main.ts'

import {describe, expect, test} from 'bun:test'

import {okhsl_to_srgb, srgb_to_okhsl} from '../src/conversion.ts'
import okhsl, {bytes, css, fromHex, fromHsl, fromRgb, hsl, okhsl as named} from '../src/main.ts'

describe('specified examples', () => {
  test('hex and CSS', () => {
    expect(okhsl(346, 86, 67)).toBe('f26bbc')
    expect(okhsl(497, 92, 67)).toBe('65bd37')
    expect(okhsl(213, 92, 67, 56)).toBe('1db6d08f')
    expect(okhsl.css(120, 100, 35)).toBe('#4b5900')
    expect(okhsl.css(115, 100, 89)).toBe('#de0')
    expect(okhsl.css(115, 100, 89, 100)).toBe('#de0')
  })
  test('tuples', () => {
    expect(okhsl.hsl(309, 76, 80)).toEqual([272, 75, 84])
    expect(okhsl.bytes(66, 93, 67)).toEqual([226, 141, 28])
    expect(okhsl.bytes(66, 93, 67, 120)).toEqual([226, 141, 28, 120])
    expect(okhsl.fromRgb(242, 107, 188)).toEqual([346, 86, 67])
    expect(okhsl.fromRgb(29, 182, 208, 56)).toEqual([213, 92, 67, 56])
    expect(okhsl.fromHsl(272, 75, 84)).toEqual([309, 76, 80])
    expect(okhsl.fromHsl(272, 75, 84, 42)).toEqual([309, 76, 80, 42])
  })
})
test('exports and tuple overloads', () => {
  expect(named).toBe(okhsl)
  const three: Channels = okhsl.bytes(0, 0, 0)
  const four: ChannelsWithAlpha = okhsl.fromRgb(0, 0, 0, 0)
  expect(three.length).toBe(3)
  expect(four.length).toBe(4)
  for (const optional of [0, undefined]) {
    const union: Channels | ChannelsWithAlpha = okhsl.fromHsl(0, 0, 0, optional)
    expect(union.length).toBe(optional === undefined ? 3 : 4)
  }
})
test('hues wrap in both directions', () => {
  for (const h of [-720, -360, 0, 360, 720]) {
    expect(okhsl(h + 137, 92, 67)).toBe('65bd37')
    expect(okhsl.fromHsl(h + 272, 75, 84)).toEqual([309, 76, 80])
  }
})
test('achromatic colors, black and white are stable', () => {
  for (let gray = 0; gray <= 255; gray++) {
    const [h, s, l] = okhsl.fromRgb(gray, gray, gray)
    expect([h, s]).toEqual([0, 0])
    expect(l).toBeGreaterThanOrEqual(0)
    expect(l).toBeLessThanOrEqual(100)
  }
  expect(okhsl.fromRgb(0, 0, 0)).toEqual([0, 0, 0])
  expect(okhsl.fromRgb(255, 255, 255)).toEqual([0, 0, 100])
  for (const h of [0, 60, 200, 359]) {
    expect(okhsl(h, 100, 0)).toBe('000000')
    expect(okhsl(h, 100, 100)).toBe('ffffff')
    expect(okhsl.hsl(h, 0, 50)).toEqual([0, 0, 47])
    expect(okhsl.hsl(h, 100, 100)).toEqual([0, 0, 100])
  }
})
test('alpha units, preservation and CSS shortening', () => {
  expect(okhsl(0, 0, 0, 0)).toBe('00000000')
  expect(okhsl(0, 0, 0, 100)).toBe('000000ff')
  expect(okhsl.css(0, 0, 0, 0)).toBe('#0000')
  expect(okhsl.css(0, 0, 0, 20)).toBe('#0003')
  expect(okhsl.css(0, 0, 0, 50)).toBe('#00000080')
  expect(okhsl.css(213, 92, 67, 56)).toBe('#1db6d08f')
  expect(okhsl.bytes(0, 0, 0, 120.5)).toEqual([0, 0, 0, 121])
  expect(okhsl.hsl(309, 76, 80, 42.5)).toEqual([272, 75, 84, 42.5])
  expect(okhsl.fromHsl(272, 75, 84, 42.5)).toEqual([309, 76, 80, 42.5])
  expect(okhsl.fromRgb(242, 107, 188, 0)).toEqual([346, 86, 67, 0])
  expect(okhsl.fromRgb(242, 107, 188, 56.7)).toEqual([346, 86, 67, 56.7])
  expect(okhsl.bytes(0, 0, 0)).toEqual([0, 0, 0])
})
test('finite out-of-range channels are clamped', () => {
  expect(okhsl(0, -1, -20, -1)).toBe('00000000')
  expect(okhsl(0, 120, 120, 120)).toBe('ffffffff')
  expect(okhsl(15, 120, 40)).toBe(okhsl(15, 100, 40))
  expect(okhsl.bytes(0, 0, 0, 300)).toEqual([0, 0, 0, 255])
  expect(okhsl.fromRgb(-1, 300, 0, 120)).toEqual([...okhsl.fromRgb(0, 255, 0), 100])
  expect(okhsl.fromHsl(0, -1, 120)).toEqual([0, 0, 100])
})
test('nonfinite and nonnumeric channels are rejected, even at endpoints', () => {
  for (const method of [okhsl, okhsl.css, okhsl.bytes, okhsl.hsl, okhsl.fromRgb, okhsl.fromHsl]) {
    for (const invalid of [Number.NaN, Infinity, -Infinity, '2', null, undefined]) {
      for (let index = 0; index < 4; index++) {
        if (index === 3 && invalid === undefined) {
          continue
        }
        const args: [number, number, number, number] = [0, 0, 0, 0]
        args[index] = invalid as number
        expect(() => method(...args)).toThrow(RangeError)
      }
    }
  }
})
test('dense gamut sweep produces bounded integer channels and valid hex', () => {
  for (let h = 0; h < 360; h += 3) {
    for (const s of [0, 1, 50, 79.999, 80, 80.001, 99, 100]) {
      for (const l of [0, 0.001, 1, 25, 50, 75, 99, 99.999, 100]) {
        const channels = okhsl.bytes(h, s, l)
        for (const c of channels) {
          expect(Number.isInteger(c)).toBe(true)
          expect(c).toBeGreaterThanOrEqual(0)
          expect(c).toBeLessThanOrEqual(255)
        }
        expect(okhsl(h, s, l)).toMatch(/^[0-9a-f]{6}$/)
        const inverse = okhsl.fromRgb(...channels)
        expect(inverse.every(Number.isInteger)).toBe(true)
        expect(inverse[0]).toBeGreaterThanOrEqual(0)
        expect(inverse[0]).toBeLessThan(360)
      }
    }
  }
})
test('unquantized interior round trips agree with the reference math', () => {
  for (let h = 0; h < 360; h += 7) {
    for (const s of [0.1, 0.5, 0.8, 0.95]) {
      for (const l of [0.1, 0.4, 0.7, 0.9]) {
        const [r, g, b] = okhsl_to_srgb(h / 360, s, l)
        const result = srgb_to_okhsl(r, g, b)
        const hueError = Math.abs(result[0] * 360 - h)
        expect(Math.min(hueError, 360 - hueError)).toBeLessThan(0.001)
        expect(result[1]).toBeCloseTo(s, 4)
        expect(result[2]).toBeCloseTo(l, 6)
      }
    }
  }
})
test('sRGB primaries have known rounded OkHSL values', () => {
  expect(okhsl.fromRgb(255, 0, 0)).toEqual([29, 100, 57])
  expect(okhsl.fromRgb(0, 255, 0)).toEqual([142, 100, 84])
  expect(okhsl.fromRgb(0, 0, 255)).toEqual([264, 100, 37])
})
test('extremely small finite channels do not produce NaN', () => {
  for (const tiny of [Number.MIN_VALUE, 1e-300, 1e-110, 1e-100, 1e-30]) {
    expect(okhsl(260, 100, tiny)).toBe('000000')
    expect(okhsl.fromRgb(tiny, 0, 0).every(Number.isFinite)).toBe(true)
  }
})
test('named exports are identical to attached methods', () => {
  expect(css).toBe(okhsl.css)
  expect(bytes).toBe(okhsl.bytes)
  expect(hsl).toBe(okhsl.hsl)
  expect(fromRgb).toBe(okhsl.fromRgb)
  expect(fromHsl).toBe(okhsl.fromHsl)
  expect(fromHex).toBe(okhsl.fromHex)
})
test('readonly tuples and objects are ergonomic inputs without ambiguous embedded alpha', () => {
  const okTuple = [346, 86, 67] as const
  const rgbTuple = [29, 182, 208] as const
  const hslTuple = [272, 75, 84] as const
  expect(okhsl(okTuple)).toBe('f26bbc')
  expect(okhsl(okTuple, 56)).toBe('f26bbc8f')
  expect(okhsl({
    h: 346,
    s: 86,
    l: 67,
  })).toBe('f26bbc')
  expect(okhsl.css({
    h: 115,
    s: 100,
    l: 89,
  })).toBe('#de0')
  expect(okhsl.bytes([66, 93, 67] as const, 120)).toEqual([226, 141, 28, 120])
  expect(okhsl.hsl({
    h: 309,
    s: 76,
    l: 80,
  }, 42.5)).toEqual([272, 75, 84, 42.5])
  expect(okhsl.fromRgb(rgbTuple, 56)).toEqual([213, 92, 67, 56])
  expect(okhsl.fromRgb({
    r: 242,
    g: 107,
    b: 188,
  })).toEqual([346, 86, 67])
  expect(okhsl.fromHsl(hslTuple)).toEqual([309, 76, 80])
  expect(okhsl.fromHsl({
    h: 272,
    s: 75,
    l: 84,
  }, 42)).toEqual([309, 76, 80, 42])
})
test('fromHex supports CSS hex forms and rejects malformed same-length strings', () => {
  expect(okhsl.fromHex('f26bbc')).toEqual([346, 86, 67])
  expect(okhsl.fromHex('#F26BBC')).toEqual([346, 86, 67])
  expect(okhsl.fromHex('#de0')).toEqual([115, 100, 89])
  expect(okhsl.fromHex('1db6d08f')).toEqual([213, 92, 67, 56])
  expect(okhsl.fromHex('#0000')).toEqual([0, 0, 0, 0])
  expect(okhsl.fromHex('#0003')).toEqual([0, 0, 0, 20])
  expect(okhsl.fromHex('#ffff')).toEqual([0, 0, 100, 100])
  for (const invalid of ['', '#12', '#12345', '#1234567', '#123456789', '#ggg', 'zzzzzz', '##fff', 'fff ']) {
    expect(() => okhsl.fromHex(invalid)).toThrow(TypeError)
  }
})

import type {Channels, ChannelsWithAlpha} from '../src/main.ts'

import {expect, expectTypeOf, test} from 'bun:test'

import okhsl, {bytes, css, fromHex, fromHsl, fromRgb, hsl, integer} from '../src/main.ts'

test('hex uses percentage alpha, bytes use byte alpha and RGB preserves percentage alpha', () => {
  const picker = [213, 92, 67] as const
  expect(okhsl(picker, 50)).toBe('1db6d080')
  expect(bytes(picker, 127.5)).toEqual([29, 182, 208, 128])
  expect(fromRgb({
    r: 29,
    g: 182,
    b: 208,
  }, 50.25)).toEqual([...picker, 50.25])
})
test('HSL conversions wrap hue and use unquantized sRGB', () => {
  expect(hsl({
    h: -51,
    s: 76,
    l: 80,
  }, 42.5)).toEqual([272, 75, 84, 42.5])
  expect(okhsl.fromHsl(272 + 720, 75, 84, 42.5)).toEqual([309, 76, 80, 42.5])
})
test('omitted HSL channels default independently to 0, 100 and 50', () => {
  expect(okhsl()).toBe(okhsl(0, 100, 50))
  expect(okhsl(213)).toBe('00869a')
  expect(css(undefined, 0)).toBe(css(0, 0, 50))
  expect(bytes([undefined, 0], 64)).toEqual([...bytes(0, 0, 50), 64])
  expect(okhsl(undefined, undefined, undefined, 50)).toBe('d7007180')
  expect(hsl({l: 0})).toEqual([0, 0, 0])
  expect(fromHsl()).toEqual(fromRgb(255, 0, 0))
  expect(fromHsl({h: 120}, 0)).toEqual(fromRgb(0, 255, 0, 0))
})
test('integer packs unsigned sRGB with optional trailing percentage alpha', () => {
  expect(integer(213, 92, 67)).toBe(0x1D_B6_D0)
  expect(okhsl.integer([346, 86, 67], 50)).toBe(0xF2_6B_BC_80)
  expect(integer([], 0)).toBe(0xD7_00_71_00)
  expect(integer({l: 100}, 100)).toBe(0xFF_FF_FF_FF)
})
test('CSS drops opaque alpha and shortens only exactly representable bytes', () => {
  const picker = [115, 100, 89] as const
  expect(okhsl(picker, 100)).toBe('ddee00ff')
  expect(css(picker, 100)).toBe('#de0')
  expect(css(picker, 20)).toBe('#de03')
  expect(css(picker, 50)).toBe('#ddee0080')
  expect(css(213, 92, 67, 0)).toBe('#1db6d000')
})
test('all four CSS hex widths decode with optional # and mixed case', () => {
  const picker = fromRgb(221, 238, 0)
  expect(fromHex('#dE0')).toEqual(picker)
  expect(fromHex('de0f')).toEqual([...picker, 100])
  expect(fromHex('DDEE00')).toEqual(picker)
  expect(fromHex('#DDee008f')).toEqual([...picker, 56])
})
test('hex rejects invalid digits, lengths, whitespace and nonstrings', () => {
  for (const value of ['', '#12', '#12345', '1234567', '123456789', '#ggg', '12345z', '##fff', 'fff ', null, 123]) {
    expect(() => {
      Reflect.apply(fromHex, undefined, [value])
    }).toThrow(TypeError)
  }
})
test('finite channels are clamped in their own units', () => {
  expect(okhsl(15, 120, 40)).toBe(okhsl(15, 100, 40))
  expect(okhsl.bytes(0, -1, 120, 300)).toEqual([255, 255, 255, 255])
  expect(fromRgb(-1, 300, 0, -20)).toEqual([...fromRgb(0, 255, 0), 0])
  expect(okhsl(0, 0, -1, 120)).toBe('000000ff')
})
test('invalid channels are rejected even when they would not affect the color', () => {
  for (const args of [[Number.NaN, 0, 0], [0, Infinity, 100], [0, 0, -Infinity], ['2', 0, 0], [null], [{s: null}], [[0, 0, 0, 50]]]) {
    expect(() => {
      Reflect.apply(okhsl, undefined, args)
    }).toThrow(RangeError)
  }
  expect(() => {
    Reflect.apply(fromRgb, undefined, [[10, 20], 30])
  }).toThrow(RangeError)
  for (const convert of [okhsl, bytes, hsl, integer, fromRgb, fromHsl]) {
    expect(() => convert(0, 0, 100, Infinity)).toThrow(RangeError)
  }
})
test('tuple widths follow the presence of alpha in JavaScript and TypeScript', () => {
  expectTypeOf(bytes()).toEqualTypeOf<Channels>()
  expectTypeOf(hsl({}, 0)).toEqualTypeOf<ChannelsWithAlpha>()
  for (const alpha of [0, undefined]) {
    const channels = fromRgb(0, 0, 0, alpha)
    expectTypeOf(channels).toEqualTypeOf<Channels | ChannelsWithAlpha>()
    expect(channels).toHaveLength(alpha === undefined ? 3 : 4)
  }
})

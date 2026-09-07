import {hsl_to_rgb, okhsl_to_srgb, rgb_to_hsl, srgb_to_okhsl} from './conversion.ts'

export type Channels = [number, number, number]
export type ChannelsWithAlpha = [number, number, number, number]

export type OkhslTuple = readonly [h: number, s: number, l: number]
export type RgbTuple = readonly [r: number, g: number, b: number]
export type HslTuple = readonly [h: number, s: number, l: number]

export type OkhslObject = Readonly<{
  h: number
  l: number
  s: number
}>
export type RgbObject = Readonly<{
  b: number
  g: number
  r: number
}>
export type HslObject = Readonly<{
  h: number
  l: number
  s: number
}>
export type OkhslInput = OkhslObject | OkhslTuple
export type RgbInput = RgbObject | RgbTuple
export type HslInput = HslObject | HslTuple

const invalidChannelMessage = 'Color channels must be finite numbers.'
function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(invalidChannelMessage)
  }
  return value
}
function clamp(value: unknown, max: number): number {
  return Math.min(max, Math.max(0, finite(value)))
}
function hue(value: unknown): number {
  const finiteValue = finite(value)
  return (finiteValue % 360 + 360) % 360
}
function unpackOkhsl(hOrInput: OkhslInput | number, sOrAlpha?: number, l?: number, alpha?: number): [number, number, number, number | undefined] {
  if (typeof hOrInput === 'number') {
    return [hOrInput, sOrAlpha as number, l as number, alpha]
  }
  if (Array.isArray(hOrInput)) {
    const input = hOrInput as OkhslTuple
    return [input[0], input[1], input[2], sOrAlpha]
  }
  const candidate: unknown = hOrInput
  if (candidate === null || typeof candidate !== 'object') {
    throw new RangeError(invalidChannelMessage)
  }
  const input = candidate as OkhslObject
  return [input.h, input.s, input.l, sOrAlpha]
}
function unpackRgb(rOrInput: RgbInput | number, gOrAlpha?: number, b?: number, alpha?: number): [number, number, number, number | undefined] {
  if (typeof rOrInput === 'number') {
    return [rOrInput, gOrAlpha as number, b as number, alpha]
  }
  if (Array.isArray(rOrInput)) {
    const input = rOrInput as RgbTuple
    return [input[0], input[1], input[2], gOrAlpha]
  }
  const candidate: unknown = rOrInput
  if (candidate === null || typeof candidate !== 'object') {
    throw new RangeError(invalidChannelMessage)
  }
  const input = candidate as RgbObject
  return [input.r, input.g, input.b, gOrAlpha]
}
function unpackHsl(hOrInput: HslInput | number, sOrAlpha?: number, l?: number, alpha?: number): [number, number, number, number | undefined] {
  if (typeof hOrInput === 'number') {
    return [hOrInput, sOrAlpha as number, l as number, alpha]
  }
  if (Array.isArray(hOrInput)) {
    const input = hOrInput as HslTuple
    return [input[0], input[1], input[2], sOrAlpha]
  }
  const candidate: unknown = hOrInput
  if (candidate === null || typeof candidate !== 'object') {
    throw new RangeError(invalidChannelMessage)
  }
  const input = candidate as HslObject
  return [input.h, input.s, input.l, sOrAlpha]
}
function rgb(h: unknown, s: unknown, l: unknown): [number, number, number] {
  return okhsl_to_srgb(hue(h) / 360, clamp(s, 100) / 100, clamp(l, 100) / 100)
    .map(channel => clamp(channel, 255)) as [number, number, number]
}
function appendAlpha(channels: Channels, alpha: number | undefined, max: number): Channels | ChannelsWithAlpha {
  return alpha === undefined ? channels : [...channels, clamp(alpha, max)]
}
function roundedHsl(channels: Array<number>): Channels {
  const roundedHue = Math.round(channels[0] * 360)
  return [(roundedHue % 360 + 360) % 360, Math.round(clamp(channels[1] * 100, 100)), Math.round(clamp(channels[2] * 100, 100))]
}
function hex(h: number, s: number, l: number, alpha?: number): string
function hex(input: OkhslInput, alpha?: number): string
function hex(hOrInput: OkhslInput | number, sOrAlpha?: number, l?: number, alpha?: number): string {
  const [h, s, lightness, a] = unpackOkhsl(hOrInput, sOrAlpha, l, alpha)
  const channels = rgb(h, s, lightness).map(Math.round) as Channels
  if (a !== undefined) {
    channels.push(Math.round(clamp(a, 100) * 255 / 100))
  }
  return channels.map(channel => channel.toString(16).padStart(2, '0')).join('')
}
function css(h: number, s: number, l: number, alpha?: number): string
function css(input: OkhslInput, alpha?: number): string
function css(hOrInput: OkhslInput | number, sOrAlpha?: number, l?: number, alpha?: number): string {
  let result = typeof hOrInput === 'number' ? hex(hOrInput, sOrAlpha as number, l as number, alpha) : hex(hOrInput, sOrAlpha)
  if (result.length === 8 && result.endsWith('ff')) {
    result = result.slice(0, 6)
  }
  const pairs = result.match(/.{2}/gu)!
  if (pairs.every(pair => new Set(pair).size === 1)) {
    result = pairs.map(pair => pair[0]).join('')
  }
  return `#${result}`
}
function bytes(h: number, s: number, l: number): Channels
function bytes(h: number, s: number, l: number, alphaByte: number): ChannelsWithAlpha
function bytes(h: number, s: number, l: number, alphaByte?: number): Channels | ChannelsWithAlpha
function bytes(input: OkhslInput): Channels
function bytes(input: OkhslInput, alphaByte: number): ChannelsWithAlpha
function bytes(input: OkhslInput, alphaByte?: number): Channels | ChannelsWithAlpha
function bytes(hOrInput: OkhslInput | number, sOrAlpha?: number, l?: number, alphaByte?: number): Channels | ChannelsWithAlpha {
  const [h, s, lightness, a] = unpackOkhsl(hOrInput, sOrAlpha, l, alphaByte)
  const channels = rgb(h, s, lightness).map(Math.round) as Channels
  return a === undefined ? channels : [...channels, Math.round(clamp(a, 255))]
}
function hsl(h: number, s: number, l: number): Channels
function hsl(h: number, s: number, l: number, alpha: number): ChannelsWithAlpha
function hsl(h: number, s: number, l: number, alpha?: number): Channels | ChannelsWithAlpha
function hsl(input: OkhslInput): Channels
function hsl(input: OkhslInput, alpha: number): ChannelsWithAlpha
function hsl(input: OkhslInput, alpha?: number): Channels | ChannelsWithAlpha
function hsl(hOrInput: OkhslInput | number, sOrAlpha?: number, l?: number, alpha?: number): Channels | ChannelsWithAlpha {
  const [h, s, lightness, a] = unpackOkhsl(hOrInput, sOrAlpha, l, alpha)
  const [r, g, b] = rgb(h, s, lightness)
  return appendAlpha(roundedHsl(rgb_to_hsl(r, g, b)), a, 100)
}
function fromRgb(r: number, g: number, b: number): Channels
function fromRgb(r: number, g: number, b: number, alpha: number): ChannelsWithAlpha
function fromRgb(r: number, g: number, b: number, alpha?: number): Channels | ChannelsWithAlpha
function fromRgb(input: RgbInput): Channels
function fromRgb(input: RgbInput, alpha: number): ChannelsWithAlpha
function fromRgb(input: RgbInput, alpha?: number): Channels | ChannelsWithAlpha
function fromRgb(rOrInput: RgbInput | number, gOrAlpha?: number, b?: number, alpha?: number): Channels | ChannelsWithAlpha {
  const [r, g, blue, a] = unpackRgb(rOrInput, gOrAlpha, b, alpha)
  const result = roundedHsl(srgb_to_okhsl(clamp(r, 255), clamp(g, 255), clamp(blue, 255)))
  return appendAlpha(result, a, 100)
}
function fromHsl(h: number, s: number, l: number): Channels
function fromHsl(h: number, s: number, l: number, alpha: number): ChannelsWithAlpha
function fromHsl(h: number, s: number, l: number, alpha?: number): Channels | ChannelsWithAlpha
function fromHsl(input: HslInput): Channels
function fromHsl(input: HslInput, alpha: number): ChannelsWithAlpha
function fromHsl(input: HslInput, alpha?: number): Channels | ChannelsWithAlpha
function fromHsl(hOrInput: HslInput | number, sOrAlpha?: number, l?: number, alpha?: number): Channels | ChannelsWithAlpha {
  const [h, s, lightness, a] = unpackHsl(hOrInput, sOrAlpha, l, alpha)
  const [r, g, b] = hsl_to_rgb(hue(h) / 360, clamp(s, 100) / 100, clamp(lightness, 100) / 100)
  return appendAlpha(roundedHsl(srgb_to_okhsl(r, g, b)), a, 100)
}
function fromHex(value: string): Channels | ChannelsWithAlpha {
  if (typeof value !== 'string') {
    throw new TypeError('Hex color must be a string.')
  }
  const match = /^(?:#)?([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/iu.exec(value)
  if (!match) {
    throw new TypeError(`Invalid hex color: ${JSON.stringify(value)}`)
  }
  const compact = match[1].toLowerCase()
  const expanded = compact.length <= 4 ? [...compact].map(character => character + character).join('') : compact
  const r = Number.parseInt(expanded.slice(0, 2), 16)
  const g = Number.parseInt(expanded.slice(2, 4), 16)
  const b = Number.parseInt(expanded.slice(4, 6), 16)
  if (expanded.length === 6) {
    return fromRgb(r, g, b)
  }
  const alphaByte = Number.parseInt(expanded.slice(6, 8), 16)
  return fromRgb(r, g, b, Math.round(alphaByte * 100 / 255))
}
const okhsl = Object.assign(hex, {
  css,
  bytes,
  hsl,
  fromRgb,
  fromHsl,
  fromHex,
})

export {bytes, css, fromHex, fromHsl, fromRgb, hsl, okhsl}
export default okhsl

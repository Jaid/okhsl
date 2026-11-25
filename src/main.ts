import {hslToRgb, okhslToSrgb, rgbToHsl, srgbToOkhsl} from './conversion.ts'

export type Channels = [number, number, number]
export type ChannelsWithAlpha = [...Channels, alpha: number]

export type HslTuple = readonly [h?: OptionalChannel, s?: OptionalChannel, l?: OptionalChannel]
export type HslObject = Readonly<{
  h?: OptionalChannel
  l?: OptionalChannel
  s?: OptionalChannel
}>
export type HslInput = HslObject | HslTuple

export type OkhslTuple = HslTuple
export type OkhslObject = HslObject
export type OkhslInput = HslInput

export type RgbTuple = readonly [r: number, g: number, b: number]
export type RgbObject = Readonly<{
  b: number
  g: number
  r: number
}>
export type RgbInput = RgbObject | RgbTuple

type OptionalChannel = number | undefined
type AlphaArgument = [alpha?: OptionalChannel]
type Unpacked = [...Channels, ...AlphaArgument]
type InputTuple<Input> = Extract<Input, ReadonlyArray<unknown>>
type ColorArgs<Input> = [...InputTuple<Input>, ...AlphaArgument] | [input: Input, ...AlphaArgument]
type HslArgs = ColorArgs<HslInput>
type RgbArgs = ColorArgs<RgbInput>

const invalidChannelMessage = 'Color channels must be finite numbers.'
function finite(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(invalidChannelMessage)
  }
  return value
}
function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, finite(value)))
}
function hueTurns(value: number): number {
  const remainder = finite(value) % 360
  return (remainder < 0 ? remainder + 360 : remainder) / 360
}
function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}
function isChannelTuple<Input extends object>(input: Input): input is InputTuple<Input> {
  if (!Array.isArray(input)) {
    return false
  }
  if (input.length > 3) {
    throw new RangeError('Color tuples accept at most three channels. Pass alpha separately.')
  }
  return true
}
function withHslDefaults(h = 0, s = 100, l = 50, alpha?: number): Unpacked {
  return [h, s, l, alpha]
}
function unpackHsl(args: HslArgs): Unpacked {
  if (args.length === 3 || args.length === 4) {
    return withHslDefaults(...args)
  }
  const [input, second] = args
  if (!isObject(input)) {
    return withHslDefaults(input, second)
  }
  const [h, s, l] = isChannelTuple(input) ? input : [input.h, input.s, input.l]
  return withHslDefaults(h, s, l, second)
}
function unpackRgb(args: RgbArgs): Unpacked {
  if (args.length === 3 || args.length === 4) {
    return args
  }
  const [input, alpha] = args
  if (!isObject(input)) {
    throw new RangeError(invalidChannelMessage)
  }
  const [r, g, b] = isChannelTuple(input) ? input : [input.r, input.g, input.b]
  return [r, g, b, alpha]
}
function tupleConverter<Input extends object>(unpack: (args: ColorArgs<Input>) => Unpacked, convert: (...channels: Channels) => Channels, convertAlpha = (alpha: number) => clamp(alpha, 100)) {
  function convertInput(...args: [...InputTuple<Input>, alpha?: undefined]): Channels
  function convertInput(...args: [...InputTuple<Input>, alpha: number]): ChannelsWithAlpha
  function convertInput(...args: [...InputTuple<Input>, ...AlphaArgument]): Channels | ChannelsWithAlpha
  function convertInput(input: Input, alpha?: undefined): Channels
  function convertInput(input: Input, alpha: number): ChannelsWithAlpha
  function convertInput(...args: ColorArgs<Input>): Channels | ChannelsWithAlpha
  function convertInput(...args: ColorArgs<Input>): Channels | ChannelsWithAlpha {
    const [first, second, third, alpha] = unpack(args)
    const channels = convert(first, second, third)
    return alpha === undefined ? channels : [...channels, convertAlpha(alpha)]
  }
  return convertInput
}
function rgb(h: number, s: number, l: number): Channels {
  const [r, g, b] = okhslToSrgb(hueTurns(h), clamp(s, 100) / 100, clamp(l, 100) / 100)
  return [clamp(r, 255), clamp(g, 255), clamp(b, 255)]
}
function rgbBytes(h: number, s: number, l: number): Channels {
  const [r, g, b] = rgb(h, s, l)
  return [Math.round(r), Math.round(g), Math.round(b)]
}
function roundedHsl([h, s, l]: Channels): Channels {
  return [Math.round(h * 360) % 360, Math.round(clamp(s * 100, 100)), Math.round(clamp(l * 100, 100))]
}
function hex(...args: HslArgs): string {
  const [h, s, l, alpha] = unpackHsl(args)
  const channels = rgbBytes(h, s, l)
  return Uint8Array.from(alpha === undefined ? channels : [...channels, Math.round(clamp(alpha, 100) * 255 / 100)]).toHex()
}
function css(...args: HslArgs): string {
  let value = hex(...args)
  if (value.length === 8 && value.endsWith('ff')) {
    value = value.slice(0, 6)
  }
  return `#${value.replace(/^(.)\1(.)\2(.)\3(?:(.)\4)?$/u, '$1$2$3$4')}`
}
const bytes = tupleConverter(unpackHsl, rgbBytes, alphaByte => Math.round(clamp(alphaByte, 255)))
const hsl = tupleConverter(unpackHsl, (h, s, l) => roundedHsl(rgbToHsl(...rgb(h, s, l))))
const fromRgb = tupleConverter(unpackRgb, (r, g, b) => roundedHsl(srgbToOkhsl(clamp(r, 255), clamp(g, 255), clamp(b, 255))))
const fromHsl = tupleConverter(unpackHsl, (h, s, l) => {
  const channels = hslToRgb(hueTurns(h), clamp(s, 100) / 100, clamp(l, 100) / 100)
  return roundedHsl(srgbToOkhsl(...channels))
})
function fromHex(value: string): Channels | ChannelsWithAlpha {
  if (typeof value !== 'string') {
    throw new TypeError('Hex color must be a string.')
  }
  const match = /^#?([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/iu.exec(value)
  if (!match) {
    throw new TypeError(`Invalid hex color: ${JSON.stringify(value)}`)
  }
  const digits = match[1]
  const channels = Uint8Array.fromHex(digits.length <= 4 ? digits.replaceAll(/./gu, '$&$&') : digits)
  const [r, g, b] = channels
  return fromRgb(r, g, b, channels.length === 4 ? Math.round(channels[3] * 100 / 255) : undefined)
}
const okhsl = Object.assign(hex, {
  bytes,
  css,
  fromHex,
  fromHsl,
  fromRgb,
  hsl,
})

export {bytes, css, fromHex, fromHsl, fromRgb, hsl, okhsl}
export default okhsl

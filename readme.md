# okhsl

A small, dependency-free TypeScript library for converting [OkHSL](https://bottosson.github.io/posts/colorpicker) colors to standard sRGB and back.

OkHSL is a perceptual color-picker space built on Oklab. Unlike ordinary HSL, equal lightness and saturation changes are designed to feel substantially more uniform across hues.

## Install

```sh
bun add okhsl
```

The published package ships standard ESM JavaScript plus TypeScript source for types. It has no runtime dependencies.

## Usage

```ts
import okhsl from 'okhsl'

okhsl(346, 86, 67) // 'f26bbc'
okhsl(213, 92, 67, 56) // '1db6d08f'

okhsl.css(115, 100, 89, 100) // '#de0'
okhsl.hsl(309, 76, 80) // [272, 75, 84]
okhsl.bytes(66, 93, 67, 120) // [226, 141, 28, 120]

okhsl.fromRgb(29, 182, 208, 56) // [213, 92, 67, 56]
okhsl.fromHsl(272, 75, 84, 42) // [309, 76, 80, 42]
okhsl.fromHex('#de0') // [115, 100, 89]
```

All methods are also named exports:

```ts
import {bytes, css, fromHex, fromHsl, fromRgb, hsl, okhsl} from 'okhsl'
```

## Input forms

The channel-based methods accept positional channels, a readonly tuple or an object. For OkHSL and standard HSL inputs, omitted or `undefined` channels default independently to hue `0`, saturation `100` and lightness `50`. RGB input requires all three channels.

```ts
okhsl() // 'd70071' (OkHSL 0, 100, 50)
okhsl(213) // '00869a'
okhsl([undefined, 0] as const) // '777777'
okhsl({l: 0}) // '000000'
okhsl.fromHsl() // [29, 100, 57] (standard HSL 0, 100, 50 is sRGB red)

okhsl.fromRgb([242, 107, 188] as const)
okhsl.fromRgb({r: 242, g: 107, b: 188})
```

Pass alpha separately from a tuple or object. Four-channel input tuples throw `RangeError` so a byte alpha cannot be mistaken for a percentage:

```ts
okhsl([213, 92, 67], 56)
okhsl.bytes({h: 66, s: 93, l: 67}, 120)
```

## API

| Function | Input | Output | Alpha |
| --- | --- | --- | --- |
| `okhsl(h?, s?, l?, alpha?)` | OkHSL | lowercase 6/8-digit sRGB hex without `#` | percentage `0–100`, converted to a byte |
| `okhsl.css(h?, s?, l?, alpha?)` | OkHSL | shortest exact CSS hex | percentage `0–100`, converted to a byte |
| `okhsl.bytes(h?, s?, l?, alphaByte?)` | OkHSL | integer sRGB byte tuple | byte `0–255`, rounded |
| `okhsl.hsl(h?, s?, l?, alpha?)` | OkHSL | rounded standard sRGB HSL tuple | percentage `0–100`, preserved |
| `okhsl.fromRgb(r, g, b, alpha?)` | sRGB bytes | rounded OkHSL tuple | percentage `0–100`, preserved |
| `okhsl.fromHsl(h?, s?, l?, alpha?)` | standard sRGB HSL | rounded OkHSL tuple | percentage `0–100`, preserved |
| `okhsl.fromHex(hex)` | CSS-style 3/4/6/8-digit hex | rounded OkHSL tuple | hex byte converted to a rounded percentage |

Hue inputs wrap into `[0, 360)`. Finite saturation, lightness, RGB and alpha inputs are clamped to their documented ranges. After defaults are applied, nonfinite or nonnumeric channels throw `RangeError`. Invalid hex input throws `TypeError`.

Inverse color channels are rounded integers. Percentage alpha supplied directly to tuple-returning methods is preserved without rounding. `fromHex()` necessarily converts its 8-bit alpha channel to the nearest integer percentage.

The main hex function preserves an explicitly supplied opaque alpha:

```ts
okhsl(213, 92, 67, 100) // '1db6d0ff'
```

CSS output instead removes redundant opaque alpha, then uses `#rgb` or `#rgba` shorthand only when every byte is exactly representable by one hexadecimal digit.

## Numerical behavior

Exact sRGB grays use hue `0` and saturation `0`. HSL conversion uses unrounded sRGB channels. Hex and byte output clip to the displayable sRGB range before rounding. Conversion through integer OkHSL is lossy: RGB → rounded OkHSL → RGB need not reproduce the original bytes.

## Validation

The test suite covers the documented examples plus:

- all 256 exact integer grays
- known sRGB primaries
- positive and negative hue wrapping
- alpha-unit and CSS-shortening semantics
- readonly tuple and object input forms
- malformed hex strings, including valid-length non-hex input
- nonfinite and out-of-range values
- dense gamut sweeps around the OkHSL saturation transition
- unquantized forward/inverse round trips
- extremely small finite values

Run the complete release validation with:

```sh
bun run validate
```

## Development

```sh
bun install
bun run lint
bun run test
bun run build
```

`bun run build` writes the browser-compatible ESM bundle to `dist/index.js`.

## Attribution

The numerical core is adapted from [Björn Ottosson’s OkHSL reference implementation](https://bottosson.github.io/posts/colorpicker/) via [Brian Holbrook’s TypeScript port](https://github.com/holbrookdev/ok-color-picker). Both copyright notices are included in [`license.txt`](license.txt).

## License

MIT. See [`license.txt`](license.txt).

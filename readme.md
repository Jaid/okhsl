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
okhsl(497, 92, 67) // '65bd37'
okhsl(213, 92, 67, 56) // '1db6d08f'

okhsl.css(120, 100, 35) // '#4b5900'
okhsl.css(115, 100, 89) // '#de0'
okhsl.css(115, 100, 89, 100) // '#de0'

okhsl.hsl(309, 76, 80) // [272, 75, 84]
okhsl.bytes(66, 93, 67) // [226, 141, 28]
okhsl.bytes(66, 93, 67, 120) // [226, 141, 28, 120]

okhsl.fromRgb(242, 107, 188) // [346, 86, 67]
okhsl.fromRgb(29, 182, 208, 56) // [213, 92, 67, 56]
okhsl.fromHsl(272, 75, 84) // [309, 76, 80]
okhsl.fromHsl(272, 75, 84, 42) // [309, 76, 80, 42]

okhsl.fromHex('#de0') // [115, 100, 89]
okhsl.fromHex('1db6d08f') // [213, 92, 67, 56]
```

All methods are also named exports:

```ts
import {bytes, css, fromHex, fromHsl, fromRgb, hsl, okhsl} from 'okhsl'
```

## Input forms

The conversion methods accept either positional channels, a readonly three-channel tuple, or an object:

```ts
okhsl(346, 86, 67)
okhsl([346, 86, 67] as const)
okhsl({h: 346, s: 86, l: 67})

okhsl.fromRgb([242, 107, 188] as const)
okhsl.fromRgb({r: 242, g: 107, b: 188})
```

Alpha is deliberately kept as a separate argument for tuple/object inputs:

```ts
okhsl([213, 92, 67], 56)
okhsl.bytes({h: 66, s: 93, l: 67}, 120)
```

This avoids giving a four-element tuple two possible alpha units depending on the method.

## API

| Function | Input | Output | Alpha |
| --- | --- | --- | --- |
| `okhsl(h, s, l, alpha?)` | OkHSL | lowercase 6/8-digit sRGB hex without `#` | percentage `0–100`, converted to a byte |
| `okhsl.css(h, s, l, alpha?)` | OkHSL | shortest exact CSS hex | percentage `0–100`, converted to a byte |
| `okhsl.bytes(h, s, l, alphaByte?)` | OkHSL | integer sRGB byte tuple | byte `0–255`, rounded |
| `okhsl.hsl(h, s, l, alpha?)` | OkHSL | rounded standard sRGB HSL tuple | percentage `0–100`, preserved |
| `okhsl.fromRgb(r, g, b, alpha?)` | sRGB bytes | rounded OkHSL tuple | percentage `0–100`, preserved |
| `okhsl.fromHsl(h, s, l, alpha?)` | standard sRGB HSL | rounded OkHSL tuple | percentage `0–100`, preserved |
| `okhsl.fromHex(hex)` | CSS-style 3/4/6/8-digit hex | rounded OkHSL tuple | hex byte converted to a rounded percentage |

Hue inputs wrap into `[0, 360)`. Finite saturation, lightness, RGB and alpha inputs are clamped to their documented ranges. Nonfinite or nonnumeric color channels throw `RangeError`.

Inverse color channels are rounded integers. Percentage alpha supplied directly to tuple-returning methods is preserved without rounding. `fromHex()` necessarily converts its 8-bit alpha channel to the nearest integer percentage.

The main hex function preserves an explicitly supplied opaque alpha:

```ts
okhsl(213, 92, 67, 100) // '1db6d0ff'
```

CSS output instead removes redundant opaque alpha, then uses `#rgb` or `#rgba` shorthand only when every byte is exactly representable by one hexadecimal digit.

## Numerical behavior

The implementation follows Björn Ottosson's reference OkHSL gamut approximation, Oklab matrices and sRGB transfer functions.

The numerical core additionally hardens several edge cases that are easy to miss in direct ports:

- exact sRGB grays use canonical hue `0` and saturation `0`
- forward achromatic colors avoid unnecessary gamut-cusp calculations
- zero chroma is guarded explicitly in inverse conversion
- soft-minimum calculations use ratio-based equivalents that remain finite for extremely small values
- vanishingly small lightness values have a stable black endpoint
- HSL conversion uses unrounded sRGB values internally

Final sRGB channels are clipped to the displayable range before byte quantization. Integer conversion is inherently lossy, so RGB → rounded OkHSL → RGB is not guaranteed to reproduce the original bytes exactly.

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

The numerical conversion core is adapted from [Björn Ottosson's OkHSL color-picker reference implementation](https://bottosson.github.io/posts/colorpicker) using the TypeScript port by Brian Holbrook from [Ok Color Picker](https://github.com/holbrookdev/ok-color-picker). Its original MIT copyright and permission notice are retained in `src/conversion.ts`.

Independent implementations from [Color.js](https://github.com/color-js/color.js), [ColorAide](https://github.com/facelessuser/coloraide) and [Kornel Lesiński's Oklab repository](https://gitlab.com/kornelski/oklab) are useful cross-references for the color-space behavior.

## License

MIT. See [`license.txt`](license.txt).

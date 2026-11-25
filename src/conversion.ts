type Rgb = [red: number, green: number, blue: number]
type Hsl = [hue: number, saturation: number, lightness: number]
type Oklab = [lightness: number, a: number, b: number]
type Lms = [l: number, m: number, s: number]
type ChromaBounds = [zero: number, middle: number, maximum: number]
type Cusp = [lightness: number, chroma: number]
type SaturationCoefficients = readonly [
  k0: number,
  k1: number,
  k2: number,
  k3: number,
  k4: number,
  weightL: number,
  weightM: number,
  weightS: number,
]

const TOE_K1 = 0.206
const TOE_K2 = 0.03
const TOE_K3 = (1 + TOE_K1) / (1 + TOE_K2)
function cube(value: number): number {
  return value * value * value
}
function linearToSrgb(value: number): number {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
}
function srgbToLinear(value: number): number {
  return value > 0.04045 ? ((value + 0.055) / 1.055) ** 2.4 : value / 12.92
}
function lmsToLinearSrgb(l: number, m: number, s: number): Rgb {
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}
function oklabChromaDirection(a: number, b: number): Lms {
  return [
    0.3963377774 * a + 0.2158037573 * b,
    -0.1055613458 * a - 0.0638541728 * b,
    -0.0894841775 * a - 1.291485548 * b,
  ]
}
function linearSrgbToOklab(red: number, green: number, blue: number): Oklab {
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue
  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)
  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ]
}
function oklabToLinearSrgb(lightness: number, a: number, b: number): Rgb {
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b
  return lmsToLinearSrgb(cube(lRoot), cube(mRoot), cube(sRoot))
}
function toe(value: number): number {
  const shifted = TOE_K3 * value - TOE_K1
  return 0.5 * (shifted + Math.sqrt(shifted * shifted + 4 * TOE_K2 * TOE_K3 * value))
}
function toeInverse(value: number): number {
  return (value * value + TOE_K1 * value) / (TOE_K3 * (value + TOE_K2))
}
function saturationCoefficients(a: number, b: number): SaturationCoefficients {
  if (-1.88170328 * a - 0.80936493 * b > 1) {
    return [1.19086277, 1.76576728, 0.59662641, 0.75515197, 0.56771245, 4.0767416621, -3.3077115913, 0.2309699292]
  }
  if (1.81444104 * a - 1.19445276 * b > 1) {
    return [0.73956515, -0.45954404, 0.08285427, 0.1254107, 0.14503204, -1.2684380046, 2.6097574011, -0.3413193965]
  }
  return [1.35733652, -0.00915799, -1.1513021, -0.50559606, 0.00692167, -0.0041960863, -0.7034186147, 1.707614701]
}
function computeMaximumSaturation(a: number, b: number): number {
  const [k0, k1, k2, k3, k4, weightL, weightM, weightS] = saturationCoefficients(a, b)
  const estimate = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b
  const [derivativeL, derivativeM, derivativeS] = oklabChromaDirection(a, b)
  const lRoot = 1 + estimate * derivativeL
  const mRoot = 1 + estimate * derivativeM
  const sRoot = 1 + estimate * derivativeS
  const l = cube(lRoot)
  const m = cube(mRoot)
  const s = cube(sRoot)
  const lFirst = 3 * derivativeL * lRoot * lRoot
  const mFirst = 3 * derivativeM * mRoot * mRoot
  const sFirst = 3 * derivativeS * sRoot * sRoot
  const lSecond = 6 * derivativeL * derivativeL * lRoot
  const mSecond = 6 * derivativeM * derivativeM * mRoot
  const sSecond = 6 * derivativeS * derivativeS * sRoot
  const value = weightL * l + weightM * m + weightS * s
  const firstDerivative = weightL * lFirst + weightM * mFirst + weightS * sFirst
  const secondDerivative = weightL * lSecond + weightM * mSecond + weightS * sSecond
  return estimate - value * firstDerivative / (firstDerivative * firstDerivative - 0.5 * value * secondDerivative)
}
function findCusp(a: number, b: number): Cusp {
  const maximumSaturation = computeMaximumSaturation(a, b)
  const rgbAtMaximum = oklabToLinearSrgb(1, maximumSaturation * a, maximumSaturation * b)
  const lightness = Math.cbrt(1 / Math.max(...rgbAtMaximum))
  return [lightness, lightness * maximumSaturation]
}
function halleyCorrection(value: number, firstDerivative: number, secondDerivative: number): number {
  const ratio = firstDerivative / (firstDerivative * firstDerivative - 0.5 * value * secondDerivative)
  return ratio >= 0 ? -value * ratio : Infinity
}
function refineUpperChroma(lightness: number, chroma: number, a: number, b: number): number {
  const [derivativeL, derivativeM, derivativeS] = oklabChromaDirection(a, b)
  const lRoot = lightness + chroma * derivativeL
  const mRoot = lightness + chroma * derivativeM
  const sRoot = lightness + chroma * derivativeS
  const l = cube(lRoot)
  const m = cube(mRoot)
  const s = cube(sRoot)
  const lFirst = 3 * derivativeL * lRoot * lRoot
  const mFirst = 3 * derivativeM * mRoot * mRoot
  const sFirst = 3 * derivativeS * sRoot * sRoot
  const lSecond = 6 * derivativeL * derivativeL * lRoot
  const mSecond = 6 * derivativeM * derivativeM * mRoot
  const sSecond = 6 * derivativeS * derivativeS * sRoot
  const [red, green, blue] = lmsToLinearSrgb(l, m, s)
  const [redFirst, greenFirst, blueFirst] = lmsToLinearSrgb(lFirst, mFirst, sFirst)
  const [redSecond, greenSecond, blueSecond] = lmsToLinearSrgb(lSecond, mSecond, sSecond)
  const redCorrection = halleyCorrection(red - 1, redFirst, redSecond)
  const greenCorrection = halleyCorrection(green - 1, greenFirst, greenSecond)
  const blueCorrection = halleyCorrection(blue - 1, blueFirst, blueSecond)
  return chroma + Math.min(redCorrection, greenCorrection, blueCorrection)
}
function softMinimumFourth(first: number, second: number): number {
  const minimum = Math.min(first, second)
  const maximum = Math.max(first, second)
  return minimum / (1 + (minimum / maximum) ** 4) ** 0.25
}
function softMinimumSecond(first: number, second: number): number {
  const minimum = Math.min(first, second)
  const maximum = Math.max(first, second)
  return minimum / Math.hypot(1, minimum / maximum)
}
function getChromaBounds(lightness: number, a: number, b: number): ChromaBounds {
  const [cuspLightness, cuspChroma] = findCusp(a, b)
  // At constant lightness, the lower edge of the cusp triangle is exact; only its upper edge needs refinement.
  const lower = lightness <= cuspLightness
  const triangleChroma = lower ? lightness * (cuspChroma / cuspLightness) : (1 - lightness) * (cuspChroma / (1 - cuspLightness))
  const maximumChroma = lower ? triangleChroma : refineUpperChroma(lightness, triangleChroma, a, b)
  const middleS = 0.11516993
    + 1 / (7.4477897
      + 4.1590124 * b
      + a * (-2.19557347
        + 1.75198401 * b
        + a * (-2.13704948
          - 10.02301043 * b
          + a * (-4.24894561 + 5.38770819 * b + 4.69891013 * a))))
  const middleT = 0.11239642
    + 1 / (1.6132032
      - 0.68124379 * b
      + a * (0.40370612
        + 0.90148123 * b
        + a * (-0.27087943
          + 0.6122399 * b
          + a * (0.00299215 - 0.45399568 * b - 0.14661872 * a))))
  const scale = maximumChroma / triangleChroma
  const middleChroma = 0.9 * scale * softMinimumFourth(lightness * middleS, (1 - lightness) * middleT)
  const zeroChroma = softMinimumSecond(lightness * 0.4, (1 - lightness) * 0.8)
  return [zeroChroma, middleChroma, maximumChroma]
}
function saturationToChroma(saturation: number, zeroChroma: number, middleChroma: number, maximumChroma: number): number {
  if (saturation < 0.8) {
    const t = 1.25 * saturation
    const slope = 0.8 * zeroChroma
    const curvature = 1 - slope / middleChroma
    return t * slope / (1 - curvature * t)
  }
  const t = 5 * (saturation - 0.8)
  const slope = 0.3125 * middleChroma * (middleChroma / zeroChroma)
  const curvature = 1 - slope / (maximumChroma - middleChroma)
  return middleChroma + t * slope / (1 - curvature * t)
}
function chromaToSaturation(chroma: number, zeroChroma: number, middleChroma: number, maximumChroma: number): number {
  if (chroma < middleChroma) {
    const slope = 0.8 * zeroChroma
    const curvature = 1 - slope / middleChroma
    const t = chroma / (slope + curvature * chroma)
    return 0.8 * t
  }
  const slope = 0.3125 * middleChroma * (middleChroma / zeroChroma)
  const curvature = 1 - slope / (maximumChroma - middleChroma)
  const delta = chroma - middleChroma
  const t = delta / (slope + curvature * delta)
  return 0.8 + 0.2 * t
}
function rgbToHsl(redByte: number, greenByte: number, blueByte: number): Hsl {
  const red = redByte / 255
  const green = greenByte / 255
  const blue = blueByte / 255
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const lightness = (maximum + minimum) / 2
  if (maximum === minimum) {
    return [0, 0, lightness]
  }
  const delta = maximum - minimum
  const saturation = lightness > 0.5 ? delta / (2 - maximum - minimum) : delta / (maximum + minimum)
  let hue: number
  if (maximum === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0)
  } else if (maximum === green) {
    hue = (blue - red) / delta + 2
  } else {
    hue = (red - green) / delta + 4
  }
  return [hue / 6, saturation, lightness]
}
function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  // The CSS Color 4 formula avoids cancellation at white (https://drafts.csswg.org/css-color-4/#hsl-to-rgb).
  const amplitude = saturation * Math.min(lightness, 1 - lightness)
  const channel = (offset: number) => {
    const k = (offset + 12 * hue) % 12
    return 255 * (lightness - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1)))
  }
  return [channel(0), channel(8), channel(4)]
}
function okhslToSrgb(hue: number, saturation: number, lightness: number): Rgb {
  const perceptualLightness = toeInverse(lightness)
  if (perceptualLightness >= 1) {
    return [255, 255, 255]
  }
  const luminance = cube(perceptualLightness)
  if (saturation === 0 || luminance === 0) {
    const gray = 255 * linearToSrgb(luminance)
    return [gray, gray, gray]
  }
  const angle = 2 * Math.PI * hue
  const directionA = Math.cos(angle)
  const directionB = Math.sin(angle)
  const [zeroChroma, middleChroma, maximumChroma] = getChromaBounds(perceptualLightness, directionA, directionB)
  const chroma = saturationToChroma(saturation, zeroChroma, middleChroma, maximumChroma)
  const [red, green, blue] = oklabToLinearSrgb(perceptualLightness, chroma * directionA, chroma * directionB)
  return [255 * linearToSrgb(red), 255 * linearToSrgb(green), 255 * linearToSrgb(blue)]
}
function srgbToOkhsl(redByte: number, greenByte: number, blueByte: number): Hsl {
  if (redByte === greenByte && greenByte === blueByte) {
    return [0, 0, toe(Math.cbrt(srgbToLinear(redByte / 255)))]
  }
  const [perceptualLightness, oklabA, oklabB] = linearSrgbToOklab(srgbToLinear(redByte / 255), srgbToLinear(greenByte / 255), srgbToLinear(blueByte / 255))
  const chroma = Math.hypot(oklabA, oklabB)
  if (chroma === 0) {
    return [0, 0, toe(perceptualLightness)]
  }
  const directionA = oklabA / chroma
  const directionB = oklabB / chroma
  const hue = 0.5 + 0.5 * Math.atan2(-oklabB, -oklabA) / Math.PI
  const [zeroChroma, middleChroma, maximumChroma] = getChromaBounds(perceptualLightness, directionA, directionB)
  return [hue, chromaToSaturation(chroma, zeroChroma, middleChroma, maximumChroma), toe(perceptualLightness)]
}

export {hslToRgb, okhslToSrgb, rgbToHsl, srgbToOkhsl}

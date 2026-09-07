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
const INVALID_HALLEY_CORRECTION = 1_000_000
function cube(value: number): number {
  return value * value * value
}
function hueToRgb(minimum: number, maximum: number, hue: number): number {
  let normalizedHue = hue
  if (normalizedHue < 0) {
    normalizedHue += 1
  }
  if (normalizedHue > 1) {
    normalizedHue -= 1
  }
  if (normalizedHue < 1 / 6) {
    return minimum + (maximum - minimum) * 6 * normalizedHue
  }
  if (normalizedHue < 1 / 2) {
    return maximum
  }
  if (normalizedHue < 2 / 3) {
    return minimum + (maximum - minimum) * (2 / 3 - normalizedHue) * 6
  }
  return minimum
}
function linearToSrgb(value: number): number {
  return value <= 0.003_130_8 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
}
function srgbToLinear(value: number): number {
  return value > 0.040_45 ? ((value + 0.055) / 1.055) ** 2.4 : value / 12.92
}
function lmsToLinearSrgb(l: number, m: number, s: number): Rgb {
  return [
    4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
    -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
  ]
}
function oklabChromaDirection(a: number, b: number): Lms {
  return [
    0.396_337_777_4 * a + 0.215_803_757_3 * b,
    -0.105_561_345_8 * a - 0.063_854_172_8 * b,
    -0.089_484_177_5 * a - 1.291_485_548 * b,
  ]
}
function linearSrgbToOklab(red: number, green: number, blue: number): Oklab {
  const l = 0.412_221_470_8 * red + 0.536_332_536_3 * green + 0.051_445_992_9 * blue
  const m = 0.211_903_498_2 * red + 0.680_699_545_1 * green + 0.107_396_956_6 * blue
  const s = 0.088_302_461_9 * red + 0.281_718_837_6 * green + 0.629_978_700_5 * blue
  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)
  return [
    0.210_454_255_3 * lRoot + 0.793_617_785 * mRoot - 0.004_072_046_8 * sRoot,
    1.977_998_495_1 * lRoot - 2.428_592_205 * mRoot + 0.450_593_709_9 * sRoot,
    0.025_904_037_1 * lRoot + 0.782_771_766_2 * mRoot - 0.808_675_766 * sRoot,
  ]
}
function oklabToLinearSrgb(lightness: number, a: number, b: number): Rgb {
  const lRoot = lightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b
  const mRoot = lightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b
  const sRoot = lightness - 0.089_484_177_5 * a - 1.291_485_548 * b
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
  if (-1.881_703_28 * a - 0.809_364_93 * b > 1) {
    return [1.190_862_77, 1.765_767_28, 0.596_626_41, 0.755_151_97, 0.567_712_45, 4.076_741_662_1, -3.307_711_591_3, 0.230_969_929_2]
  }
  if (1.814_441_04 * a - 1.194_452_76 * b > 1) {
    return [0.739_565_15, -0.459_544_04, 0.082_854_27, 0.125_410_7, 0.145_032_04, -1.268_438_004_6, 2.609_757_401_1, -0.341_319_396_5]
  }
  return [1.357_336_52, -0.009_157_99, -1.151_302_1, -0.505_596_06, 0.006_921_67, -0.004_196_086_3, -0.703_418_614_7, 1.707_614_701]
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
  const lightness = Math.cbrt(1 / Math.max(rgbAtMaximum[0], rgbAtMaximum[1], rgbAtMaximum[2]))
  return [lightness, lightness * maximumSaturation]
}
function halleyCorrection(value: number, firstDerivative: number, secondDerivative: number): number {
  const ratio = firstDerivative / (firstDerivative * firstDerivative - 0.5 * value * secondDerivative)
  return ratio >= 0 ? -value * ratio : INVALID_HALLEY_CORRECTION
}
function findGamutIntersection(a: number, b: number, targetLightness: number, targetChroma: number, anchorLightness: number, suppliedCusp?: Cusp): number {
  const cusp = suppliedCusp ?? findCusp(a, b)
  const [cuspLightness, cuspChroma] = cusp
  const lowerHalf = (targetLightness - anchorLightness) * cuspChroma - (cuspLightness - anchorLightness) * targetChroma <= 0
  if (lowerHalf) {
    return cuspChroma * anchorLightness / (targetChroma * cuspLightness + cuspChroma * (anchorLightness - targetLightness))
  }
  let intersection = cuspChroma * (anchorLightness - 1) / (targetChroma * (cuspLightness - 1) + cuspChroma * (anchorLightness - targetLightness))
  const lightnessDelta = targetLightness - anchorLightness
  const chromaDelta = targetChroma
  const [chromaDirectionL, chromaDirectionM, chromaDirectionS] = oklabChromaDirection(a, b)
  const derivativeL = lightnessDelta + chromaDelta * chromaDirectionL
  const derivativeM = lightnessDelta + chromaDelta * chromaDirectionM
  const derivativeS = lightnessDelta + chromaDelta * chromaDirectionS
  const lightness = anchorLightness * (1 - intersection) + intersection * targetLightness
  const chroma = intersection * targetChroma
  const lRoot = lightness + chroma * chromaDirectionL
  const mRoot = lightness + chroma * chromaDirectionM
  const sRoot = lightness + chroma * chromaDirectionS
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
  intersection += Math.min(redCorrection, Math.min(greenCorrection, blueCorrection))
  return intersection
}
function getMaximumST(a: number, b: number, suppliedCusp?: Cusp): [number, number] {
  const [lightness, chroma] = suppliedCusp ?? findCusp(a, b)
  return [chroma / lightness, chroma / (1 - lightness)]
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
  const cusp = findCusp(a, b)
  const maximumChroma = findGamutIntersection(a, b, lightness, 1, lightness, cusp)
  const [maximumS, maximumT] = getMaximumST(a, b, cusp)
  const middleS = 0.115_169_93
    + 1 / (7.447_789_7
      + 4.159_012_4 * b
      + a * (-2.195_573_47
        + 1.751_984_01 * b
        + a * (-2.137_049_48
          - 10.023_010_43 * b
          + a * (-4.248_945_61 + 5.387_708_19 * b + 4.698_910_13 * a))))
  const middleT = 0.112_396_42
    + 1 / (1.613_203_2
      - 0.681_243_79 * b
      + a * (0.403_706_12
        + 0.901_481_23 * b
        + a * (-0.270_879_43
          + 0.612_239_9 * b
          + a * (0.002_992_15 - 0.453_995_68 * b - 0.146_618_72 * a))))
  const scale = maximumChroma / Math.min(lightness * maximumS, (1 - lightness) * maximumT)
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
  if (saturation === 0) {
    const gray = lightness * 255
    return [gray, gray, gray]
  }
  const maximum = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
  const minimum = 2 * lightness - maximum
  return [
    hueToRgb(minimum, maximum, hue + 1 / 3) * 255,
    hueToRgb(minimum, maximum, hue) * 255,
    hueToRgb(minimum, maximum, hue - 1 / 3) * 255,
  ]
}
function okhslToSrgb(hue: number, saturation: number, lightness: number): Rgb {
  if (lightness === 1) {
    return [255, 255, 255]
  }
  if (lightness < 1e-110) {
    return [0, 0, 0]
  }
  const angle = 2 * Math.PI * hue
  const directionA = Math.cos(angle)
  const directionB = Math.sin(angle)
  const perceptualLightness = toeInverse(lightness)
  if (saturation === 0) {
    const gray = 255 * linearToSrgb(perceptualLightness ** 3)
    return [gray, gray, gray]
  }
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

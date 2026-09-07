export function rgb_to_hsl(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0; let s = 0
  const l = (max + min) / 2
  if (max == min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: {
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      }
      case g: {
        h = (b - r) / d + 2
        break
      }
      case b: {
        h = (r - g) / d + 4
        break
      }
    }
    h /= 6
  }
  return [h, s, l]
}
export function hsl_to_rgb(h: number, s: number, l: number) {
  let b; let g; let r
  if (s == 0) {
    r = g = b = l
  } else {
    function hue_to_rgb(p: number, q: number, t: number) {
      if (t < 0) {
        t += 1
      }
      if (t > 1) {
        t -= 1
      }
      if (t < 1 / 6) {
        return p + (q - p) * 6 * t
      }
      if (t < 1 / 2) {
        return q
      }
      if (t < 2 / 3) {
        return p + (q - p) * (2 / 3 - t) * 6
      }
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue_to_rgb(p, q, h + 1 / 3)
    g = hue_to_rgb(p, q, h)
    b = hue_to_rgb(p, q, h - 1 / 3)
  }
  return [r * 255, g * 255, b * 255]
}
export function srgb_transfer_function(a: number) {
  return 0.003_130_8 >= a ? 12.92 * a : 1.055 * a ** 0.416_666_666_666_666_7 - 0.055
}
export function srgb_transfer_function_inv(a: number) {
  return 0.040_45 < a ? ((a + 0.055) / 1.055) ** 2.4 : a / 12.92
}
export function linear_srgb_to_oklab(r: number, g: number, b: number) {
  const l = 0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b
  const m = 0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b
  const s = 0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  return [0.210_454_255_3 * l_ + 0.793_617_785 * m_ - 0.004_072_046_8 * s_, 1.977_998_495_1 * l_ - 2.428_592_205 * m_ + 0.450_593_709_9 * s_, 0.025_904_037_1 * l_ + 0.782_771_766_2 * m_ - 0.808_675_766 * s_]
}
export function oklab_to_linear_srgb(L: number, a: number, b: number) {
  const l_ = L + 0.396_337_777_4 * a + 0.215_803_757_3 * b
  const m_ = L - 0.105_561_345_8 * a - 0.063_854_172_8 * b
  const s_ = L - 0.089_484_177_5 * a - 1.291_485_548 * b
  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_
  return [+4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s, -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s, -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s]
}
export function okhsl_to_srgb(h: number, s: number, l: number) {
  if (l == 1) {
    return [255, 255, 255]
  }
    // At this scale every linear RGB cube underflows to zero.
  else if (l < 1e-110) {
    return [0, 0, 0]
  }
  const a_ = Math.cos(2 * Math.PI * h)
  const b_ = Math.sin(2 * Math.PI * h)
  const L = toe_inv(l)
  if (s === 0) {
    const gray = 255 * srgb_transfer_function(L ** 3)
    return [gray, gray, gray]
  }
  const Cs = get_Cs(L, a_, b_)
  const C_0 = Cs[0]
  const C_mid = Cs[1]
  const C_max = Cs[2]
  let C; let k_0; let k_1; let k_2; let t
  if (s < 0.8) {
    t = 1.25 * s
    k_0 = 0
    k_1 = 0.8 * C_0
    k_2 = 1 - k_1 / C_mid
  } else {
    t = 5 * (s - 0.8)
    k_0 = C_mid
    k_1 = 0.3125 * C_mid * (C_mid / C_0)
    k_2 = 1 - k_1 / (C_max - C_mid)
  }
  C = k_0 + t * k_1 / (1 - k_2 * t)
  const rgb = oklab_to_linear_srgb(L, C * a_, C * b_)
  return [255 * srgb_transfer_function(rgb[0]), 255 * srgb_transfer_function(rgb[1]), 255 * srgb_transfer_function(rgb[2])]
}
export function srgb_to_okhsl(r: number, g: number, b: number) {
  const lab = linear_srgb_to_oklab(srgb_transfer_function_inv(r / 255), srgb_transfer_function_inv(g / 255), srgb_transfer_function_inv(b / 255))
    // Exact sRGB grays have undefined hue; avoid matrix noise and division by zero.
  if (r === g && g === b) {
    return [0, 0, toe(Math.cbrt(srgb_transfer_function_inv(r / 255)))]
  }
  const C = Math.hypot(lab[1], lab[2])
  if (C === 0) {
    return [0, 0, toe(lab[0])]
  }
  const a_ = lab[1] / C
  const b_ = lab[2] / C
  const L = lab[0]
  const h = 0.5 + 0.5 * Math.atan2(-lab[2], -lab[1]) / Math.PI
  const Cs = get_Cs(L, a_, b_)
  const C_0 = Cs[0]
  const C_mid = Cs[1]
  const C_max = Cs[2]
  let s
  if (C < C_mid) {
    const k_0 = 0
    const k_1 = 0.8 * C_0
    const k_2 = 1 - k_1 / C_mid
    const t = (C - k_0) / (k_1 + k_2 * (C - k_0))
    s = t * 0.8
  } else {
    const k_0 = C_mid
    const k_1 = 0.3125 * C_mid * (C_mid / C_0)
    const k_2 = 1 - k_1 / (C_max - C_mid)
    const t = (C - k_0) / (k_1 + k_2 * (C - k_0))
    s = 0.8 + 0.2 * t
  }
  const l = toe(L)
  return [h, s, l]
}
function toe(x: number) {
  const k_1 = 0.206
  const k_2 = 0.03
  const k_3 = (1 + k_1) / (1 + k_2)
  return 0.5
        * (k_3 * x
            - k_1
            + Math.sqrt((k_3 * x - k_1) * (k_3 * x - k_1) + 4 * k_2 * k_3 * x))
}
function toe_inv(x: number) {
  const k_1 = 0.206
  const k_2 = 0.03
  const k_3 = (1 + k_1) / (1 + k_2)
  return (x * x + k_1 * x) / (k_3 * (x + k_2))
}
// Finds the maximum saturation possible for a given hue that fits in sRGB
// Saturation here is defined as S = C/L
// a and b must be normalized so a^2 + b^2 == 1
function compute_max_saturation(a: number, b: number) {
    // Max saturation will be when one of r, g or b goes below zero.
    // Select different coefficients depending on which component goes below zero first
  let k0; let k1; let k2; let k3; let k4; let wl; let wm; let ws
  if (-1.881_703_28 * a - 0.809_364_93 * b > 1) {
        // Red component
    k0 = +1.190_862_77
    k1 = +1.765_767_28
    k2 = +0.596_626_41
    k3 = +0.755_151_97
    k4 = +0.567_712_45
    wl = +4.076_741_662_1
    wm = -3.307_711_591_3
    ws = +0.230_969_929_2
  } else if (1.814_441_04 * a - 1.194_452_76 * b > 1) {
        // Green component
    k0 = +0.739_565_15
    k1 = -0.459_544_04
    k2 = +0.082_854_27
    k3 = +0.125_410_7
    k4 = +0.145_032_04
    wl = -1.268_438_004_6
    wm = +2.609_757_401_1
    ws = -0.341_319_396_5
  } else {
        // Blue component
    k0 = +1.357_336_52
    k1 = -0.009_157_99
    k2 = -1.151_302_1
    k3 = -0.505_596_06
    k4 = +0.006_921_67
    wl = -0.004_196_086_3
    wm = -0.703_418_614_7
    ws = +1.707_614_701
  }
    // Approximate max saturation using a polynomial:
  let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b
    // Do one step Halley's method to get closer
    // This gives an error less than 1e-6, except for some blue hues where the dS/dh is close to infinite
    // this should be sufficient for most applications, otherwise do two/three steps
  const k_l = +0.396_337_777_4 * a + 0.215_803_757_3 * b
  const k_m = -0.105_561_345_8 * a - 0.063_854_172_8 * b
  const k_s = -0.089_484_177_5 * a - 1.291_485_548 * b
  {
    const l_ = 1 + S * k_l
    const m_ = 1 + S * k_m
    const s_ = 1 + S * k_s
    const l = l_ * l_ * l_
    const m = m_ * m_ * m_
    const s = s_ * s_ * s_
    const l_dS = 3 * k_l * l_ * l_
    const m_dS = 3 * k_m * m_ * m_
    const s_dS = 3 * k_s * s_ * s_
    const l_dS2 = 6 * k_l * k_l * l_
    const m_dS2 = 6 * k_m * k_m * m_
    const s_dS2 = 6 * k_s * k_s * s_
    const f = wl * l + wm * m + ws * s
    const f1 = wl * l_dS + wm * m_dS + ws * s_dS
    const f2 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2
    S -= f * f1 / (f1 * f1 - 0.5 * f * f2)
  }
  return S
}
function find_cusp(a: number, b: number) {
    // First, find the maximum saturation (saturation S = C/L)
  const S_cusp = compute_max_saturation(a, b)
    // Convert to linear sRGB to find the first point where at least one of r,g or b >= 1:
  const rgb_at_max = oklab_to_linear_srgb(1, S_cusp * a, S_cusp * b)
  const L_cusp = Math.cbrt(1 / Math.max(Math.max(rgb_at_max[0], rgb_at_max[1]), rgb_at_max[2]))
  const C_cusp = L_cusp * S_cusp
  return [L_cusp, C_cusp]
}
// Finds intersection of the line defined by
// L = L0 * (1 - t) + t * L1;
// C = t * C1;
// a and b must be normalized so a^2 + b^2 == 1
function find_gamut_intersection(a: number, b: number, L1: number, C1: number, L0: number, cusp: Array<number> | null = null) {
  if (!cusp)
        // Find the cusp of the gamut triangle
  {
    cusp = find_cusp(a, b)
  }
    // Find the intersection for upper and lower half separately
  let t
  if ((L1 - L0) * cusp[1] - (cusp[0] - L0) * C1 <= 0)
        // Lower half
  {
    t = cusp[1] * L0 / (C1 * cusp[0] + cusp[1] * (L0 - L1))
  } else {
        // Upper half
        // First intersect with triangle
    t = cusp[1] * (L0 - 1) / (C1 * (cusp[0] - 1) + cusp[1] * (L0 - L1))
        // Then one step Halley's method
    {
      const dL = L1 - L0
      const dC = C1
      const k_l = +0.396_337_777_4 * a + 0.215_803_757_3 * b
      const k_m = -0.105_561_345_8 * a - 0.063_854_172_8 * b
      const k_s = -0.089_484_177_5 * a - 1.291_485_548 * b
      const l_dt = dL + dC * k_l
      const m_dt = dL + dC * k_m
      const s_dt = dL + dC * k_s
            // If higher accuracy is required, 2 or 3 iterations of the following block can be used:
      {
        const L = L0 * (1 - t) + t * L1
        const C = t * C1
        const l_ = L + C * k_l
        const m_ = L + C * k_m
        const s_ = L + C * k_s
        const l = l_ * l_ * l_
        const m = m_ * m_ * m_
        const s = s_ * s_ * s_
        const ldt = 3 * l_dt * l_ * l_
        const mdt = 3 * m_dt * m_ * m_
        const sdt = 3 * s_dt * s_ * s_
        const ldt2 = 6 * l_dt * l_dt * l_
        const mdt2 = 6 * m_dt * m_dt * m_
        const sdt2 = 6 * s_dt * s_dt * s_
        const r = 4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s - 1
        const r1 = 4.076_741_662_1 * ldt - 3.307_711_591_3 * mdt + 0.230_969_929_2 * sdt
        const r2 = 4.076_741_662_1 * ldt2 - 3.307_711_591_3 * mdt2 + 0.230_969_929_2 * sdt2
        const u_r = r1 / (r1 * r1 - 0.5 * r * r2)
        let t_r = -r * u_r
        const g = -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s - 1
        const g1 = -1.268_438_004_6 * ldt + 2.609_757_401_1 * mdt - 0.341_319_396_5 * sdt
        const g2 = -1.268_438_004_6 * ldt2 + 2.609_757_401_1 * mdt2 - 0.341_319_396_5 * sdt2
        const u_g = g1 / (g1 * g1 - 0.5 * g * g2)
        let t_g = -g * u_g
        const b = -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s - 1
        const b1 = -0.004_196_086_3 * ldt - 0.703_418_614_7 * mdt + 1.707_614_701 * sdt
        const b2 = -0.004_196_086_3 * ldt2 - 0.703_418_614_7 * mdt2 + 1.707_614_701 * sdt2
        const u_b = b1 / (b1 * b1 - 0.5 * b * b2)
        let t_b = -b * u_b
        t_r = u_r >= 0 ? t_r : 10e5
        t_g = u_g >= 0 ? t_g : 10e5
        t_b = u_b >= 0 ? t_b : 10e5
        t += Math.min(t_r, Math.min(t_g, t_b))
      }
    }
  }
  return t
}
function get_ST_max(a_: number, b_: number, cusp: Array<number> | null = null) {
  if (!cusp) {
    cusp = find_cusp(a_, b_)
  }
  const L = cusp[0]
  const C = cusp[1]
  return [C / L, C / (1 - L)]
}
function get_Cs(L: number, a_: number, b_: number) {
  const cusp = find_cusp(a_, b_)
  const C_max = find_gamut_intersection(a_, b_, L, 1, L, cusp)
  const ST_max = get_ST_max(a_, b_, cusp)
  const S_mid = 0.115_169_93
        + 1
            / (+7.447_789_7
                + 4.159_012_4 * b_
                + a_
                    * (-2.195_573_47
                        + 1.751_984_01 * b_
                        + a_
                            * (-2.137_049_48
                                - 10.023_010_43 * b_
                                + a_ * (-4.248_945_61 + 5.387_708_19 * b_ + 4.698_910_13 * a_))))
  const T_mid = 0.112_396_42
        + 1
            / (+1.613_203_2
                - 0.681_243_79 * b_
                + a_
                    * (+0.403_706_12
                        + 0.901_481_23 * b_
                        + a_
                            * (-0.270_879_43
                                + 0.612_239_9 * b_
                                + a_ * (+0.002_992_15 - 0.453_995_68 * b_ - 0.146_618_72 * a_))))
  const k = C_max / Math.min(L * ST_max[0], (1 - L) * ST_max[1])
    // Ratio-based soft minima avoid overflow and underflow in fourth powers.
  let C_mid
  {
    const C_a = L * S_mid
    const C_b = (1 - L) * T_mid
    C_mid
      = 0.9
                * k
                * Math.min(C_a, C_b) / (1 + (Math.min(C_a, C_b) / Math.max(C_a, C_b)) ** 4) ** 0.25
  }
  let C_0
  {
    const C_a = L * 0.4
    const C_b = (1 - L) * 0.8
    C_0 = Math.min(C_a, C_b) / Math.hypot(1, Math.min(C_a, C_b) / Math.max(C_a, C_b))
  }
  return [C_0, C_mid, C_max]
}

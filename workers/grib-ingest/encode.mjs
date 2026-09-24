export function numberToFloat16(value) {
  if (!Number.isFinite(value)) return 0x7e00;
  const sign = value < 0 ? 0x8000 : 0;
  const absolute = Math.abs(value);
  if (absolute === 0) return sign;
  let exponent = Math.floor(Math.log2(absolute));
  if (exponent < -14) return sign | Math.round(absolute / 2 ** -24);
  if (exponent > 15) return sign | 0x7c00;
  const mantissa = Math.round((absolute / 2 ** exponent - 1) * 1024);
  if (mantissa === 1024) { exponent += 1; return sign | ((exponent + 15) << 10); }
  return sign | ((exponent + 15) << 10) | mantissa;
}

export function encodeFloat16(values) {
  const output = new Uint16Array(values.length);
  values.forEach((value, index) => { output[index] = numberToFloat16(value); });
  return new Uint8Array(output.buffer);
}

export function validateGrid(values, width = 161, height = 121) {
  if (values.length !== width * height) throw new Error('Grid size mismatch');
  if (values.some(value => !Number.isFinite(value))) throw new Error('Grid contains a non-finite value');
  return true;
}

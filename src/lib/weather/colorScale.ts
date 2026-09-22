/** Theme-independent weather scales reference semantic CSS tokens only. */
export const WIND_SCALE = [
  [0, '--weather-wind-0'],
  [2, '--weather-wind-1'],
  [4, '--weather-wind-2'],
  [7, '--weather-wind-3'],
  [10, '--weather-wind-4'],
  [14, '--weather-wind-5'],
  [18, '--weather-wind-6'],
  [24, '--weather-wind-7'],
  [32, '--weather-wind-8'],
  [45, '--weather-wind-9']] as const;
export const TEMP_SCALE = [
  [-10, '--weather-temp-0'],
  [0, '--weather-temp-1'],
  [8, '--weather-temp-2'],
  [16, '--weather-temp-3'],
  [22, '--weather-temp-4'],
  [28, '--weather-temp-5'],
  [34, '--weather-temp-6'],
  [40, '--weather-temp-7']] as const;
export const RAIN_SCALE = [
  [0.1, '--weather-rain-0'],
  [1, '--weather-rain-1'],
  [3, '--weather-rain-2'],
  [8, '--weather-rain-3'],
  [20, '--weather-rain-4'],
  [50, '--weather-rain-5']] as const;
export const WAVE_SCALE = [
  [0, '--weather-wave-0'],
  [0.5, '--weather-wave-1'],
  [1, '--weather-wave-2'],
  [1.5, '--weather-wave-3'],
  [2.5, '--weather-wave-4'],
  [4, '--weather-wave-5'],
  [6, '--weather-wave-6']] as const;


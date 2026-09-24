import type {WxCode} from '@/types/domain';

export function kmaCondition(sky?: number, pty?: number): WxCode {
  if (pty === 1 || pty === 4 || pty === 5 || pty === 6) return 'rain';
  if (pty === 2 || pty === 3 || pty === 7) return 'snow';
  if (sky === 1) return 'clear';
  if (sky === 3) return 'partly';
  return 'cloudy';
}

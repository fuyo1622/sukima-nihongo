import { create } from 'zustand';

/**
 * Whether the phone can speak Japanese. Not saved: it is checked again on every launch.
 * 'missing': no usable Japanese voice, so sound mode swaps listening questions for silent ones.
 */
export type VoiceStatus = 'unknown' | 'ready' | 'missing';

export const useVoice = create<{ status: VoiceStatus }>()(() => ({ status: 'unknown' }));

export function setVoiceStatus(status: VoiceStatus): void {
  if (useVoice.getState().status !== status) useVoice.setState({ status });
}

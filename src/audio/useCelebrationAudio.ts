import { useCallback } from "react";

export type SoundCue = "bell" | "seal" | "cloche" | "applause" | "collision";

/** Plays lightweight synthesized ceremony cues after explicit user interactions. */
export function useCelebrationAudio(muted: boolean): (cue: SoundCue) => void {
  return useCallback(
    (cue: SoundCue): void => {
      if (muted || typeof window === "undefined" || !("AudioContext" in window)) {
        return;
      }
      const context = new window.AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const frequencies: Record<SoundCue, number> = {
        bell: 740,
        seal: 330,
        cloche: 520,
        applause: 880,
        collision: 180,
      };
      oscillator.type = cue === "collision" ? "sawtooth" : "sine";
      oscillator.frequency.value = frequencies[cue];
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.1, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
    },
    [muted],
  );
}


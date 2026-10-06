import { useEffect } from 'react';
import type { SoundId } from './soundCatalog';
import { playSound } from './soundEngine';

/** Plays `id` each time `visible` flips to true -- for win/fail overlays. */
export function usePlayOnShow(visible: boolean, id: SoundId): void {
  useEffect(() => {
    if (visible) playSound(id);
  }, [visible, id]);
}

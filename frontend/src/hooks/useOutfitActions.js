import { useCallback, useEffect, useState } from "react";
import { getSavedIds, getWornTodayIds, markNotForMe, markWorn, saveOutfit } from "../services/api";

/** Shared Save / Not For Me / Mark As Worn state for outfit cards. */
export default function useOutfitActions() {
  const [saved, setSaved] = useState(new Set());
  const [rejected, setRejected] = useState(new Set());
  const [worn, setWorn] = useState(new Set());
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    Promise.all([getSavedIds(), getWornTodayIds()]).then(([s, w]) => {
      setSaved(new Set(s));
      setWorn(new Set(w));
    });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const run = useCallback(async (outfit, fn, apply, message) => {
    setBusyId(outfit.id);
    try {
      await fn(outfit.id);
      apply();
      setToast({ type: "ok", message });
    } catch {
      setToast({ type: "error", message: "That didn’t go through. Please try again." });
    } finally {
      setBusyId(null);
    }
  }, []);

  const add = (set, id) => new Set(set).add(id);

  return {
    busyId,
    toast,
    stateFor: (o) => ({ saved: saved.has(o.id), rejected: rejected.has(o.id), wornToday: worn.has(o.id) }),
    onSave: (o) => run(o, saveOutfit, () => setSaved((s) => add(s, o.id)), "Saved to your outfits"),
    onNotForMe: (o) => run(o, markNotForMe, () => setRejected((s) => add(s, o.id)), "Got it — we’ll show this pairing less"),
    onWorn: (o) => run(o, markWorn, () => setWorn((s) => add(s, o.id)), "Added to your history"),
  };
}

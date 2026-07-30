// "Selamat datang, Maxi" → erases → "Wilujeng sumping, Maxi" → …
//
// The greeting types itself out, holds, erases, and moves to the next
// language. The name never moves — only the greeting in front of it changes,
// so the sentence stays readable the whole time.
//
// Two things it is careful about:
//   • Reduced motion: no typing at all, the greeting just swaps on a timer.
//   • Screen readers: the block is ONE node with a STABLE label. A per-frame
//     typewriter would otherwise re-announce the header a dozen times a
//     second, which is unusable.

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { greetingRotation, type Greeting } from '@/lib/greeting';

const TYPE_MS = 55; // per character, typing forward
const ERASE_MS = 28; // per character, deleting (faster — erasing is not the point)
const HOLD_MS = 2200; // fully typed, before it starts erasing
const BLINK_MS = 500;
const SWAP_MS = 3600; // reduced-motion: plain swap interval

type Phase = 'typing' | 'holding' | 'erasing';

export type RotatingGreetingProps = {
  /** Buyer's first name, shown after the greeting. */
  name?: string | null;
};

export function RotatingGreeting({ name }: RotatingGreetingProps) {
  const rotation = useRef<Greeting[]>(greetingRotation());
  const [index, setIndex] = useState(0);
  const [len, setLen] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');
  const [cursorOn, setCursorOn] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const list = rotation.current;
  const full = list[index]?.text ?? 'Selamat datang';

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => alive && setReduceMotion(on));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // Reduced motion: skip the typewriter entirely, just rotate the whole word.
  useEffect(() => {
    if (!reduceMotion || list.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % list.length), SWAP_MS);
    return () => clearInterval(id);
  }, [reduceMotion, list.length]);

  // The typewriter itself: one timeout per step, driven by (phase, len).
  useEffect(() => {
    if (reduceMotion) return;

    if (phase === 'typing') {
      if (len < full.length) {
        const id = setTimeout(() => setLen((n) => n + 1), TYPE_MS);
        return () => clearTimeout(id);
      }
      // Only one greeting verified? Type it once and stop — looping a single
      // word forever would just be fidgeting.
      if (list.length <= 1) return;
      const id = setTimeout(() => setPhase('holding'), 0);
      return () => clearTimeout(id);
    }

    if (phase === 'holding') {
      const id = setTimeout(() => setPhase('erasing'), HOLD_MS);
      return () => clearTimeout(id);
    }

    // erasing
    if (len > 0) {
      const id = setTimeout(() => setLen((n) => n - 1), ERASE_MS);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      setIndex((i) => (i + 1) % list.length);
      setPhase('typing');
    }, 0);
    return () => clearTimeout(id);
  }, [phase, len, full.length, list.length, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setCursorOn((on) => !on), BLINK_MS);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const typed = reduceMotion ? full : full.slice(0, len);
  const complete = typed.length === full.length;
  // The name only joins once the greeting is whole — "Selamat data, Maxi"
  // mid-keystroke reads like a bug.
  const tail = name && complete ? `, ${name}` : '';

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="header"
      // Deliberately the FINISHED sentence, never the partial one, and it does
      // not change as the languages rotate.
      accessibilityLabel={name ? `Selamat datang, ${name}` : 'Selamat datang'}>
      <Text variant="title" numberOfLines={2}>
        {typed}
        {!reduceMotion && !complete && cursorOn ? '|' : ''}
        {tail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0 },
});

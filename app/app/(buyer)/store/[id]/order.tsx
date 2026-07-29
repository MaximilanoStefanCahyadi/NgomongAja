import { Feather } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Button, Card, ListState, Row, Screen, ScreenHeader, SectionLabel, Text } from '@/components/ui';
import { formatRupiah } from '@/lib/format';
import { matchOrder, type MatchResult } from '@/lib/matching';
import { parseTranscript } from '@/lib/nlp';
import { setOrderDraft } from '@/lib/order-draft';
import { listActiveProducts } from '@/lib/products';
import { transcribeAudio } from '@/lib/stt';
import { colors, elevation, radius, spacing } from '@/lib/theme';

const MAX_RECORDING_SECONDS = 60;
const WARN_AT_SECONDS = 50; // last 10 seconds: countdown hint

type Phase = 'idle' | 'recording' | 'processing' | 'done' | 'error';

export default function VoiceOrder() {
  const { id: storeId } = useLocalSearchParams<{ id: string }>();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [transcript, setTranscript] = useState('');
  const [results, setResults] = useState<MatchResult[] | null>(null);
  // The audio file survives failures, so "Coba lagi" NEVER makes the user
  // re-speak their whole list (PRD B-2).
  const audioUriRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Soft pulse ring behind the mic circle while recording ("I'm listening").
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;

  const micSize = width <= 360 ? 140 : 160;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    // With reduce-motion on we keep a STATIC ring rather than dropping the
    // signal entirely — "I'm listening" still has to be visible.
    if (phase !== 'recording' || reducedMotion) return;
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(pulse, { toValue: 1.55, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseOpacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
      pulseOpacity.setValue(0.4);
    };
  }, [phase, pulse, pulseOpacity, reducedMotion]);

  const startRecording = async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      // A denied permission used to be a dead end — offer the way out.
      Alert.alert(
        'Izin mikrofon dibutuhkan',
        'Aktifkan izin mikrofon supaya kamu bisa memesan pakai suara.',
        [
          { text: 'Nanti', style: 'cancel' },
          { text: 'Buka Pengaturan', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPhase('recording');
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_RECORDING_SECONDS) stopRecording();
        return s + 1;
      });
    }, 1000);
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    await recorder.stop();
    audioUriRef.current = recorder.uri;
    if (!audioUriRef.current) {
      setPhase('error');
      return;
    }
    await processAudio();
  };

  // Leaving mid-recording throws the take away — ask first.
  const goBack = () => {
    if (phase !== 'recording') {
      router.back();
      return;
    }
    Alert.alert('Berhenti merekam?', 'Rekamanmu akan hilang.', [
      { text: 'Lanjut Merekam', style: 'cancel' },
      {
        text: 'Ya, keluar',
        style: 'destructive',
        onPress: async () => {
          if (timerRef.current) clearInterval(timerRef.current);
          try {
            await recorder.stop();
          } catch {}
          audioUriRef.current = null; // discard the take
          router.back();
        },
      },
    ]);
  };

  // Transcribe → parse → match. Reused as-is by "Coba lagi".
  const processAudio = async () => {
    if (!audioUriRef.current || !storeId) return;
    setPhase('processing');
    try {
      setProcessingStep('Mendengarkan rekamanmu…');
      const text = await transcribeAudio(audioUriRef.current);
      setTranscript(text);
      if (!text) throw new Error('empty transcript');

      setProcessingStep('Memahami pesananmu…');
      const parsed = await parseTranscript(text);

      setProcessingStep('Mencocokkan dengan barang di toko…');
      const products = await listActiveProducts(storeId);
      setResults(matchOrder(parsed.items, products));
      setPhase('done');
    } catch (e: any) {
      console.warn('voice pipeline:', e.message);
      setPhase('error');
    }
  };

  const reset = () => {
    audioUriRef.current = null;
    setTranscript('');
    setResults(null);
    setSeconds(0);
    setPhase('idle');
  };

  const nearLimit = seconds >= WARN_AT_SECONDS;
  const recording = phase === 'recording';

  // ─── Result stage (paper background) ───
  if (phase === 'done' && results) {
    return (
      <Screen
        footer={
          <Button
            label="Lanjut Periksa Pesanan"
            onPress={() => {
              if (!storeId) return;
              setOrderDraft({
                storeId,
                transcript,
                audioUri: audioUriRef.current,
                results,
              });
              router.push({
                pathname: '/(buyer)/store/[id]/review',
                params: { id: storeId },
              });
            }}
          />
        }>
        <ScreenHeader title="Yang kami dengar" backLabel="Kembali" onBack={goBack} />

        <Card tone="success" row style={styles.transcript}>
          <Feather name="mic" size={18} color={colors.successInk} style={styles.transcriptIcon} />
          <Text variant="transcript" color="success" style={styles.transcriptText}>
            &quot;{transcript}&quot;
          </Text>
        </Card>

        <SectionLabel>{`${results.length} barang dikenali`}</SectionLabel>

        <FlatList
          data={results}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.results}
          ListEmptyComponent={
            <ListState
              state="empty"
              icon="mic-off"
              title="Belum ada yang tertangkap"
              message="Kami tidak menangkap pesanan apa pun. Coba rekam ulang ya."
              action={{ label: 'Rekam ulang', onPress: reset }}
            />
          }
          renderItem={({ item: r }) => {
            if (r.kind === 'matched') {
              return (
                <Card padding="sm">
                  <Row
                    title={`${r.product.name} × ${String(r.item.quantity).replace('.', ',')}`}
                    leading={
                      <View style={styles.resultIcon}>
                        <Feather name="check" size={16} color={colors.primaryInk} />
                      </View>
                    }
                    value={formatRupiah(Math.round(r.product.price * r.item.quantity))}
                  />
                </Card>
              );
            }
            const ambiguous = r.kind === 'ambiguous';
            return (
              // One signal: the warn tone supplies the fill AND the left rule.
              // The meta text underneath stays plain, not amber-bold.
              <Card tone="warn" padding="sm">
                <Row
                  title={`"${r.item.name}" × ${String(r.item.quantity).replace('.', ',')}`}
                  meta={
                    ambiguous
                      ? `${r.candidates.length} barang mirip — pilih di langkah berikutnya`
                      : 'Tidak ketemu — bisa dicari manual di langkah berikutnya'
                  }
                  leading={
                    <View style={styles.resultIconWarn}>
                      <Feather
                        name={ambiguous ? 'help-circle' : 'search'}
                        size={16}
                        color={colors.warnInk}
                      />
                    </View>
                  }
                />
              </Card>
            );
          }}
        />

        <Pressable onPress={reset} style={styles.ghost} accessibilityRole="button">
          <Text variant="label" color="secondary" align="center">
            Rekam ulang
          </Text>
        </Pressable>
      </Screen>
    );
  }

  // ─── Green stage: idle / recording / processing / error ───
  return (
    <Screen background="primary" edges={{ top: true, bottom: true }}>
      <ScreenHeader backLabel="Kembali" onBack={goBack} onPrimaryBg />

      {(phase === 'idle' || recording) && (
        <>
          <View style={styles.stageTop}>
            {recording ? (
              <Text
                variant="displayXl"
                color="onPrimary"
                accessibilityLabel={`${seconds} detik`}>
                {String(Math.floor(seconds / 60))}:{String(seconds % 60).padStart(2, '0')}
              </Text>
            ) : (
              <Text variant="display" color="onPrimary" accessibilityRole="header">
                Ngomong Aja
              </Text>
            )}
            <Text
              variant="body"
              color="onPrimarySoft"
              align="center"
              style={styles.hint}
              // Only the "10 seconds left" warning interrupts. The ticking
              // timer must never be a live region or it announces every second.
              accessibilityLiveRegion={nearLimit ? 'assertive' : 'none'}>
              {recording
                ? nearLimit
                  ? `${MAX_RECORDING_SECONDS - seconds} detik lagi…`
                  : 'Sedang mendengarkan… bicara aja'
                : 'Sebutkan pesananmu seperti bicara ke penjual, contohnya: "mau pesen minyak goreng dua liter sama telur setengah kilo"'}
            </Text>
          </View>

          <View style={styles.micArea}>
            {recording &&
              (reducedMotion ? (
                <View
                  style={[
                    styles.staticRing,
                    { width: micSize + 16, height: micSize + 16, borderRadius: radius.pill },
                  ]}
                />
              ) : (
                <Animated.View
                  style={[
                    styles.pulseRing,
                    { width: micSize, height: micSize },
                    { opacity: pulseOpacity, transform: [{ scale: pulse }] },
                  ]}
                />
              ))}
            {/* ONE control for both states. Previously the mic went inert
                during recording while a separate button did the stopping,
                which left a large, obvious, dead affordance on screen. */}
            <Pressable
              onPress={recording ? stopRecording : startRecording}
              style={[styles.mic, { width: micSize, height: micSize }]}
              accessibilityRole="button"
              accessibilityLabel={recording ? 'Selesai bicara' : 'Mulai bicara pesananmu'}
              accessibilityHint={
                recording
                  ? 'Ketuk untuk berhenti merekam dan memproses pesananmu'
                  : 'Ketuk sekali, lalu sebutkan pesananmu. Ketuk lagi untuk berhenti.'
              }
              accessibilityState={{ busy: recording }}>
              <Feather
                name={recording ? 'square' : 'mic'}
                size={recording ? 40 : 48}
                // The mic sits on a cream disc: raw orange would be 2.47:1.
                color={colors.primaryInk}
              />
            </Pressable>
          </View>

          <Text variant="meta" color="onPrimarySoft" align="center" style={styles.footerHint}>
            {recording ? 'Ketuk lagi kalau sudah selesai' : 'Ketuk mikrofon untuk mulai bicara'}
          </Text>
        </>
      )}

      {phase === 'processing' && (
        <View style={styles.stageFill}>
          <ActivityIndicator size="large" color={colors.onPrimary} />
          <Text
            variant="body"
            color="onPrimarySoft"
            align="center"
            accessibilityRole="progressbar"
            accessibilityLiveRegion="polite">
            {processingStep}
          </Text>
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.stageFill}>
          <Feather name="alert-circle" size={40} color={colors.onPrimarySoft} />
          <Text variant="body" color="onPrimarySoft" align="center" style={styles.hint}>
            Ada gangguan saat memproses. Rekamanmu masih tersimpan — tidak perlu mengulang
            bicara.
          </Text>
          <Button label="Coba Lagi" onPress={processAudio} onPrimaryBg fullWidth={false} />
          <Pressable onPress={reset} style={styles.ghost} accessibilityRole="button">
            <Text variant="label" color="onPrimarySoft" align="center">
              Rekam ulang dari awal
            </Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // green stage
  stageTop: { alignItems: 'center', marginTop: spacing.md, gap: spacing.sm },
  stageFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  hint: { maxWidth: 320 },
  footerHint: { marginBottom: spacing.xl },
  micArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mic: {
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    // The single shadow in the whole app, spent on the most important control.
    ...elevation.raised,
  },
  pulseRing: {
    position: 'absolute',
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
  staticRing: {
    position: 'absolute',
    borderWidth: 4,
    borderColor: colors.onPrimarySoft,
  },

  // paper result stage
  transcript: { marginTop: spacing.md, alignItems: 'flex-start' },
  transcriptIcon: { marginTop: 3 },
  transcriptText: { flex: 1, fontStyle: 'italic' },
  results: { gap: spacing.sm, paddingBottom: spacing.md },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconWarn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(122,69,16,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    alignSelf: 'center',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});

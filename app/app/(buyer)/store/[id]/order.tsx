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
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatRupiah } from '@/lib/format';
import { matchOrder, type MatchResult } from '@/lib/matching';
import { parseTranscript } from '@/lib/nlp';
import { setOrderDraft } from '@/lib/order-draft';
import { listActiveProducts } from '@/lib/products';
import { transcribeAudio } from '@/lib/stt';
import { colors, radius, screenWrap, spacing } from '@/lib/theme';

const MAX_RECORDING_SECONDS = 60;
const WARN_AT_SECONDS = 50; // last 10 seconds: red timer + countdown hint

type Phase = 'idle' | 'recording' | 'processing' | 'done' | 'error';

export default function VoiceOrder() {
  const insets = useSafeAreaInsets();
  const { id: storeId } = useLocalSearchParams<{ id: string }>();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [transcript, setTranscript] = useState('');
  const [results, setResults] = useState<MatchResult[] | null>(null);
  // The audio file survives failures, so "Coba lagi" NEVER makes the user
  // re-speak their whole list (PRD B-2).
  const audioUriRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Gentle pulse on the stop button while recording ("I'm listening").
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'recording') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [phase, pulse]);

  const startRecording = async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('NgomongAja', 'Izin mikrofon dibutuhkan untuk memesan pakai suara.');
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

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={goBack} hitSlop={12} style={styles.backWrap}>
        <Text style={styles.back}>‹ Toko</Text>
      </Pressable>
      <Text style={styles.title}>Ngomong Aja 🎤</Text>

      {phase === 'idle' && (
        <View style={styles.center}>
          <Text style={styles.hint}>
            Sebutkan pesananmu seperti bicara ke penjual, contohnya:{'\n'}
            "mau pesen minyak goreng dua liter sama telur setengah kilo"
          </Text>
          <Pressable
            style={styles.recordButton}
            onPress={startRecording}
            accessibilityRole="button"
            accessibilityLabel="Mulai bicara">
            <Text style={styles.recordButtonText}>🎤{'\n'}Mulai Bicara</Text>
          </Pressable>
        </View>
      )}

      {phase === 'recording' && (
        <View style={styles.center}>
          <Text style={[styles.timer, nearLimit && styles.timerWarn]}>
            {String(Math.floor(seconds / 60)).padStart(1, '0')}:
            {String(seconds % 60).padStart(2, '0')} / 1:00
          </Text>
          {nearLimit ? (
            <Text style={styles.timeLeftWarn}>
              ⏰ {MAX_RECORDING_SECONDS - seconds} detik lagi…
            </Text>
          ) : (
            <Text style={styles.hint}>Sedang merekam… bicara yang jelas ya.</Text>
          )}
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <Pressable
              style={[styles.recordButton, styles.stopButton]}
              onPress={stopRecording}
              accessibilityRole="button"
              accessibilityLabel="Selesai merekam">
              <Text style={styles.recordButtonText}>⏹{'\n'}Selesai</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {phase === 'processing' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.hint}>{processingStep}</Text>
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.center}>
          <Text style={styles.hint}>
            Ada gangguan saat memproses. Rekamanmu masih tersimpan — tidak perlu
            mengulang bicara.
          </Text>
          <Pressable style={styles.button} onPress={processAudio}>
            <Text style={styles.buttonText}>Coba Lagi</Text>
          </Pressable>
          <Pressable onPress={reset} hitSlop={12} style={styles.linkWrap}>
            <Text style={styles.linkText}>Rekam ulang dari awal</Text>
          </Pressable>
        </View>
      )}

      {phase === 'done' && results && (
        <View style={{ flex: 1 }}>
          <Text style={styles.transcriptLabel}>Yang kami dengar:</Text>
          <Text style={styles.transcript}>"{transcript}"</Text>

          <FlatList
            data={results}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
            ListEmptyComponent={
              <Text style={styles.hint}>
                Kami tidak menangkap pesanan apa pun. Coba rekam ulang ya.
              </Text>
            }
            renderItem={({ item: r }) => (
              <View style={styles.resultRow}>
                {r.kind === 'matched' && (
                  <>
                    <Text style={styles.resultIcon}>✅</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>
                        {r.product.name} × {r.item.quantity}
                      </Text>
                      <Text style={styles.resultMeta}>{formatRupiah(r.product.price)}</Text>
                    </View>
                  </>
                )}
                {r.kind === 'ambiguous' && (
                  <>
                    <Text style={styles.resultIcon}>🤔</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>
                        "{r.item.name}" × {r.item.quantity}
                      </Text>
                      <Text style={styles.resultMeta}>
                        {r.candidates.length} barang mirip — pilih di langkah berikutnya
                      </Text>
                    </View>
                  </>
                )}
                {r.kind === 'unmatched' && (
                  <>
                    <Text style={styles.resultIcon}>❓</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>"{r.item.name}"</Text>
                      <Text style={styles.resultMeta}>
                        Tidak ketemu — bisa dicari manual di langkah berikutnya
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}
          />

          <Pressable
            style={styles.button}
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
            }}>
            <Text style={styles.buttonText}>Lanjut Periksa Pesanan</Text>
          </Pressable>
          <Pressable onPress={reset} hitSlop={12} style={styles.linkWrap}>
            <Text style={styles.linkText}>Rekam ulang</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...screenWrap },
  backWrap: { alignSelf: 'flex-start', paddingVertical: 12 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: spacing.sm, color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  hint: { fontSize: 15, color: colors.body, textAlign: 'center', lineHeight: 22 },
  timer: {
    fontSize: 40,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  timerWarn: { color: colors.danger },
  timeLeftWarn: { fontSize: 16, fontWeight: '700', color: colors.danger },
  recordButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: { backgroundColor: colors.danger },
  recordButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  transcriptLabel: { fontSize: 13, color: colors.secondary },
  transcript: { fontSize: 15, fontStyle: 'italic', marginTop: 4, color: colors.text },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  resultIcon: { fontSize: 20 },
  resultName: { fontSize: 15, fontWeight: '500', color: colors.text },
  resultMeta: { fontSize: 13, color: colors.body, marginTop: 2 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  linkWrap: { alignSelf: 'center', paddingVertical: 12 },
  linkText: { textAlign: 'center', color: colors.body, fontSize: 14 },
});

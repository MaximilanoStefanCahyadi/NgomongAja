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
import { colors, fonts, radius, screenWrap } from '@/lib/theme';

const MAX_RECORDING_SECONDS = 60;
const WARN_AT_SECONDS = 50; // last 10 seconds: countdown hint

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
  // Soft pulse ring behind the mic circle while recording ("I'm listening").
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'recording') return;
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
  }, [phase, pulse, pulseOpacity]);

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
  const onGreen = phase !== 'done';

  // ─── Result screen (paper background) ───
  if (phase === 'done' && results) {
    return (
      <View style={[styles.paperContainer, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.backWrap}>
          <Feather name="chevron-left" size={18} color={colors.primaryDark} />
          <Text style={styles.backPaper}>Kembali</Text>
        </Pressable>
        <Text style={styles.resultTitle}>Yang kami dengar</Text>

        <View style={styles.transcriptBubble}>
          <Feather name="mic" size={20} color={colors.primaryDark} style={{ marginTop: 2 }} />
          <Text style={styles.transcriptText}>"{transcript}"</Text>
        </View>

        <Text style={styles.sectionLabel}>
          {results.length} barang dikenali
        </Text>
        <FlatList
          data={results}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
          ListEmptyComponent={
            <Text style={styles.hintPaper}>
              Kami tidak menangkap pesanan apa pun. Coba rekam ulang ya.
            </Text>
          }
          renderItem={({ item: r }) => {
            if (r.kind === 'matched') {
              return (
                <View style={styles.resultCard}>
                  <View style={[styles.resultIcon, { backgroundColor: colors.primaryChipBg }]}>
                    <Feather name="check" size={17} color={colors.primaryDeep} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>
                      {r.product.name} × {String(r.item.quantity).replace('.', ',')}
                    </Text>
                    <Text style={styles.resultPrice}>
                      {formatRupiah(Math.round(r.product.price * r.item.quantity))}
                    </Text>
                  </View>
                </View>
              );
            }
            const ambiguous = r.kind === 'ambiguous';
            return (
              <View style={[styles.resultCard, styles.resultCardWarn]}>
                <View style={[styles.resultIcon, { backgroundColor: colors.amberBorder }]}>
                  <Feather
                    name={ambiguous ? 'help-circle' : 'search'}
                    size={17}
                    color={colors.sunnyText}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>
                    "{r.item.name}" × {String(r.item.quantity).replace('.', ',')}
                  </Text>
                  <Text style={styles.resultWarnMeta}>
                    {ambiguous
                      ? `${r.candidates.length} barang mirip — pilih di langkah berikutnya`
                      : 'Tidak ketemu — bisa dicari manual di langkah berikutnya'}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
          accessibilityRole="button"
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
          <Text style={styles.primaryBtnText}>Lanjut Periksa Pesanan</Text>
        </Pressable>
        <Pressable onPress={reset} hitSlop={12} style={styles.ghostWrap}>
          <Text style={styles.ghostPaper}>Rekam ulang</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Green screens: idle / recording / processing / error ───
  return (
    <View style={[styles.greenContainer, { paddingTop: insets.top + 16 }]}>
      <Pressable onPress={goBack} hitSlop={12} style={styles.backWrap}>
        <Feather name="chevron-left" size={18} color="#eef2e4" />
        <Text style={styles.backGreen}>Kembali</Text>
      </Pressable>

      {phase === 'idle' && (
        <>
          <View style={styles.greenCenterTop}>
            <Text style={styles.greenTitle}>Ngomong Aja</Text>
            <Text style={styles.greenHint}>
              Sebutkan pesananmu seperti bicara ke penjual, contohnya:{'\n'}"mau pesen minyak
              goreng dua liter sama telur setengah kilo"
            </Text>
          </View>
          <View style={styles.micArea}>
            <Pressable
              style={styles.micCircle}
              onPress={startRecording}
              accessibilityRole="button"
              accessibilityLabel="Mulai bicara">
              <Feather name="mic" size={50} color={colors.primaryDark} />
            </Pressable>
          </View>
          <Text style={styles.greenHintSmall}>Ketuk mikrofon untuk mulai bicara</Text>
          <View style={{ height: 58 }} />
        </>
      )}

      {phase === 'recording' && (
        <>
          <View style={styles.greenCenterTop}>
            <Text style={styles.timer}>
              {String(Math.floor(seconds / 60))}:{String(seconds % 60).padStart(2, '0')}
            </Text>
            <Text style={styles.greenHint}>
              {nearLimit
                ? `${MAX_RECORDING_SECONDS - seconds} detik lagi…`
                : 'Sedang mendengarkan… bicara aja'}
            </Text>
          </View>
          <View style={styles.micArea}>
            <Animated.View
              style={[
                styles.pulseRing,
                { opacity: pulseOpacity, transform: [{ scale: pulse }] },
              ]}
            />
            <View style={styles.micCircle}>
              <Feather name="mic" size={50} color={colors.primaryDark} />
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.stopBtn, pressed && { opacity: 0.85 }]}
            onPress={stopRecording}
            accessibilityRole="button"
            accessibilityLabel="Selesai merekam">
            <Feather name="square" size={17} color={colors.primaryDeep} />
            <Text style={styles.stopBtnText}>Selesai Bicara</Text>
          </Pressable>
        </>
      )}

      {phase === 'processing' && (
        <View style={styles.greenCenterFill}>
          <ActivityIndicator size="large" color={colors.onPrimary} />
          <Text style={styles.greenHint}>{processingStep}</Text>
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.greenCenterFill}>
          <Text style={styles.greenHint}>
            Ada gangguan saat memproses. Rekamanmu masih tersimpan — tidak perlu mengulang
            bicara.
          </Text>
          <Pressable style={styles.stopBtn} onPress={processAudio} accessibilityRole="button">
            <Text style={styles.stopBtnText}>Coba Lagi</Text>
          </Pressable>
          <Pressable onPress={reset} hitSlop={12} style={styles.ghostWrap}>
            <Text style={styles.ghostGreen}>Rekam ulang dari awal</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // green stage
  greenContainer: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 28,
  },
  backWrap: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backGreen: { color: '#eef2e4', fontSize: 15, fontFamily: fonts.bodySemi },
  backPaper: { color: colors.primaryDark, fontSize: 15, fontFamily: fonts.bodySemi },
  greenCenterTop: { alignItems: 'center', marginTop: 20, gap: 10 },
  greenCenterFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  greenTitle: { fontFamily: fonts.heading, fontSize: 34, color: colors.onPrimary },
  timer: {
    fontFamily: fonts.heading,
    fontSize: 52,
    color: colors.onPrimary,
    fontVariant: ['tabular-nums'],
  },
  greenHint: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: '#eef2e4',
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 300,
  },
  greenHintSmall: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#eef2e4',
    textAlign: 'center',
  },
  micArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
  micCircle: {
    width: 148,
    height: 148,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#03210f',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  stopBtn: {
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stopBtnText: { color: colors.primaryDeep, fontSize: 19, fontFamily: fonts.heading },
  ghostWrap: { alignSelf: 'center', paddingVertical: 12 },
  ghostGreen: { fontFamily: fonts.bodySemi, color: '#eef2e4', fontSize: 14 },
  ghostPaper: { fontFamily: fonts.bodySemi, color: colors.secondary, fontSize: 14 },

  // paper result stage
  paperContainer: { ...screenWrap },
  resultTitle: { fontFamily: fonts.heading, fontSize: 28, color: colors.text, marginTop: 6 },
  transcriptBubble: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.primaryChipBg,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 14,
  },
  transcriptText: {
    flex: 1,
    fontFamily: fonts.body,
    fontStyle: 'italic',
    fontSize: 14.5,
    lineHeight: 22,
    color: '#032b13',
  },
  sectionLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.secondary,
    marginTop: 22,
  },
  hintPaper: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.body,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 20,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
  },
  resultCardWarn: { backgroundColor: colors.amberBg },
  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  resultPrice: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.primaryDark,
    marginTop: 2,
  },
  resultWarnMeta: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.sunnyText,
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: 16,
    alignItems: 'center',
  },
  primaryBtnPressed: { backgroundColor: colors.primaryDark },
  primaryBtnText: { color: colors.onPrimary, fontSize: 17, fontFamily: fonts.heading },
});

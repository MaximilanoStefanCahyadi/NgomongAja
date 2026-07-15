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
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatRupiah } from '@/lib/format';
import { matchOrder, type MatchResult } from '@/lib/matching';
import { parseTranscript } from '@/lib/nlp';
import { setOrderDraft } from '@/lib/order-draft';
import { listActiveProducts } from '@/lib/products';
import { transcribeAudio } from '@/lib/stt';

const MAX_RECORDING_SECONDS = 60;

type Phase = 'idle' | 'recording' | 'processing' | 'done' | 'error';

export default function VoiceOrder() {
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Kembali</Text>
      </Pressable>
      <Text style={styles.title}>Ngomong Aja 🎤</Text>

      {phase === 'idle' && (
        <View style={styles.center}>
          <Text style={styles.hint}>
            Sebutkan pesananmu seperti bicara ke penjual, contohnya:{'\n'}
            "mau pesen minyak goreng dua liter sama telur setengah kilo"
          </Text>
          <Pressable style={styles.recordButton} onPress={startRecording}>
            <Text style={styles.recordButtonText}>🎤{'\n'}Mulai Bicara</Text>
          </Pressable>
        </View>
      )}

      {phase === 'recording' && (
        <View style={styles.center}>
          <Text style={styles.timer}>
            {String(Math.floor(seconds / 60)).padStart(1, '0')}:
            {String(seconds % 60).padStart(2, '0')} / 1:00
          </Text>
          <Text style={styles.hint}>Sedang merekam… bicara yang jelas ya.</Text>
          <Pressable style={[styles.recordButton, styles.stopButton]} onPress={stopRecording}>
            <Text style={styles.recordButtonText}>⏹{'\n'}Selesai</Text>
          </Pressable>
        </View>
      )}

      {phase === 'processing' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
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
          <Pressable onPress={reset}>
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
          <Pressable onPress={reset}>
            <Text style={styles.linkText}>Rekam ulang</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64 },
  back: { color: '#16a34a', fontSize: 16, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  hint: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22 },
  timer: { fontSize: 40, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  recordButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: { backgroundColor: '#dc2626' },
  recordButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  transcriptLabel: { fontSize: 13, color: '#777' },
  transcript: { fontSize: 15, fontStyle: 'italic', marginTop: 4 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 12,
  },
  resultIcon: { fontSize: 20 },
  resultName: { fontSize: 15, fontWeight: '500' },
  resultMeta: { fontSize: 13, color: '#777', marginTop: 2 },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkText: { textAlign: 'center', color: '#666', marginTop: 12, fontSize: 14 },
});

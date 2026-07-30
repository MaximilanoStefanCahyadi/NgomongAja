import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Field, ListState, Row, Screen, Text } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { searchStores, type Store } from '@/lib/stores';
import { colors, radius, spacing } from '@/lib/theme';

export default function SearchStores() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Store[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Debounced so typing "warung bu rina" is one query, not fourteen.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against an older, slower response overwriting a newer one.
  const seq = useRef(0);

  const run = useCallback(async (q: string) => {
    const mine = ++seq.current;
    if (!q.trim()) {
      setResults(null);
      setError(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const found = await searchStores(q);
      if (mine === seq.current) {
        setResults(found);
        setError(null);
      }
    } catch (e) {
      if (mine === seq.current) setError(friendlyError(e));
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(query), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, run]);

  return (
    <Screen keyboard contentContainerStyle={styles.page}>
      <Text variant="display" accessibilityRole="header" style={styles.title}>
        Cari warung
      </Text>

      <Field
        placeholder="Nama warung, misal: Bu Rina"
        leftIcon="search"
        autoCapitalize="none"
        accessibilityLabel="Cari warung"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
      />

      {error ? (
        <ListState state="error" message={error} action={{ label: 'Coba Lagi', onPress: () => run(query) }} />
      ) : busy ? (
        <ListState state="loading" message="Mencari…" />
      ) : results === null ? (
        <ListState
          state="empty"
          icon="search"
          title="Mau cari warung apa?"
          message="Ketik nama warungnya di atas."
        />
      ) : results.length === 0 ? (
        <ListState
          state="empty"
          icon="search"
          title="Nggak ketemu"
          message={`Belum ada warung bernama "${query.trim()}". Coba nama lain ya.`}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(s) => s.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Row
              title={item.name}
              meta={item.description ?? undefined}
              onPress={() =>
                router.push({ pathname: '/(buyer)/store/[id]', params: { id: item.id } })
              }
              leading={
                <View style={styles.tile}>
                  <Feather name="shopping-bag" size={18} color={colors.primaryInk} />
                </View>
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.md },
  title: { marginBottom: spacing.xs },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

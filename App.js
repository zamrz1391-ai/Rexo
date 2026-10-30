// V2Rexo — صفحه اصلی
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { buildXrayConfig } from './src/XrayConfigBuilder';
import { connect, disconnect, subscribeState } from './src/VpnEngine';

const STORAGE_KEY = 'v2rexo.configs';
const COLORS = {
  bg: '#0b1020', card: '#141a2e', accent: '#6c5ce7', accent2: '#00cec9',
  text: '#eef1f8', muted: '#8a94b8', green: '#00b894', red: '#e17055',
};

export default function App() {
  const [input, setInput] = useState('');
  const [configs, setConfigs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [state, setState] = useState('disconnected');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(STORAGE_KEY);
        if (saved) setConfigs(JSON.parse(saved));
      } catch (e) {}
    })();
    const unsub = subscribeState((s) => {
      if (s) setState(typeof s === 'string' ? s.toLowerCase() : 'connected');
    });
    return unsub;
  }, []);

  const persist = async (list) => {
    setConfigs(list);
    try { await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
  };

  const addConfig = useCallback(async () => {
    if (!input.trim()) return;
    try {
      buildXrayConfig(input);
      const item = {
        id: String(Date.now()),
        link: input.trim(),
        name: 'کانفیگ ' + (configs.length + 1),
        createdAt: Date.now(),
      };
      const exists = configs.find((c) => c.link === item.link);
      if (exists) { Alert.alert('تکراری', 'این کانفیگ قبلاً اضافه شده'); return; }
      await persist([...configs, item]);
      setInput('');
      Alert.alert('✅', 'کانفیگ اضافه شد');
    } catch (e) {
      Alert.alert('خطا', e.message || 'لینک نامعتبر است');
    }
  }, [input, configs]);

  const toggleConnection = async (item) => {
    if (state === 'connected' && activeId === item.id) {
      setBusy(true);
      try {
        await disconnect();
        setActiveId(null);
        setState('disconnected');
      } catch (e) { Alert.alert('خطا', e.message); }
      setBusy(false);
      return;
    }
    setBusy(true);
    setState('connecting');
    try {
      const json = buildXrayConfig(item.link);
      await connect(json);
      setActiveId(item.id);
      setState('connected');
    } catch (e) {
      setState('disconnected');
      setActiveId(null);
      Alert.alert('اتصال ناموفق', e.message || 'مشکل در برقراری اتصال');
    }
    setBusy(false);
  };

  const removeConfig = async (id) => {
    const list = configs.filter((c) => c.id !== id);
    await persist(list);
    if (activeId === id) {
      try { await disconnect(); } catch (e) {}
      setActiveId(null);
      setState('disconnected');
    }
  };

  const stateColor = state === 'connected' ? COLORS.green : state === 'connecting' ? COLORS.accent2 : COLORS.red;
  const stateLabel = state === 'connected' ? 'متصل' : state === 'connecting' ? 'در حال اتصال…' : 'قطع';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <SafeAreaView style={styles.root}>
        <Text style={styles.logo}>V2Rexo</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: stateColor }]} />
          <Text style={[styles.stateText, { color: stateColor }]}>{stateLabel}</Text>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="لینک کانفیگ را اینجا بچسبانید (vless:// …)"
            placeholderTextColor={COLORS.muted}
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
          <TouchableOpacity style={styles.addBtn} onPress={addConfig} disabled={busy}>
            <Text style={styles.addBtnText}>+ افزودن</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={configs}
          keyExtractor={(i) => i.id}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardMeta}>{item.link.slice(0, 40)}…</Text>
              </View>
              {busy && activeId === item.id ? (
                <ActivityIndicator color={COLORS.accent} />
              ) : (
                <TouchableOpacity
                  style={[styles.btn, activeId === item.id && state === 'connected' && styles.btnOn]}
                  onPress={() => toggleConnection(item)}
                >
                  <Text style={styles.btnText}>
                    {activeId === item.id && state === 'connected' ? 'قطع' : 'اتصال'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => removeConfig(item.id)} style={styles.delBtn}>
                <Text style={styles.delText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>هنوز کانفیگی اضافه نکرده‌اید. لینک vless / vmess / trojan / ss را وارد کنید.</Text>
          }
        />

        <Text style={styles.footer}>
          V2Rexo • موتور Xray • اندروید: VpnService — iOS: Network Extension
        </Text>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 18, paddingTop: 10 },
  logo: { fontSize: 32, fontWeight: '900', color: COLORS.accent, textAlign: 'center', letterSpacing: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  stateText: { fontSize: 16, fontWeight: '700' },
  inputRow: { marginBottom: 12 },
  input: {
    backgroundColor: COLORS.card, borderRadius: 14, color: COLORS.text,
    padding: 14, minHeight: 70, textAlignVertical: 'top', fontSize: 14, marginBottom: 10,
  },
  addBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  cardName: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
  cardMeta: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  btn: { backgroundColor: COLORS.accent, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  btnOn: { backgroundColor: COLORS.green },
  btnText: { color: '#fff', fontWeight: '700' },
  delBtn: { marginLeft: 10, padding: 6 },
  delText: { color: COLORS.red, fontSize: 16 },
  empty: { color: COLORS.muted, textAlign: 'center', marginTop: 40, paddingHorizontal: 20, lineHeight: 22 },
  footer: { color: COLORS.muted, fontSize: 11, textAlign: 'center', paddingVertical: 10 },
});

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  StatusBar,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { buildXrayConfig } from './XrayConfigBuilder';
import { connect, disconnect, subscribeState } from './src/VpnEngine';

const STORAGE_KEY = 'v2rexo.configs';

const C = {
  bg: '#090A10',
  panel: '#12131D',
  panel2: '#191A27',
  purple: '#8857FF',
  purpleLight: '#A98BFF',
  purpleDark: '#38216F',
  white: '#F7F5FF',
  muted: '#85849A',
  green: '#36D6A0',
  red: '#FF647C',
  border: '#252536',
};

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
};

export default function App() {
  const [input, setInput] = useState('');
  const [configs, setConfigs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [state, setState] = useState('disconnected');
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.25)).current;
  const connectedAt = useRef(null);

  const connected = state === 'connected';
  const connecting = state === 'connecting';

  // Load saved configurations
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(STORAGE_KEY);
        if (saved && mounted) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setConfigs(parsed);
            if (parsed.length) setSelectedId(parsed[0].id);
          }
        }
      } catch (e) {
        console.log('Config loading error:', e);
      }
    })();

    const unsubscribe = subscribeState((s) => {
      if (!mounted || !s) return;

      const next = typeof s === 'string'
        ? s.toLowerCase()
        : 'connected';

      setState(next);

      if (next === 'connected') {
        if (!connectedAt.current) connectedAt.current = Date.now();
      } else if (next === 'disconnected') {
        connectedAt.current = null;
        setElapsed(0);
      }
    });

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Save configurations
  const persist = async (list) => {
    setConfigs(list);
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      Alert.alert('خطا', 'ذخیره کانفیگ انجام نشد');
    }
  };

  // Connection timer
  useEffect(() => {
    if (!connected) return;

    const timer = setInterval(() => {
      if (connectedAt.current) {
        setElapsed(Math.floor((Date.now() - connectedAt.current) / 1000));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [connected]);

  // Connection animations
  useEffect(() => {
    if (connected || connecting) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.07,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      const glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 0.8,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.25,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );

      animation.start();
      glowAnimation.start();

      return () => {
        animation.stop();
        glowAnimation.stop();
      };
    }

    pulse.setValue(1);
    glow.setValue(0.25);
  }, [connected, connecting]);

  const addConfig = useCallback(async () => {
    const link = input.trim();

    if (!link) {
      Alert.alert('لینک خالی است', 'ابتدا لینک کانفیگ را وارد کن.');
      return;
    }

    try {
      buildXrayConfig(link);

      const exists = configs.some(c => c.link === link);

      if (exists) {
        Alert.alert('کانفیگ تکراری', 'این کانفیگ قبلاً اضافه شده است.');
        return;
      }

      const item = {
        id: String(Date.now()),
        link,
        name: 'کانفیگ ' + (configs.length + 1),
        createdAt: Date.now(),
      };

      await persist([...configs, item]);
      setSelectedId(item.id);
      setInput('');
      setShowAdd(false);

      Alert.alert('موفق', 'کانفیگ با موفقیت اضافه شد.');
    } catch (e) {
      Alert.alert('لینک نامعتبر', e.message || 'فرمت کانفیگ قابل شناسایی نیست.');
    }
  }, [input, configs]);

  const toggleConnection = async () => {
    if (busy) return;

    if (connected) {
      setBusy(true);
      try {
        await disconnect();
        setActiveId(null);
        setState('disconnected');
        connectedAt.current = null;
        setElapsed(0);
      } catch (e) {
        Alert.alert('خطا در قطع اتصال', e.message || 'عملیات ناموفق بود');
      } finally {
        setBusy(false);
      }
      return;
    }

    const selected = configs.find(c => c.id === selectedId);

    if (!selected) {
      if (!configs.length) {
        setShowAdd(true);
        Alert.alert('کانفیگی وجود ندارد', 'ابتدا یک کانفیگ اضافه کن.');
      } else {
        Alert.alert('انتخاب کانفیگ', 'ابتدا کانفیگ موردنظرت را انتخاب کن.');
      }
      return;
    }

    setBusy(true);
    setState('connecting');

    try {
      const json = buildXrayConfig(selected.link);
      await connect(json);

      setActiveId(selected.id);
      setState('connected');
      connectedAt.current = Date.now();
      setElapsed(0);
    } catch (e) {
      setActiveId(null);
      setState('disconnected');
      connectedAt.current = null;

      Alert.alert(
        'اتصال برقرار نشد',
        e.message || 'اتصال به سرور ناموفق بود.'
      );
    } finally {
      setBusy(false);
    }
  };

  const removeConfig = (id) => {
    Alert.alert(
      'حذف کانفیگ',
      'از حذف این کانفیگ مطمئنی؟',
      [
        { text: 'انصراف', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            if (activeId === id) {
              try {
                await disconnect();
              } catch (e) {}
              setActiveId(null);
              setState('disconnected');
              connectedAt.current = null;
              setElapsed(0);
            }

            const list = configs.filter(c => c.id !== id);
            await persist(list);

            if (selectedId === id) {
              setSelectedId(list.length ? list[0].id : null);
            }
          },
        },
      ]
    );
  };

  const selectedConfig = configs.find(c => c.id === selectedId);

  const statusColor = connected
    ? C.green
    : connecting
      ? C.purpleLight
      : C.muted;

  const statusText = connected
    ? 'اتصال برقرار است'
    : connecting
      ? 'در حال برقراری اتصال'
      : 'آماده اتصال';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.root}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >

          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>V2<Text style={styles.brandAccent}>Rexo</Text></Text>
              <Text style={styles.brandCaption}>SECURE CONNECTION</Text>
            </View>

            <View style={styles.headerBadge}>
              <View style={styles.headerDot} />
              <Text style={styles.headerBadgeText}>VPN CLIENT</Text>
            </View>
          </View>

          {/* WELCOME */}
          <View style={styles.welcome}>
            <Text style={styles.welcomeTitle}>
              {connected ? 'اتصال شما فعاله!' : 'آماده اتصال هستی؟'}
            </Text>
            <Text style={styles.welcomeSub}>
              {connected
                ? 'اتصال امن شما برقرار شده است.'
                : 'به دنیای امن و آزاد V2Rexo خوش آمدی.'}
            </Text>
          </View>

          {/* CONNECTION AREA */}
          <View style={styles.connectionArea}>
            <Animated.View
              style={[
                styles.outerGlow,
                {
                  opacity: glow,
                  transform: [{ scale: pulse }],
                  backgroundColor: connected ? C.green : C.purple,
                },
              ]}
            />

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={toggleConnection}
              disabled={busy}
              style={styles.connectButton}
            >
              <Animated.View
                style={[
                  styles.connectInner,
                  { transform: [{ scale: pulse }] },
                  connected && styles.connectInnerOn,
                ]}
              >
                {busy || connecting ? (
                  <ActivityIndicator size="large" color="#FFFFFF" />
                ) : (
                  <Text style={styles.powerIcon}>⏻</Text>
                )}
                <Text style={styles.connectButtonLabel}>
                  {connected ? 'قطع اتصال' : connecting ? 'لطفاً صبر کن' : 'اتصال'}
                </Text>
              </Animated.View>
            </TouchableOpacity>

            <View style={styles.statusLine}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusText}
              </Text>
            </View>

            <Text style={styles.timerLabel}>مدت زمان اتصال</Text>
            <Text style={styles.timer}>{formatTime(elapsed)}</Text>
          </View>

          {/* SELECTED SERVER */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>سرور انتخاب‌شده</Text>
            <Text style={styles.sectionHint}>SERVER</Text>
          </View>

          <View style={styles.serverCard}>
            <View style={styles.serverIcon}>
              <Text style={styles.serverIconText}>⌁</Text>
            </View>

            <View style={styles.serverInfo}>
              <Text style={styles.serverName} numberOfLines={1}>
                {selectedConfig ? selectedConfig.name : 'سروری انتخاب نشده'}
              </Text>
              <Text style={styles.serverSub}>
                {selectedConfig ? 'کانفیگ آماده استفاده' : 'یک کانفیگ انتخاب کن'}
              </Text>
            </View>

            <View style={styles.pingBox}>
              <Text style={styles.pingValue}>--</Text>
              <Text style={styles.pingLabel}>PING</Text>
            </View>
          </View>

          {/* TRAFFIC */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>آمار اتصال</Text>
            <Text style={styles.sectionHint}>TRAFFIC</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>↓</Text>
              <Text style={styles.statTitle}>دریافت</Text>
              <Text style={styles.statValue}>--</Text>
              <Text style={styles.statUnit}>دانلود</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statIcon}>↑</Text>
              <Text style={styles.statTitle}>ارسال</Text>
              <Text style={styles.statValue}>--</Text>
              <Text style={styles.statUnit}>آپلود</Text>
            </View>
          </View>

          {/* CONFIGURATIONS */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>کانفیگ‌های من</Text>
            <Text style={styles.configCount}>{configs.length} کانفیگ</Text>
          </View>

          <TouchableOpacity
            style={styles.addNewButton}
            onPress={() => setShowAdd(!showAdd)}
          >
            <Text style={styles.addNewPlus}>＋</Text>
            <Text style={styles.addNewText}>
              {showAdd ? 'بستن بخش افزودن' : 'افزودن کانفیگ جدید'}
            </Text>
          </TouchableOpacity>

          {showAdd && (
            <View style={styles.addPanel}>
              <Text style={styles.addPanelTitle}>وارد کردن کانفیگ</Text>

              <TextInput
                style={styles.input}
                placeholder="لینک vless:// یا vmess:// و ..."
                placeholderTextColor={C.muted}
                value={input}
                onChangeText={setInput}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={styles.submitButton}
                onPress={addConfig}
                disabled={busy}
              >
                <Text style={styles.submitText}>ذخیره کانفیگ</Text>
              </TouchableOpacity>
            </View>
          )}

          {configs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>⌁</Text>
              <Text style={styles.emptyTitle}>هنوز کانفیگی نداری</Text>
              <Text style={styles.emptyText}>
                برای شروع، لینک کانفیگ VPN خودت رو اضافه کن.
              </Text>
            </View>
          ) : (
            configs.map((item) => {
              const isSelected = selectedId === item.id;
              const isActive = activeId === item.id && connected;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.85}
                  style={[
                    styles.configCard,
                    isSelected && styles.configCardSelected,
                  ]}
                  onPress={() => {
                    if (connected && activeId !== item.id) {
                      Alert.alert(
                        'اتصال فعال',
                        'برای تغییر کانفیگ، ابتدا اتصال فعلی را قطع کن.'
                      );
                      return;
                    }
                    setSelectedId(item.id);
                  }}
                >
                  <View style={styles.configCheck}>
                    <View style={[
                      styles.radio,
                      isSelected && styles.radioSelected,
                    ]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </View>

                  <View style={styles.configInfo}>
                    <Text style={styles.configName}>{item.name}</Text>
                    <Text style={styles.configMeta}>
                      {isActive ? 'متصل' : isSelected ? 'انتخاب‌شده' : 'آماده اتصال'}
                    </Text>
                  </View>

                  {isActive && (
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>ACTIVE</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => removeConfig(item.id)}
                  >
                    <Text style={styles.deleteText}>×</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerBrand}>V2Rexo</Text>
            <Text style={styles.footerText}>POWERED BY XRAY ENGINE</Text>
            <Text style={styles.footerVersion}>SECURE • PRIVATE • FAST</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 35,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  brand: {
    color: C.white,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandAccent: {
    color: C.purpleLight,
  },
  brandCaption: {
    color: C.muted,
    fontSize: 9,
    letterSpacing: 3,
    marginTop: 2,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.panel2,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
    marginRight: 7,
  },
  headerBadgeText: {
    color: C.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  welcome: {
    alignItems: 'center',
    marginBottom: 12,
  },
  welcomeTitle: {
    color: C.white,
    fontSize: 21,
    fontWeight: '800',
  },
  welcomeSub: {
    color: C.muted,
    fontSize: 12,
    marginTop: 8,
  },

  connectionArea: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 310,
    marginBottom: 12,
  },
  outerGlow: {
    position: 'absolute',
    width: 205,
    height: 205,
    borderRadius: 110,
  },
  connectButton: {
    width: 174,
    height: 174,
    borderRadius: 90,
    backgroundColor: '#21153F',
    borderWidth: 2,
    borderColor: '#7950D9',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 15,
    shadowColor: C.purple,
    shadowOpacity: 0.45,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 0 },
  },
  connectInner: {
    width: 150,
    height: 150,
    borderRadius: 80,
    backgroundColor: '#38216F',
    borderWidth: 1,
    borderColor: '#A184FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectInnerOn: {
    backgroundColor: '#145B4C',
    borderColor: C.green,
  },
  powerIcon: {
    color: C.white,
    fontSize: 62,
    fontWeight: '300',
    lineHeight: 72,
  },
  connectButtonLabel: {
    color: C.white,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  timerLabel: {
    color: C.muted,
    fontSize: 11,
    marginTop: 13,
  },
  timer: {
    color: C.white,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 19,
    marginBottom: 11,
  },
  sectionTitle: {
    color: C.white,
    fontSize: 15,
    fontWeight: '800',
  },
  sectionHint: {
    color: C.muted,
    fontSize: 9,
    letterSpacing: 2,
  },

  serverCard: {
    backgroundColor: C.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: '#281B4B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverIconText: {
    color: C.purpleLight,
    fontSize: 28,
    fontWeight: '900',
  },
  serverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  serverName: {
    color: C.white,
    fontSize: 14,
    fontWeight: '800',
  },
  serverSub: {
    color: C.muted,
    fontSize: 10,
    marginTop: 5,
  },
  pingBox: {
    alignItems: 'center',
    backgroundColor: C.panel2,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  pingValue: {
    color: C.green,
    fontSize: 16,
    fontWeight: '900',
  },
  pingLabel: {
    color: C.muted,
    fontSize: 8,
    letterSpacing: 1,
    marginTop: 2,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.panel,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.border,
    padding: 15,
  },
  statIcon: {
    color: C.purpleLight,
    fontSize: 23,
    fontWeight: '900',
  },
  statTitle: {
    color: C.muted,
    fontSize: 11,
    marginTop: 7,
  },
  statValue: {
    color: C.white,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 5,
  },
  statUnit: {
    color: C.muted,
    fontSize: 10,
    marginTop: 2,
  },

  configCount: {
    color: C.purpleLight,
    fontSize: 11,
    fontWeight: '700',
  },
  addNewButton: {
    backgroundColor: '#21163C',
    borderWidth: 1,
    borderColor: '#5739A0',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  addNewPlus: {
    color: C.purpleLight,
    fontSize: 21,
    marginRight: 8,
  },
  addNewText: {
    color: C.purpleLight,
    fontSize: 13,
    fontWeight: '800',
  },
  addPanel: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 17,
    padding: 15,
    marginBottom: 12,
  },
  addPanelTitle: {
    color: C.white,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  input: {
    backgroundColor: C.bg,
    color: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    minHeight: 95,
    padding: 13,
    fontSize: 12,
    textAlign: 'left',
  },
  submitButton: {
    backgroundColor: C.purple,
    borderRadius: 12,
    alignItems: 'center',
    padding: 13,
    marginTop: 11,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  emptyBox: {
    backgroundColor: C.panel,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.border,
    padding: 25,
    alignItems: 'center',
  },
  emptyIcon: {
    color: C.purpleLight,
    fontSize: 35,
  },
  emptyTitle: {
    color: C.white,
    fontWeight: '800',
    fontSize: 14,
    marginTop: 10,
  },
  emptyText: {
    color: C.muted,
    fontSize: 11,
    marginTop: 7,
    textAlign: 'center',
    lineHeight: 20,
  },

  configCard: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 15,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  configCardSelected: {
    borderColor: C.purple,
    backgroundColor: '#171326',
  },
  configCheck: {
    marginRight: 11,
  },
  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: C.purpleLight,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.purpleLight,
  },
  configInfo: {
    flex: 1,
  },
  configName: {
    color: C.white,
    fontSize: 13,
    fontWeight: '800',
  },
  configMeta: {
    color: C.muted,
    fontSize: 10,
    marginTop: 5,
  },
  activeTag: {
    backgroundColor: '#123C32',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  activeTagText: {
    color: C.green,
    fontSize: 8,
    fontWeight: '900',
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 5,
  },
  deleteText: {
    color: C.red,
    fontSize: 23,
  },

  footer: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 19,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerBrand: {
    color: C.purpleLight,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 2,
  },
  footerText: {
    color: C.muted,
    fontSize: 8,
    letterSpacing: 2,
    marginTop: 6,
  },
  footerVersion: {
    color: '#55546A',
    fontSize: 8,
    letterSpacing: 1,
    marginTop: 9,
  },
});

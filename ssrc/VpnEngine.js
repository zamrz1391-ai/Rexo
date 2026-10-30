// V2Rexo — لایه‌ی اتصال به موتور VPN نیتیو
// اندروید: expo-xray-vpn | iOS: react-native-nitro-xray-core
// در Expo Go لود نمی‌شود — اپ باید با prebuild بیلد شود.

import { Platform } from 'react-native';

let androidModule = null;
let nitroClient = null;

async function getAndroid() {
  if (!androidModule) {
    try {
      const mod = await import('expo-xray-vpn');
      androidModule = mod.default ?? mod.ExpoXrayVpn ?? mod;
    } catch {
      throw new Error('ماژول نیتیو اندروید لود نشد — اپ با prebuild بیلد شده باشد');
    }
  }
  return androidModule;
}

async function getIOS() {
  if (!nitroClient) {
    try {
      const mod = await import('react-native-nitro-xray-core');
      nitroClient = mod.XrayClient;
    } catch {
      throw new Error('ماژول نیتیو iOS لود نشد — Network Extension تنظیم نشده');
    }
  }
  return nitroClient;
}

export async function connect(configJson) {
  if (Platform.OS === 'android') {
    const vpn = await getAndroid();
    const perm = await vpn.requestPermission();
    if (!perm || perm.granted === false) throw new Error('اجازه‌ی VPN داده نشد');
    await vpn.connect({
      dnsServer: '1.1.1.1',
      mtu: 1500,
      profileId: 'v2rexo',
      profileName: 'V2Rexo VPN',
      xrayConfigJson: configJson,
    });
    return 'connected';
  } else {
    const client = await getIOS();
    await client.ensurePermission();
    await client.connectJson(configJson);
    return 'connected';
  }
}

export async function disconnect() {
  if (Platform.OS === 'android') {
    const vpn = await getAndroid();
    await vpn.disconnect();
  } else {
    const client = await getIOS();
    await client.disconnect();
  }
}

export async function getStatus() {
  if (Platform.OS === 'android') {
    const vpn = await getAndroid();
    return await vpn.getStatus();
  } else {
    const client = await getIOS();
    return await client.status();
  }
}

export function subscribeState(cb) {
  if (Platform.OS === 'android') {
    getAndroid().then((vpn) => {
      if (vpn.addListener) vpn.addListener('onStateChange', (e) => cb(e.state, e.message));
    });
    return () => {};
  } else {
    getIOS().then((c) => c.onState((state, msg) => cb(state, msg)));
    return () => {};
  }
}

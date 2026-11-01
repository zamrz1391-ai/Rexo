// VpnEngine.js — wrapper around expo-xray-vpn (real API)
import ExpoXrayVpn from 'expo-xray-vpn';

export async function requestPermission() {
  const res = await ExpoXrayVpn.requestPermission();
  return res && res.granted === true;
}

export async function connect(xrayConfigJson, opts = {}) {
  const granted = await requestPermission();
  if (!granted) {
    throw new Error('دسترسی VPN رد شد');
  }
  return ExpoXrayVpn.connect({
    dnsServer: opts.dnsServer || '1.1.1.1',
    mtu: opts.mtu || 1500,
    profileId: opts.profileId || 'default',
    profileName: opts.profileName || 'V2Rexo',
    xrayConfigJson,
  });
}

export async function disconnect() {
  return ExpoXrayVpn.disconnect();
}

export async function getState() {
  return ExpoXrayVpn.getState();
}

export function onStateChange(cb) {
  const sub = ExpoXrayVpn.addListener('onStateChange', cb);
  return () => sub.remove();
}

export async function shareLinksToJson(text) {
  return ExpoXrayVpn.convertShareLinksToXrayJson(text);
}

export async function jsonToShareLinks(xrayConfigJson) {
  return ExpoXrayVpn.convertXrayJsonToShareLinks(xrayConfigJson);
}

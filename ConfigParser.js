
const SUPPORTED = ['vless', 'vmess', 'trojan', 'ss'];

export function parseConfigLink(link) {
  if (typeof link !== 'string' || !link.trim()) {
    throw new Error('لینک کانفیگ خالی است');
  }

  const raw = link.trim();
  const protocol = raw.slice(0, raw.indexOf('://')).toLowerCase();

  if (!SUPPORTED.includes(protocol)) {
    throw new Error('پروتکل پشتیبانی نمی‌شود: ' + protocol);
  }

  if (protocol === 'vmess') return parseVmess(raw);
  if (protocol === 'vless') return parseVless(raw);
  if (protocol === 'trojan') return parseTrojan(raw);
  if (protocol === 'ss') return parseShadowsocks(raw);
}

function decodeBase64(value) {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(
      normalized + '='.repeat((4 - normalized.length % 4) % 4)
    );

    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function decodeName(value) {
  try {
    return decodeURIComponent(value || '');
  } catch {
    return value || '';
  }
}

function parseVmess(link) {
  const encoded = link.slice(8).split('#')[0];
  const json = decodeBase64(encoded);

  if (!json) throw new Error('لینک VMess نامعتبر است');

  const j = JSON.parse(json);

  if (!j.add || !j.port || !j.id) {
    throw new Error('اطلاعات VMess ناقص است');
  }

  return {
    id: `${j.add}:${j.port}`,
    protocol: 'vmess',
    name: j.ps || j.remarks || 'VMess',
    address: j.add,
    port: Number(j.port),
    userId: j.id,
    alterId: Number(j.aid || 0),
    security: j.scy || 'auto',
    tls: j.tls === 'tls',
    sni: j.sni || '',
    network: j.net || 'tcp',
    wsPath: j.path || '',
    wsHost: j.host || '',
  };
}

function parseVless(link) {
  const u = new URL(link);
  const p = u.searchParams;

  if (!u.hostname || !u.username) {
    throw new Error('اطلاعات VLESS ناقص است');
  }

  return {
    id: `${u.hostname}:${u.port || 443}`,
    protocol: 'vless',
    name: decodeName(u.hash.slice(1)) || 'VLESS',
    address: u.hostname,
    port: Number(u.port || 443),
    userId: decodeURIComponent(u.username),
    flow: p.get('flow') || '',
    tls: ['tls', 'reality'].includes(p.get('security')),
    reality: p.get('security') === 'reality',
    sni: p.get('sni') || '',
    pbk: p.get('pbk') || '',
    sid: p.get('sid') || '',
    fp: p.get('fp') || 'chrome',
    network: p.get('type') || 'tcp',
    wsPath: p.get('path') || '',
    wsHost: p.get('host') || '',
  };
}

function parseTrojan(link) {
  const u = new URL(link);
  const p = u.searchParams;

  if (!u.hostname || !u.username) {
    throw new Error('اطلاعات Trojan ناقص است');
  }

  return {
    id: `${u.hostname}:${u.port || 443}`,
    protocol: 'trojan',
    name: decodeName(u.hash.slice(1)) || 'Trojan',
    address: u.hostname,
    port: Number(u.port || 443),
    password: decodeURIComponent(u.username),
    tls: true,
    sni: p.get('sni') || u.hostname,
    network: p.get('type') || 'tcp',
    wsPath: p.get('path') || '',
    wsHost: p.get('host') || '',
  };
}

function parseShadowsocks(link) {
  const u = new URL(link);
  const name = decodeName(u.hash.slice(1)) || 'Shadowsocks';
  let userInfo = u.href.slice(5).split('#')[0].split('?')[0];

  if (userInfo.includes('@')) {
    userInfo = userInfo.slice(0, userInfo.lastIndexOf('@'));
  }

  const decoded = decodeBase64(userInfo);
  if (!decoded || !decoded.includes(':')) {
    throw new Error('اطلاعات Shadowsocks نامعتبر است');
  }

  const at = decoded.lastIndexOf('@');
  const credentials = decoded.slice(0, at);
  const server = decoded.slice(at + 1);
  const colon = credentials.indexOf(':');

  if (colon < 1) throw new Error('اطلاعات رمزگذاری Shadowsocks ناقص است');

  const address = server.startsWith('[')
    ? server.slice(1, server.indexOf(']'))
    : server.slice(0, server.lastIndexOf(':'));

  const port = Number(server.slice(server.lastIndexOf(':') + 1));

  if (!address || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('آدرس یا پورت Shadowsocks نامعتبر است');
  }

  return {
    id: `ss-${address}:${port}`,
    protocol: 'shadowsocks',
    name,
    address,
    port,
    method: credentials.slice(0, colon),
    password: credentials.slice(colon + 1),
    tls: false,
    network: 'tcp',
  };
}

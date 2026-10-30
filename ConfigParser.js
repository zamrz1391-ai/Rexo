// V2Rexo — Config link parser (vless / vmess / trojan / ss)

export function parseConfigLink(link) {
  const raw = link.trim();
  if (raw.startsWith('vmess://')) return parseVmess(raw);
  if (raw.startsWith('vless://')) return parseVless(raw);
  if (raw.startsWith('trojan://')) return parseTrojan(raw);
  if (raw.startsWith('ss://')) return parseShadowsocks(raw);
  throw new Error('لینک پشتیبانی نمی‌شود. فقط vless / vmess / trojan / ss');
}

function b64decode(s) {
  try {
    const norm = s.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(
      atob(norm + '='.repeat((4 - (norm.length % 4)) % 4))
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
  } catch {
    return null;
  }
}

function parseVmess(link) {
  const json = b64decode(link.slice('vmess://'.length));
  if (!json) throw new Error('لینک vmess نامعتبر است');
  const j = JSON.parse(json);
  return {
    id: `${j.add}:${j.port}`,
    protocol: 'vmess',
    name: j.ps || j.remarks || 'VMess',
    address: j.add,
    port: parseInt(j.port, 10),
    userId: j.id,
    alterId: parseInt(j.aid || 0, 10),
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
  const params = u.searchParams;
  return {
    id: `${u.hostname}:${u.port || 443}`,
    protocol: 'vless',
    name: decodeURIComponent(u.hash.slice(1)) || 'VLESS',
    address: u.hostname,
    port: parseInt(u.port || 443, 10),
    userId: u.username,
    flow: params.get('flow') || '',
    tls: params.get('security') === 'tls' || params.get('security') === 'reality',
    reality: params.get('security') === 'reality',
    sni: params.get('sni') || '',
    pbk: params.get('pbk') || '',
    sid: params.get('sid') || '',
    fp: params.get('fp') || 'chrome',
    network: params.get('type') || 'tcp',
    wsPath: params.get('path') || '',
    wsHost: params.get('host') || '',
  };
}

function parseTrojan(link) {
  const u = new URL(link);
  const params = u.searchParams;
  return {
    id: `${u.hostname}:${u.port || 443}`,
    protocol: 'trojan',
    name: decodeURIComponent(u.hash.slice(1)) || 'Trojan',
    address: u.hostname,
    port: parseInt(u.port || 443, 10),
    password: decodeURIComponent(u.username),
    tls: true,
    sni: params.get('sni') || u.hostname,
    network: params.get('type') || 'tcp',
    wsPath: params.get('path') || '',
    wsHost: params.get('host') || '',
  };
}

function parseShadowsocks(link) {
  const hashIndex = link.indexOf('#');
  const name = hashIndex > -1 ? decodeURIComponent(link.slice(hashIndex + 1)) : 'SS';
  const body = link.slice('ss://'.length, hashIndex > -1 ? hashIndex : undefined);
  const decoded = b64decode(body);
  if (!decoded) throw new Error('لینک ss نامعتبر است');
  const at = decoded.lastIndexOf('@');
  const userinfo = decoded.slice(0, at);
  const hostport = decoded.slice(at + 1);
  const [method, password] = userinfo.split(':');
  const colon = hostport.lastIndexOf(':');
  return {
    id: `ss-${hostport.slice(0, colon)}:${hostport.slice(colon + 1)}`,
    protocol: 'shadowsocks',
    name,
    address: hostport.slice(0, colon),
    port: parseInt(hostport.slice(colon + 1), 10),
    method,
    password,
    tls: false,
    network: 'tcp',
  };
}
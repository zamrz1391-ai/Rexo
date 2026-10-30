// V2Rexo — ساخت کانفیگ JSON معتبر برای کرنل Xray

import { parseConfigLink } from './ConfigParser';

export function buildXrayConfig(link, listenPort = 10808) {
  const cfg = parseConfigLink(link);
  const outbound = buildOutbound(cfg);
  if (!outbound) throw new Error(`پروتکل ${cfg.protocol} پشتیبانی نمی‌شود`);

  return JSON.stringify({
    log: { loglevel: 'warning' },
    inbounds: [
      {
        tag: 'tun-in',
        port: listenPort,
        protocol: 'socks',
        settings: { auth: 'noauth', udp: true },
        sniffing: { enabled: true, destOverride: ['http', 'tls'] },
      },
    ],
    outbounds: [
      outbound,
      { tag: 'direct', protocol: 'freedom' },
      { tag: 'block', protocol: 'blackhole' },
    ],
    routing: {
      domainStrategy: 'IPIfNonMatch',
      rules: [
        { type: 'field', domain: ['geosite:category-ir'], outboundTag: 'direct' },
        { type: 'field', ip: ['geoip:ir', 'geoip:private'], outboundTag: 'direct' },
      ],
    },
  });
}

function buildOutbound(c) {
  const stream = buildStreamSettings(c);
  switch (c.protocol) {
    case 'vless':
      return {
        tag: 'proxy',
        protocol: 'vless',
        settings: {
          vnext: [
            {
              address: c.address,
              port: c.port,
              users: [{ id: c.userId, encryption: 'none', flow: c.flow || '' }],
            },
          ],
        },
        streamSettings: stream,
      };
    case 'vmess':
      return {
        tag: 'proxy',
        protocol: 'vmess',
        settings: {
          vnext: [
            {
              address: c.address,
              port: c.port,
              users: [{ id: c.userId, alterId: c.alterId || 0, security: c.security || 'auto' }],
            },
          ],
        },
        streamSettings: stream,
      };
    case 'trojan':
      return {
        tag: 'proxy',
        protocol: 'trojan',
        settings: {
          servers: [{ address: c.address, port: c.port, password: c.password }],
        },
        streamSettings: stream,
      };
    case 'shadowsocks':
      return {
        tag: 'proxy',
        protocol: 'shadowsocks',
        settings: {
          servers: [
            { address: c.address, port: c.port, method: c.method, password: c.password, ota: false },
          ],
        },
        streamSettings: stream,
      };
    default:
      return null;
  }
}

function buildStreamSettings(c) {
  const s = { network: c.network || 'tcp', security: 'none' };
  if (c.tls) {
    s.security = c.reality ? 'reality' : 'tls';
    s.tlsSettings = { serverName: c.sni || c.address, fingerprint: c.fp || 'chrome', allowInsecure: false };
    if (c.reality) {
      s.realitySettings = { serverName: c.sni || c.address, fingerprint: c.fp || 'chrome', publicKey: c.pbk, shortId: c.sid || '' };
      delete s.tlsSettings;
    }
  }
  if (c.network === 'ws') {
    s.wsSettings = { path: c.wsPath || '/', headers: c.wsHost ? { Host: c.wsHost } : {} };
  }
  if (c.network === 'grpc') {
    s.grpcSettings = { serviceName: c.wsPath || '' };
  }
  return s;
}
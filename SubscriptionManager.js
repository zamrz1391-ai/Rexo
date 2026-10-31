import { parseConfigLink } from './ConfigParser';

function decodeSubscription(text) {
  const content = text.trim();

  if (!content) {
    throw new Error('محتوای اشتراک خالی است');
  }

  // اگر محتوا از قبل لینک‌های متنی باشد
  if (/^(vless|vmess|trojan|ss):\/\//im.test(content)) {
    return content;
  }

  // تلاش برای تبدیل Base64
  try {
    const normalized = content
      .replace(/\s/g, '')
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const binary = atob(normalized);
    const bytes = Uint8Array.from(
      binary,
      (char) => char.charCodeAt(0)
    );

    return new TextDecoder().decode(bytes);
  } catch {
    return content;
  }
}

export async function fetchSubscription(url) {
  if (!url || !/^https?:\/\//i.test(url.trim())) {
    throw new Error('آدرس اشتراک باید با http یا https شروع شود');
  }

  const response = await fetch(url.trim());

  if (!response.ok) {
    throw new Error(`خطا در دریافت اشتراک: ${response.status}`);
  }

  const rawText = await response.text();
  const decoded = decodeSubscription(rawText);

  const lines = decoded
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const configs = [];
  const errors = [];

  for (const line of lines) {
    try {
      const parsed = parseConfigLink(line);

      configs.push({
        id: `${Date.now()}-${configs.length}`,
        name: parsed.name || `سرور ${configs.length + 1}`,
        link: line,
        protocol: parsed.protocol,
      });
    } catch (error) {
      errors.push({
        line,
        message: error.message || 'لینک نامعتبر',
      });
    }
  }

  if (configs.length === 0) {
    throw new Error(
      errors.length
        ? 'هیچ کانفیگ معتبری در اشتراک پیدا نشد'
        : 'اشتراک خالی است'
    );
  }

  return {
    configs,
    errors,
    total: configs.length,
  };
}

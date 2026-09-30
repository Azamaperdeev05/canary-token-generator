// ==========================================
// © Қармақ — Telegram Alert Notification
// telegram.ts
// ==========================================

import type { CompleteFingerprint } from '@/core/fingerprint/types'

export async function sendTelegramAlert(fp: CompleteFingerprint): Promise<boolean> {
  const token =
    import.meta.env.VITE_TELEGRAM_BOT_TOKEN ||
    '8948842451:AAGRa6BChS8UcIQQTd72053qgcIdHJC_AAM'
  const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID || '1009161374'

  if (!token || !chatId) {
    return false
  }

  const lines = [
    `🚨 <b>ҚАРМАҚҚА БІРЕУ ТҮСТІ! (CANARY TRIPPED)</b> 🚨`,
    ``,
    `🎯 <b>Composite ID:</b> <code>${fp.compositeHash}</code>`,
    `⏰ <b>Уақыты:</b> <code>${new Date().toLocaleString('kk-KZ')}</code>`,
    `🌐 <b>Local IP (WebRTC):</b> <code>${fp.webrtc.localIPs.join(', ') || 'Жасырын / mDNS'}</code>`,
    `🖥️ <b>GPU:</b> <code>${fp.webgl?.renderer || 'Анықталмады'}</code>`,
    `🏭 <b>GPU Vendor:</b> <code>${fp.webgl?.vendor || 'Unknown'}</code>`,
    `📱 <b>Платформа:</b> <code>${fp.hardware.platform}</code>`,
    `⚙️ <b>CPU & RAM:</b> <code>${fp.hardware.cores || '?'} Cores · ${fp.hardware.memoryGb || '?'} GB RAM</code>`,
    `📐 <b>Экран:</b> <code>${fp.screen.width}x${fp.screen.height} (DPR: ${fp.screen.dpr}x, Viewport: ${fp.screen.viewportWidth}x${fp.screen.viewportHeight})</code>`,
    `🔋 <b>Батарея:</b> <code>${fp.battery.level !== null ? `${fp.battery.level}%` : 'N/A'}${fp.battery.charging ? ' ⚡ (Қуатталуда)' : ''}</code>`,
    `🌍 <b>Timezone:</b> <code>${fp.locale.timezone}</code>`,
    `🗣️ <b>Тілдер:</b> <code>${fp.locale.languages.join(', ')}</code>`,
    `🔤 <b>Қаріптер:</b> <code>${fp.fonts.detectedCount} қаріп анықталды</code>`,
    `🎨 <b>Canvas Hash:</b> <code>${fp.canvas.hash}</code>`,
    `🔊 <b>Audio Sum:</b> <code>${fp.audio.spectralSum}</code>`,
    ``,
    `🔗 <i>Қармақ бақылау тақтасы арқылы толық көруге болады.</i>`,
  ]

  const text = lines.join('\n')

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    })
    return res.ok
  } catch (err) {
    console.error('Failed to send Telegram alert:', err)
    return false
  }
}

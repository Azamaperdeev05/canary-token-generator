// ==========================================
// © Қармақ — Group A Device Fingerprinting
// collector.ts
// ==========================================

import type {
  AudioFingerprint,
  BatteryInfo,
  CanvasFingerprint,
  CapabilitiesInfo,
  CompleteFingerprint,
  FontInfo,
  HardwareInfo,
  LocaleInfo,
  NetworkInfo,
  ScreenInfo,
  StorageInfo,
  WebGLInfo,
  WebRTCInfo,
} from './types'

// ── Hash Helpers ──────────────────────────────────────────
export function fnv1a(data: ArrayLike<number>): string {
  let h = 0x811c9dc5
  for (let i = 0; i < data.length; i++) {
    h ^= data[i]
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export async function sha256Hex(str: string): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const buf = new TextEncoder().encode(str)
      const hash = await window.crypto.subtle.digest('SHA-256', buf)
      return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    }
  } catch {}
  // Simple fallback string hash
  return fnv1a(new TextEncoder().encode(str))
}

// ── 1. Canvas Fingerprint ─────────────────────────────────
export async function collectCanvasFingerprint(): Promise<CanvasFingerprint> {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 280
    canvas.height = 60
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return { hash: 'unsupported', sha256: 'unsupported', width: 280, height: 60 }
    }

    // Baseline & multi-colored typography with glyphs and emojis
    ctx.textBaseline = 'alphabetic'
    ctx.font = '14px Arial, sans-serif'
    ctx.fillStyle = '#f60'
    ctx.fillRect(100, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('Қармақ Honeytoken Fingerprint, 🌟', 2, 15)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('Cwm fjord bank glyphs vext quiz, 🌟', 4, 45)

    // Linear gradient
    const grd = ctx.createLinearGradient(0, 0, 280, 0)
    grd.addColorStop(0, '#ff0055')
    grd.addColorStop(0.5, '#00d2ff')
    grd.addColorStop(1, '#00ff88')
    ctx.fillStyle = grd
    ctx.fillRect(0, 50, 280, 10)

    // Circular geometric arc
    ctx.beginPath()
    ctx.arc(50, 30, 15, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fill()

    const rawData = ctx.getImageData(0, 0, 280, 60).data
    const quickHash = fnv1a(rawData)
    const dataUrl = canvas.toDataURL('image/png')
    const fullSha = await sha256Hex(dataUrl)

    return {
      hash: quickHash,
      sha256: fullSha,
      dataUrl,
      width: 280,
      height: 60,
    }
  } catch (err) {
    return { hash: 'error', sha256: 'error', width: 280, height: 60 }
  }
}

// ── 2. AudioContext Fingerprint ───────────────────────────
export async function collectAudioFingerprint(): Promise<AudioFingerprint> {
  const startTime = performance.now()
  return new Promise((resolve) => {
    try {
      const AudioCtx =
        window.OfflineAudioContext ||
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
          .webkitOfflineAudioContext
      if (!AudioCtx) {
        resolve({
          spectralSum: 'unsupported',
          hash: 'unsupported',
          samples: [],
          durationMs: 0,
        })
        return
      }

      const ctx = new AudioCtx(1, 44100, 44100)
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(10000, ctx.currentTime)

      const comp = ctx.createDynamicsCompressor()
      comp.threshold.setValueAtTime(-50, ctx.currentTime)
      comp.knee.setValueAtTime(40, ctx.currentTime)
      comp.ratio.setValueAtTime(12, ctx.currentTime)
      comp.attack.setValueAtTime(0, ctx.currentTime)
      comp.release.setValueAtTime(0.25, ctx.currentTime)

      osc.connect(comp)
      comp.connect(ctx.destination)
      osc.start(0)

      ctx
        .startRendering()
        .then(async (buf) => {
          const channel = buf.getChannelData(0)
          const slice = channel.slice(4500, 5000)
          let sum = 0
          for (let i = 0; i < slice.length; i++) {
            sum += Math.abs(slice[i])
          }
          const sumStr = sum.toString()
          const hash = await sha256Hex(sumStr)
          // Downsample for visual waveform display (e.g. 40 points)
          const step = Math.floor(slice.length / 40)
          const samples: number[] = []
          for (let i = 0; i < slice.length; i += step) {
            samples.push(Number(slice[i].toFixed(4)))
          }

          resolve({
            spectralSum: sumStr,
            hash,
            samples,
            durationMs: Math.round(performance.now() - startTime),
          })
        })
        .catch(() => {
          resolve({
            spectralSum: 'render-failed',
            hash: 'render-failed',
            samples: [],
            durationMs: 0,
          })
        })

      setTimeout(() => {
        resolve({
          spectralSum: 'timeout',
          hash: 'timeout',
          samples: [],
          durationMs: Math.round(performance.now() - startTime),
        })
      }, 1000)
    } catch {
      resolve({
        spectralSum: 'error',
        hash: 'error',
        samples: [],
        durationMs: 0,
      })
    }
  })
}

// ── 3. WebRTC Local IP Leak ───────────────────────────────
export async function collectWebRTCLocalIPs(): Promise<WebRTCInfo> {
  return new Promise((resolve) => {
    try {
      const PeerConn =
        window.RTCPeerConnection ||
        (window as unknown as { webkitRTCPeerConnection?: typeof RTCPeerConnection })
          .webkitRTCPeerConnection
      if (!PeerConn) {
        resolve({ localIPs: [], supported: false, candidateTypes: [] })
        return
      }

      const pc = new PeerConn({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })

      const ips = new Set<string>()
      const candidateTypes = new Set<string>()

      pc.createDataChannel('qarmaq-probe')

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {})

      pc.onicecandidate = (event) => {
        if (!event || !event.candidate || !event.candidate.candidate) {
          try {
            pc.close()
          } catch {}
          resolve({
            localIPs: Array.from(ips),
            supported: true,
            candidateTypes: Array.from(candidateTypes),
          })
          return
        }

        const candidateStr = event.candidate.candidate
        if (event.candidate.type) {
          candidateTypes.add(event.candidate.type)
        }

        // Match IPv4 or IPv6
        const match = candidateStr.match(
          /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/
        )
        if (match && match[1]) {
          const ip = match[1]
          if (!ip.startsWith('0.0.0') && ip !== '0.0.0.0') {
            ips.add(ip)
          }
        }
      }

      setTimeout(() => {
        try {
          pc.close()
        } catch {}
        resolve({
          localIPs: Array.from(ips),
          supported: true,
          candidateTypes: Array.from(candidateTypes),
        })
      }, 1200)
    } catch {
      resolve({ localIPs: [], supported: false, candidateTypes: [] })
    }
  })
}

// ── 4. Font Detection ─────────────────────────────────────
export async function detectFonts(): Promise<FontInfo> {
  const testFonts = [
    'Arial',
    'Arial Black',
    'Comic Sans MS',
    'Courier New',
    'Georgia',
    'Impact',
    'Lucida Console',
    'Lucida Sans Unicode',
    'Palatino Linotype',
    'Tahoma',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
    'Helvetica Neue',
    'Helvetica',
    'Segoe UI',
    'Roboto',
    'Noto Sans',
    'Ubuntu',
    'Fira Sans',
    'SF Pro Display',
    'Apple Color Emoji',
    'Menlo',
    'Monaco',
    'Consolas',
    'Liberation Mono',
    'DejaVu Sans',
    'Cantarell',
    'Droid Sans',
    'Open Sans',
    'Lato',
    'Montserrat',
    'Inter',
    'Poppins',
    'Calibri',
    'Cambria',
  ]

  const baseFonts = ['monospace', 'sans-serif', 'serif']
  const testStr = 'mmmmmmmmmmlli'
  const testSize = '72px'

  try {
    const span = document.createElement('span')
    span.style.position = 'absolute'
    span.style.left = '-9999px'
    span.style.fontSize = testSize
    span.style.lineHeight = 'normal'
    span.textContent = testStr
    document.body.appendChild(span)

    const baseWidths: Record<string, number> = {}
    for (const base of baseFonts) {
      span.style.fontFamily = base
      baseWidths[base] = span.offsetWidth
    }

    const detected: string[] = []
    for (const font of testFonts) {
      let found = false
      for (const base of baseFonts) {
        span.style.fontFamily = `'${font}', ${base}`
        if (span.offsetWidth !== baseWidths[base]) {
          found = true
          break
        }
      }
      if (found) {
        detected.push(font)
      }
    }

    document.body.removeChild(span)
    const hash = await sha256Hex(detected.join(','))

    return {
      detected,
      testedCount: testFonts.length,
      detectedCount: detected.length,
      hash,
    }
  } catch {
    return {
      detected: [],
      testedCount: testFonts.length,
      detectedCount: 0,
      hash: 'error',
    }
  }
}

// ── 5. WebGL Diagnostics ──────────────────────────────────
export function collectWebGLInfo(): WebGLInfo | null {
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    if (!gl) return null

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const vendor = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
      : String(gl.getParameter(gl.VENDOR) || 'Unknown')
    const renderer = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER) || 'Unknown')

    const attrs = gl.getContextAttributes()
    const extensions = gl.getSupportedExtensions() || []

    const gl2 = !!canvas.getContext('webgl2')

    return {
      vendor,
      renderer,
      shadingLangVer: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || ''),
      maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0),
      maxRenderBufSize: Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 0),
      maxViewportDims: Array.from(
        (gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array) || [0, 0]
      ),
      maxVertexAttribs: Number(gl.getParameter(gl.MAX_VERTEX_ATTRIBS) || 0),
      maxVaryingVectors: Number(gl.getParameter(gl.MAX_VARYING_VECTORS) || 0),
      maxFragUniforms: Number(gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 0),
      maxVertexUniforms: Number(gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) || 0),
      antialiasing: attrs && typeof attrs.antialias === 'boolean' ? attrs.antialias : null,
      extensionsCount: extensions.length,
      extensions,
      webgl2: gl2,
    }
  } catch {
    return null
  }
}

// ── 6. Hardware & System Info ─────────────────────────────
export function collectHardwareInfo(): HardwareInfo {
  return {
    cores: navigator.hardwareConcurrency || null,
    memoryGb: (navigator as unknown as { deviceMemory?: number }).deviceMemory || null,
    platform: navigator.platform || 'Unknown',
    userAgent: navigator.userAgent || 'Unknown',
    touchPoints: navigator.maxTouchPoints || 0,
    doNotTrack: navigator.doNotTrack || null,
    vendor: navigator.vendor || '',
  }
}

// ── 7. Screen & Display ───────────────────────────────────
export function collectScreenInfo(): ScreenInfo {
  return {
    width: window.screen.width,
    height: window.screen.height,
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
    dpr: window.devicePixelRatio || 1,
    colorDepth: window.screen.colorDepth,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  }
}

// ── 8. Locale & Regional ──────────────────────────────────
export function collectLocaleInfo(): LocaleInfo {
  const options = Intl.DateTimeFormat().resolvedOptions()
  return {
    timezone: options.timeZone || 'UTC',
    timezoneOffset: new Date().getTimezoneOffset(),
    language: navigator.language || 'en',
    languages: Array.from(navigator.languages || [navigator.language]),
    calendar: options.calendar,
  }
}

// ── 9. Battery API ────────────────────────────────────────
export async function collectBatteryInfo(): Promise<BatteryInfo> {
  try {
    const nav = navigator as unknown as {
      getBattery?: () => Promise<{ level: number; charging: boolean }>
    }
    if (nav.getBattery) {
      const b = await nav.getBattery()
      return {
        supported: true,
        level: Math.round(b.level * 100),
        charging: b.charging,
      }
    }
  } catch {}
  return { supported: false, level: null, charging: null }
}

// ── 10. Network Info ──────────────────────────────────────
export function collectNetworkInfo(): NetworkInfo {
  try {
    const conn =
      (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } })
        .connection
    if (conn) {
      return {
        supported: true,
        effectiveType: conn.effectiveType || null,
        downlink: conn.downlink || null,
        rtt: conn.rtt || null,
        saveData: !!conn.saveData,
      }
    }
  } catch {}
  return { supported: false, effectiveType: null, downlink: null, rtt: null, saveData: false }
}

// ── 11. Storage & Capabilities ────────────────────────────
export function collectStorageInfo(): StorageInfo {
  const check = (fn: () => void) => {
    try {
      fn()
      return true
    } catch {
      return false
    }
  }
  return {
    localStorage: check(() => {
      window.localStorage.setItem('__q_test', '1')
      window.localStorage.removeItem('__q_test')
    }),
    sessionStorage: check(() => {
      window.sessionStorage.setItem('__q_test', '1')
      window.sessionStorage.removeItem('__q_test')
    }),
    indexedDB: typeof indexedDB !== 'undefined',
    cookies: navigator.cookieEnabled,
  }
}

export function collectCapabilitiesInfo(): CapabilitiesInfo {
  return {
    webAssembly: typeof WebAssembly !== 'undefined',
    serviceWorker: 'serviceWorker' in navigator,
    webgpu: 'gpu' in navigator,
    bluetooth: 'bluetooth' in navigator,
    speechRecognition:
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
  }
}

// ── 12. Main Orchestrator ─────────────────────────────────
export async function collectCompleteFingerprint(
  onProgress?: (step: string, percent: number) => void
): Promise<CompleteFingerprint> {
  const startTime = performance.now()

  onProgress?.('🎨 Canvas саусақ ізі өңделуде...', 15)
  const canvas = await collectCanvasFingerprint()

  onProgress?.('🔊 Дыбыстық спектр (AudioContext) есептелуде...', 35)
  const audio = await collectAudioFingerprint()

  onProgress?.('🌐 WebRTC желілік сокеттері сканерленуде...', 55)
  const webrtc = await collectWebRTCLocalIPs()

  onProgress?.('🔤 Жүйелік қаріптер (Fonts) анықталуда...', 75)
  const fonts = await detectFonts()

  onProgress?.('🖥️ Графикалық карта (WebGL) параметрлері алынуда...', 90)
  const webgl = collectWebGLInfo()
  const hardware = collectHardwareInfo()
  const screen = collectScreenInfo()
  const locale = collectLocaleInfo()
  const battery = await collectBatteryInfo()
  const network = collectNetworkInfo()
  const storage = collectStorageInfo()
  const capabilities = collectCapabilitiesInfo()

  // High-entropy invariant composite hash calculation
  const compositeParts = [
    canvas.hash,
    audio.hash,
    fonts.hash,
    webgl?.renderer || 'no-gpu',
    screen.width,
    screen.height,
    screen.dpr,
    locale.timezone,
    hardware.platform,
    hardware.cores || 0,
  ].join(':::')

  const compositeHash = await sha256Hex(compositeParts)

  onProgress?.('✅ Барлық деректер сәтті жиналды!', 100)

  return {
    compositeHash: `fp_${compositeHash.slice(0, 16)}`,
    timestamp: new Date().toISOString(),
    scanDurationMs: Math.round(performance.now() - startTime),
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
  }
}

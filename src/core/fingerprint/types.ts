// ==========================================
// © Қармақ — Group A Device Fingerprinting
// types.ts
// ==========================================

export interface CanvasFingerprint {
  hash: string
  sha256: string
  dataUrl?: string
  width: number
  height: number
}

export interface AudioFingerprint {
  spectralSum: string
  hash: string
  samples: number[]
  durationMs: number
}

export interface WebRTCInfo {
  localIPs: string[]
  supported: boolean
  candidateTypes: string[]
}

export interface FontInfo {
  detected: string[]
  testedCount: number
  detectedCount: number
  hash: string
}

export interface WebGLInfo {
  vendor: string
  renderer: string
  shadingLangVer: string
  maxTextureSize: number
  maxRenderBufSize: number
  maxViewportDims: number[]
  maxVertexAttribs: number
  maxVaryingVectors: number
  maxFragUniforms: number
  maxVertexUniforms: number
  antialiasing: boolean | null
  extensionsCount: number
  extensions: string[]
  webgl2: boolean
}

export interface HardwareInfo {
  cores: number | null
  memoryGb: number | null
  platform: string
  userAgent: string
  touchPoints: number
  doNotTrack: string | null
  vendor: string
}

export interface ScreenInfo {
  width: number
  height: number
  availWidth: number
  availHeight: number
  dpr: number
  colorDepth: number
  viewportWidth: number
  viewportHeight: number
}

export interface LocaleInfo {
  timezone: string
  timezoneOffset: number
  language: string
  languages: string[]
  calendar?: string
}

export interface BatteryInfo {
  supported: boolean
  level: number | null
  charging: boolean | null
}

export interface NetworkInfo {
  supported: boolean
  effectiveType: string | null
  downlink: number | null
  rtt: number | null
  saveData: boolean
}

export interface StorageInfo {
  localStorage: boolean
  sessionStorage: boolean
  indexedDB: boolean
  cookies: boolean
}

export interface CapabilitiesInfo {
  webAssembly: boolean
  serviceWorker: boolean
  webgpu: boolean
  bluetooth: boolean
  speechRecognition: boolean
}

export interface CompleteFingerprint {
  compositeHash: string
  timestamp: string
  scanDurationMs: number
  canvas: CanvasFingerprint
  audio: AudioFingerprint
  webrtc: WebRTCInfo
  fonts: FontInfo
  webgl: WebGLInfo | null
  hardware: HardwareInfo
  screen: ScreenInfo
  locale: LocaleInfo
  battery: BatteryInfo
  network: NetworkInfo
  storage: StorageInfo
  capabilities: CapabilitiesInfo
}

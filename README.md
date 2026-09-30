# ҚАРМАҚ // Group A Browser & Device Fingerprint Profiler

> 100% клиенттік React ортасында браузер мен құрылғының цифрлық саусақ ізін (Group A деректерін) ешқандай серверлік немесе ақылы тәуелділіктерсіз жинайтын және талдайтын жүйе.

---

## ⚡ Жиналатын Group A деректері

1. **Canvas Fingerprint**: Түрлі-түсті глифтер, градиенттер мен қисықтарды 2D canvas-та салып, FNV-1a 32-bit және SHA-256 хэштерін есептеу (нақты уақыттағы визуализациясымен).
2. **AudioContext Acoustic Spectrum**: `OfflineAudioContext`, үшбұрышты осциллятор және `DynamicsCompressor` көмегімен аппараттық дыбыстық тербелістің спектрлік қосындысын (Spectral Sum) және 40-нүктелік толқын пішінін (waveform) алу.
3. **WebRTC Local IP Leak**: `RTCPeerConnection` мен Google STUN (`stun:stun.l.google.com:19302`) арқылы жергілікті желілік интерфейстерді (IPv4 / IPv6) анықтау.
4. **Орнатылған қаріптер (System Fonts)**: Жүйедегі 36+ қаріпті (Arial, Helvetica, Menlo, Monaco, SF Pro, Roboto, Segoe UI т.б.) жасырын DOM span элементінің ені арқылы анықтау.
5. **WebGL & GPU Diagnostics**: Видеокартаның моделі мен өндірушісі (`UNMASKED_RENDERER_WEBGL`), WebGL 2.0 қолдауы, максималды текстура өлшемі (Max Texture Size), viewport өлшемдері және қолдаулы кеңейтімдер тізімі.
6. **Аппаратура және қуат**: CPU ядролары (`hardwareConcurrency`), жедел жад көлемі (`deviceMemory`), батарея деңгейі мен қуатталу күйі (`Battery API`).
7. **Экран және дисплей**: Нақты рұқсат (Screen Resolution), қолжетімді аймақ, Device Pixel Ratio (DPR), түс тереңдігі (Color Depth), браузер терезесі (Viewport).
8. **Локаль және құпиялылық**: Уақыт белдеуі (Timezone), UTC ығысуы, браузер тілі, Do Not Track (DNT) күйі.
9. **Сақтау қоймалары және API**: LocalStorage, SessionStorage, IndexedDB, Cookies, WebAssembly, WebGPU, Service Worker.
10. **Composite Hash**: Жүйенің тұрақты сигналдары негізінде есептелетін 16-таңбалы бірегей саусақ ізі идентификаторы (`#fp_...`).

---

## 🚀 Жобаны жергілікті ортада іске қосу

### 1. Тәуелділіктерді орнату:
```bash
pnpm install
# немесе
npm install
```

### 2. Әзірлеу режимінде іске қосу (Dev server):
```bash
pnpm dev
# немесе
npm run dev
```
Браузерде ашыңыз: `http://localhost:5173/`

### 3. Өндірістік нұсқаны жинау (Build):
```bash
pnpm build
# немесе
npm run build
```

---

## 🛠️ Технологиялық стек
- **Фреймворк:** React 19, TypeScript 5.9, Vite (Rolldown)
- **Стильдеу:** SCSS (Specimen Design System, Dark/Paper aesthetic, CSS Grid)
- **Иконкалар:** React Icons (`react-icons/fi`)
- **Хабарламалар:** Sonner

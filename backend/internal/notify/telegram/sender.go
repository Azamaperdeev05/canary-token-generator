// ©AngelaMos | 2026
// sender.go

package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/cenkalti/backoff/v5"

	"github.com/CarterPerez-dev/cybersecurity-projects/canary-token-generator/backend/internal/event"
)

const (
	Channel = "telegram"

	defaultAPIBase         = "https://api.telegram.org"
	defaultMaxTries        = 3
	defaultMaxElapsed      = 30 * time.Second
	defaultInitialInterval = 500 * time.Millisecond
	defaultOverallTimeout  = 10 * time.Second
	defaultDialTimeout     = 5 * time.Second

	uaTruncateRunes = 80

	parseModeMarkdownV2 = "MarkdownV2"
	contentTypeJSON     = "application/json"

	v2SpecialChars = "_*[]()~`>#+-=|{}.!"
)

var (
	ErrChannelNotConfigured = errors.New(
		"telegram: bot token or chat id not configured",
	)
	ErrTelegramAPI = errors.New("telegram: api error")
)

type Config struct {
	APIBase         string
	ManageURL       string
	HTTPClient      *http.Client
	MaxTries        uint
	MaxElapsed      time.Duration
	InitialInterval time.Duration
}

type Option func(*Config)

func WithMaxTries(n uint) Option {
	return func(c *Config) { c.MaxTries = n }
}

func WithMaxElapsed(d time.Duration) Option {
	return func(c *Config) { c.MaxElapsed = d }
}

func WithInitialInterval(d time.Duration) Option {
	return func(c *Config) { c.InitialInterval = d }
}

func WithHTTPClient(client *http.Client) Option {
	return func(c *Config) { c.HTTPClient = client }
}

type Sender struct {
	apiBase         string
	manageURL       string
	httpClient      *http.Client
	maxTries        uint
	maxElapsed      time.Duration
	initialInterval time.Duration
}

func NewSender(cfg Config, opts ...Option) *Sender {
	for _, o := range opts {
		o(&cfg)
	}
	if cfg.APIBase == "" {
		cfg.APIBase = defaultAPIBase
	}
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = defaultHTTPClient()
	}
	if cfg.MaxTries == 0 {
		cfg.MaxTries = defaultMaxTries
	}
	if cfg.MaxElapsed == 0 {
		cfg.MaxElapsed = defaultMaxElapsed
	}
	if cfg.InitialInterval == 0 {
		cfg.InitialInterval = defaultInitialInterval
	}
	return &Sender{
		apiBase:         strings.TrimRight(cfg.APIBase, "/"),
		manageURL:       strings.TrimRight(cfg.ManageURL, "/"),
		httpClient:      cfg.HTTPClient,
		maxTries:        cfg.MaxTries,
		maxElapsed:      cfg.MaxElapsed,
		initialInterval: cfg.InitialInterval,
	}
}

func defaultHTTPClient() *http.Client {
	dialer := &net.Dialer{Timeout: defaultDialTimeout}
	return &http.Client{
		Timeout: defaultOverallTimeout,
		Transport: &http.Transport{
			DialContext:           dialer.DialContext,
			TLSHandshakeTimeout:   defaultDialTimeout,
			ResponseHeaderTimeout: defaultOverallTimeout,
			ExpectContinueTimeout: time.Second,
			IdleConnTimeout:       30 * time.Second,
		},
	}
}

func (s *Sender) Channel() string { return Channel }

func (s *Sender) Send(
	ctx context.Context,
	info event.NotifyInfo,
	evt *event.Event,
) error {
	if info.TelegramBot == "" || info.TelegramChat == "" {
		return ErrChannelNotConfigured
	}
	msgText := buildMessage(info, evt, s.manageURL)
	return s.SendMessage(ctx, info.TelegramBot, info.TelegramChat, msgText)
}

func (s *Sender) SendMessage(
	ctx context.Context,
	botToken, rawChatIDs, text string,
) error {
	if botToken == "" || rawChatIDs == "" {
		return ErrChannelNotConfigured
	}
	endpoint := s.apiBase + "/bot" + botToken + "/sendMessage"

	rawChats := strings.FieldsFunc(rawChatIDs, func(r rune) bool {
		return r == ',' || r == ';'
	})
	if len(rawChats) == 0 {
		return ErrChannelNotConfigured
	}

	var lastErr error
	var sentCount int

	for _, chatID := range rawChats {
		chatID = strings.TrimSpace(chatID)
		if chatID == "" {
			continue
		}
		body, err := json.Marshal(map[string]string{
			"chat_id":    chatID,
			"text":       text,
			"parse_mode": parseModeMarkdownV2,
		})
		if err != nil {
			lastErr = fmt.Errorf("telegram: marshal body for %s: %w", chatID, err)
			continue
		}

		expBackoff := backoff.NewExponentialBackOff()
		expBackoff.InitialInterval = s.initialInterval
		expBackoff.MaxInterval = 5 * time.Second

		_, err = backoff.Retry(
			ctx,
			func() (struct{}, error) {
				return struct{}{}, s.doRequest(ctx, endpoint, body)
			},
			backoff.WithBackOff(expBackoff),
			backoff.WithMaxTries(s.maxTries),
			backoff.WithMaxElapsedTime(s.maxElapsed),
		)
		if err != nil {
			lastErr = err
		} else {
			sentCount++
		}
	}

	if sentCount > 0 {
		return nil
	}
	return lastErr
}

func (s *Sender) doRequest(
	ctx context.Context,
	endpoint string,
	body []byte,
) error {
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		endpoint,
		bytes.NewReader(body),
	)
	if err != nil {
		return backoff.Permanent(
			fmt.Errorf("telegram: build request: %w", err),
		)
	}
	req.Header.Set("Content-Type", contentTypeJSON)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("telegram: do request: %w", err)
	}
	defer func() {
		if cErr := resp.Body.Close(); cErr != nil {
			slog.WarnContext(ctx, "telegram: close body",
				"error", cErr)
		}
	}()

	respBody, rErr := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if rErr != nil {
		slog.WarnContext(ctx, "telegram: read body", "error", rErr)
	}

	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return nil
	case resp.StatusCode >= 400 && resp.StatusCode < 500:
		return backoff.Permanent(fmt.Errorf(
			"%w: status=%d body=%s",
			ErrTelegramAPI, resp.StatusCode, string(respBody),
		))
	default:
		return fmt.Errorf(
			"%w: status=%d body=%s",
			ErrTelegramAPI, resp.StatusCode, string(respBody),
		)
	}
}

func buildMessage(
	info event.NotifyInfo,
	evt *event.Event,
	manageURL string,
) string {
	var extra struct {
		ISP            string `json:"isp"`
		Mobile         bool   `json:"mobile"`
		Proxy          bool   `json:"proxy"`
		Hosting        bool   `json:"hosting"`
		AcceptLanguage string `json:"accept_language"`
		SecChUaModel   string `json:"sec_ch_ua_model"`
	}
	if len(evt.Extra) > 0 {
		_ = json.Unmarshal(evt.Extra, &extra)
	}

	var b strings.Builder
	b.WriteString("🚨 *Тұзақ іске қосылды:* ")
	b.WriteString(EscapeMD(info.Memo))
	b.WriteString("\n\n*Түрі:* ")
	b.WriteString(EscapeMD(formatTokenType(info.Type)))
	b.WriteString("\n*IP адресі:* ")
	b.WriteString(EscapeMD(evt.SourceIP))
	if loc := formatGeo(evt); loc != "" {
		b.WriteString(" ")
		b.WriteString(loc)
	}

	if extra.Proxy {
		b.WriteString("\n*Желі түрі:* 🛡 VPN / Прокси арқылы")
	} else if extra.Hosting {
		b.WriteString("\n*Желі түрі:* ☁️ Хостинг / Дата\\-центр")
	} else if extra.Mobile {
		b.WriteString("\n*Желі түрі:* 📱 Ұялы байланыс \\(Mobile 4G/5G\\)")
	} else if extra.ISP != "" || evt.GeoASNOrg != nil {
		b.WriteString("\n*Желі түрі:* 🏠 Үй / Офис Wi\\-Fi \\(Broadband\\)")
	}

	if extra.ISP != "" {
		asnOrg := derefStr(evt.GeoASNOrg)
		if asnOrg == "" || !strings.Contains(strings.ToLower(asnOrg), strings.ToLower(extra.ISP)) {
			b.WriteString("\n*Провайдер:* ")
			b.WriteString(EscapeMD(extra.ISP))
		}
	}

	almatyZone := time.FixedZone("Asia/Almaty", 5*3600)
	timeFormatted := evt.TriggeredAt.In(almatyZone).Format("2006-01-02 15:04:05") + " (UTC+5)"
	b.WriteString("\n*Уақыты:* ")
	b.WriteString(EscapeMD(timeFormatted))

	if evt.UserAgent != nil && *evt.UserAgent != "" {
		ua := *evt.UserAgent
		device, app := parseDeviceInfo(ua)
		if extra.SecChUaModel != "" {
			device = extra.SecChUaModel + " (" + device + ")"
		}
		b.WriteString("\n*Құрылғы:* ")
		b.WriteString(EscapeMD(device))
		if app != "" {
			b.WriteString("\n*Браузер:* ")
			b.WriteString(EscapeMD(app))
		}
	}

	if evt.Referer != nil && *evt.Referer != "" {
		b.WriteString("\n*Сілтеме ашылды:* ")
		b.WriteString(EscapeMD(formatReferer(*evt.Referer)))
	}

	if extra.AcceptLanguage != "" {
		b.WriteString("\n*Интерфейс тілдері:* ")
		b.WriteString(EscapeMD(formatLanguages(extra.AcceptLanguage)))
	}

	if evt.UserAgent != nil && *evt.UserAgent != "" {
		b.WriteString("\n*Толық UA:* ")
		b.WriteString(EscapeMD(truncateRunes(*evt.UserAgent, uaTruncateRunes)))
	}

	if manageURL != "" && info.ManageID != "" {
		mURL := strings.TrimRight(manageURL, "/")
		if !strings.HasPrefix(mURL, "http://") && !strings.HasPrefix(mURL, "https://") {
			mURL = "https://" + strings.TrimLeft(mURL, "/")
		}
		b.WriteString("\n\n[Толық оқиғалар журналын көру](")
		b.WriteString(mURL + "/m/" + info.ManageID)
		b.WriteString(")")
	}
	return b.String()
}

type fingerprintPayload struct {
	Screen struct {
		W          int     `json:"w"`
		H          int     `json:"h"`
		AvailW     int     `json:"availW"`
		AvailH     int     `json:"availH"`
		DPR        float64 `json:"dpr"`
		ColorDepth int     `json:"colorDepth"`
	} `json:"screen"`
	Viewport struct {
		W int `json:"w"`
		H int `json:"h"`
	} `json:"viewport"`
	Timezone      string   `json:"timezone"`
	Language      string   `json:"language"`
	Languages     []string `json:"languages"`
	Platform      string   `json:"platform"`
	Touch         int      `json:"touch"`
	HWConcurrency int      `json:"hwConcurrency"`
	DeviceMemory  *float64 `json:"deviceMemory"`
	DoNotTrack    string   `json:"doNotTrack"`
	WebGL         *struct {
		Vendor   string `json:"vendor"`
		Renderer string `json:"renderer"`
	} `json:"webgl"`
	WebGLParams *struct {
		MaxTextureSize    int      `json:"maxTextureSize"`
		MaxRenderBufSize  int      `json:"maxRenderBufSize"`
		MaxViewportDims   []int    `json:"maxViewportDims"`
		MaxVertexAttribs  int      `json:"maxVertexAttribs"`
		MaxVaryingVectors int      `json:"maxVaryingVectors"`
		MaxFragUniforms   int      `json:"maxFragUniforms"`
		MaxVertexUniforms int      `json:"maxVertexUniforms"`
		ShadingLangVer    string   `json:"shadingLangVer"`
		AliasedLineWidth  []float64 `json:"aliasedLineWidth"`
		AliasedPointSize  []float64 `json:"aliasedPointSize"`
		Antialiasing      *bool    `json:"antialiasing"`
	} `json:"webglParams"`
	CanvasHash    string   `json:"canvasHash"`
	AudioHash     string   `json:"audioHash"`
	CompositeHash string   `json:"compositeHash"`
	WebRTCIPs     []string `json:"webrtcIPs"`
	Fonts         []string `json:"fonts"`
	FontsHash     string   `json:"fontsHash"`
	FontCount     int      `json:"fontCount"`
	NetworkInfo   *struct {
		EffectiveType string  `json:"effectiveType"`
		Downlink      float64 `json:"downlink"`
		RTT           int     `json:"rtt"`
		Type          string  `json:"type"`
		SaveData      bool    `json:"saveData"`
	} `json:"networkInfo"`
	Storage *struct {
		LocalStorage   bool `json:"localStorage"`
		SessionStorage bool `json:"sessionStorage"`
		IndexedDB      bool `json:"indexedDB"`
		CookieEnabled  bool `json:"cookieEnabled"`
	} `json:"storage"`
	Battery *struct {
		Level    int  `json:"level"`
		Charging bool `json:"charging"`
	} `json:"battery"`
	Referrer string `json:"referrer"`
	GPS      *struct {
		Lat float64 `json:"lat"`
		Lon float64 `json:"lon"`
		Acc float64 `json:"acc"`
	} `json:"gps"`
}

func (s *Sender) SendFingerprintAlert(
	ctx context.Context,
	botToken, chatIDs, memo, sourceIP string,
	fpBody []byte,
) error {
	var fp fingerprintPayload
	if err := json.Unmarshal(fpBody, &fp); err != nil {
		return err
	}

	// ── GPS alert (separate message) ──
	if fp.GPS != nil && (fp.GPS.Lat != 0 || fp.GPS.Lon != 0) {
		var b strings.Builder
		b.WriteString("📍 *Нақты GPS координаттары анықталды:* ")
		b.WriteString(EscapeMD(memo))
		if sourceIP != "" {
			b.WriteString("\n*IP:* " + EscapeMD(sourceIP))
		}
		b.WriteString(fmt.Sprintf("\n\n*Координат:* `%.6f, %.6f`", fp.GPS.Lat, fp.GPS.Lon))
		if fp.GPS.Acc > 0 {
			b.WriteString(fmt.Sprintf(" \\(дәлдігі: ±%.0f метр\\)", fp.GPS.Acc))
		}
		mapsURL := fmt.Sprintf("https://www.google.com/maps?q=%.6f,%.6f", fp.GPS.Lat, fp.GPS.Lon)
		b.WriteString("\n\n[Google Maps картасынан көру](" + mapsURL + ")")
		return s.SendMessage(ctx, botToken, chatIDs, b.String())
	}

	var b strings.Builder
	b.WriteString("🔬 *Құрылғының терең анализі \\(Фингерпринт\\):*")
	if memo != "" {
		b.WriteString("\n*Тұзақ:* " + EscapeMD(memo))
	}
	if sourceIP != "" {
		b.WriteString("\n*IP:* " + EscapeMD(sourceIP))
	}

	// ── Composite hash — unique device ID ──
	if fp.CompositeHash != "" {
		short := fp.CompositeHash
		if len(short) > 16 {
			short = short[:16]
		}
		b.WriteString("\n\n🆔 *Бірегей құрылғы ID:* `" + short + "`")
	}

	// ── Device identification ──
	exactDevice := detectExactModel(fp.Screen.W, fp.Screen.H, fp.Screen.DPR, fp.Platform)
	if exactDevice != "" {
		b.WriteString("\n*Нақты құрылғы:* " + EscapeMD(exactDevice))
	}

	if fp.WebGL != nil && fp.WebGL.Renderer != "" {
		gpu := cleanGPUName(fp.WebGL.Renderer)
		b.WriteString("\n*Видеочип \\(GPU\\):* " + EscapeMD(gpu))
	}

	if fp.DeviceMemory != nil && *fp.DeviceMemory > 0 {
		b.WriteString(fmt.Sprintf("\n*Жады \\(RAM\\):* %g ГБ", *fp.DeviceMemory))
	}

	if fp.HWConcurrency > 0 {
		b.WriteString(fmt.Sprintf("\n*Процессор:* %d ядро", fp.HWConcurrency))
	}

	// ── Fingerprint hashes ──
	if fp.CanvasHash != "" || fp.AudioHash != "" || fp.FontsHash != "" {
		b.WriteString("\n")
		if fp.CanvasHash != "" {
			b.WriteString("\n🎨 *Canvas хэш:* `" + fp.CanvasHash + "`")
		}
		if fp.AudioHash != "" {
			audioShort := fp.AudioHash
			if len(audioShort) > 20 {
				audioShort = audioShort[:20]
			}
			b.WriteString("\n🔊 *Audio хэш:* `" + audioShort + "`")
		}
		if fp.FontsHash != "" {
			b.WriteString("\n🔤 *Қаріптер хэші:* `" + fp.FontsHash + "`")
		}
	}

	// ── WebRTC IP leak ──
	if len(fp.WebRTCIPs) > 0 {
		b.WriteString("\n\n⚠️ *WebRTC ішкі IP анықталды:*")
		for _, ip := range fp.WebRTCIPs {
			b.WriteString("\n  • `" + ip + "`")
		}
	}

	// ── Fonts ──
	if fp.FontCount > 0 {
		b.WriteString(fmt.Sprintf("\n\n🔤 *Орнатылған қаріптер:* %d дана", fp.FontCount))
		if len(fp.Fonts) > 0 {
			maxShow := 8
			if len(fp.Fonts) < maxShow {
				maxShow = len(fp.Fonts)
			}
			b.WriteString(" \\(" + EscapeMD(strings.Join(fp.Fonts[:maxShow], ", ")))
			if len(fp.Fonts) > maxShow {
				b.WriteString(fmt.Sprintf(", \\+%d", len(fp.Fonts)-maxShow))
			}
			b.WriteString("\\)")
		}
	}

	// ── Network info ──
	if fp.NetworkInfo != nil {
		var netType string
		switch {
		case fp.NetworkInfo.Type != "":
			netType = fp.NetworkInfo.Type
		case fp.NetworkInfo.EffectiveType != "":
			netType = fp.NetworkInfo.EffectiveType
		}
		if netType != "" {
			netIcon := "🌐"
			switch netType {
			case "wifi":
				netIcon = "📶"
			case "cellular":
				netIcon = "📱"
			case "4g":
				netIcon = "📱 4G"
			case "3g":
				netIcon = "📱 3G"
			case "2g":
				netIcon = "📱 2G"
			case "ethernet":
				netIcon = "🔌"
			}
			b.WriteString("\n\n" + netIcon + " *Байланыс түрі:* " + EscapeMD(netType))
		}
		if fp.NetworkInfo.Downlink > 0 {
			b.WriteString(fmt.Sprintf("\n*Жылдамдық:* ~%.1f Mbps", fp.NetworkInfo.Downlink))
		}
		if fp.NetworkInfo.RTT > 0 {
			b.WriteString(fmt.Sprintf(" \\(RTT: %dms\\)", fp.NetworkInfo.RTT))
		}
		if fp.NetworkInfo.SaveData {
			b.WriteString("\n💡 *Деректерді үнемдеу режимі:* Қосулы")
		}
	}

	// ── Battery ──
	if fp.Battery != nil && fp.Battery.Level > 0 {
		batStr := fmt.Sprintf("%d%%", fp.Battery.Level)
		if fp.Battery.Charging {
			batStr += " ⚡ Қуатталуда"
		} else {
			batStr += " 🔋 Батареядан"
		}
		b.WriteString("\n*Батарея:* " + EscapeMD(batStr))
	}

	// ── Timezone & Languages ──
	if fp.Timezone != "" {
		b.WriteString("\n*Уақыт белдеуі:* " + EscapeMD(fp.Timezone))
	}
	if len(fp.Languages) > 0 {
		b.WriteString("\n*Тілдер:* " + EscapeMD(strings.Join(fp.Languages, ", ")))
	} else if fp.Language != "" {
		b.WriteString("\n*Тіл:* " + EscapeMD(fp.Language))
	}

	// ── Touch ──
	if fp.Touch > 0 {
		b.WriteString(fmt.Sprintf("\n*Экран:* Сенсорлы \\(%d нүкте\\)", fp.Touch))
	} else if fp.Screen.W > 0 {
		b.WriteString("\n*Экран:* Компьютер / Монитор")
	}

	// ── Storage / Privacy detection ──
	if fp.Storage != nil {
		if !fp.Storage.LocalStorage || !fp.Storage.CookieEnabled {
			b.WriteString("\n\n🕵️ *Жасырын режим белгілері:*")
			if !fp.Storage.LocalStorage {
				b.WriteString(" localStorage бұғатталған")
			}
			if !fp.Storage.CookieEnabled {
				b.WriteString(" Cookie өшірілген")
			}
		}
	}

	return s.SendMessage(ctx, botToken, chatIDs, b.String())
}

func parseDeviceInfo(ua string) (device string, app string) {
	switch {
	case strings.Contains(ua, "iPhone"):
		device = "Apple iPhone"
		if idx := strings.Index(ua, "CPU iPhone OS "); idx != -1 {
			ver := ua[idx+len("CPU iPhone OS "):]
			if end := strings.IndexAny(ver, " ;)"); end != -1 {
				ver = ver[:end]
			}
			ver = strings.ReplaceAll(ver, "_", ".")
			device = "Apple iPhone (iOS " + ver + ")"
		}
	case strings.Contains(ua, "iPad"):
		device = "Apple iPad"
	case strings.Contains(ua, "Android"):
		device = "Android құрылғысы"
		if idx := strings.Index(ua, "Android "); idx != -1 {
			ver := ua[idx+len("Android "):]
			if end := strings.IndexAny(ver, ";)"); end != -1 {
				ver = ver[:end]
			}
			device = "Android " + ver
		}
	case strings.Contains(ua, "Macintosh"):
		device = "Apple Mac (macOS)"
	case strings.Contains(ua, "Windows"):
		device = "Windows компьютері"
	case strings.Contains(ua, "Linux"):
		device = "Linux жүйесі"
	default:
		device = "Анықталмаған құрылғы"
	}

	switch {
	case strings.Contains(ua, "Telegram"):
		app = "Telegram қолданбасы"
	case strings.Contains(ua, "WhatsApp"):
		app = "WhatsApp қолданбасы"
	case strings.Contains(ua, "Instagram"):
		app = "Instagram қолданбасы"
	case strings.Contains(ua, "Chrome") && !strings.Contains(ua, "Edg") && !strings.Contains(ua, "OPR"):
		if strings.Contains(ua, "Mobile") {
			app = "Google Chrome (Mobile)"
		} else {
			app = "Google Chrome"
		}
	case strings.Contains(ua, "Safari") && !strings.Contains(ua, "Chrome"):
		if strings.Contains(ua, "Mobile") {
			app = "Mobile Safari"
		} else {
			app = "Apple Safari"
		}
	case strings.Contains(ua, "Firefox"):
		app = "Mozilla Firefox"
	case strings.Contains(ua, "Edg"):
		app = "Microsoft Edge"
	default:
		app = ""
	}
	return device, app
}

func formatTokenType(t string) string {
	switch t {
	case "slowredirect":
		return "Сілтеме тұзағы (Slow Redirect)"
	case "webbug":
		return "Веб-пиксель (Web Bug)"
	case "docx":
		return "Word құжаты (DOCX)"
	case "pdf":
		return "PDF құжаты"
	case "kubeconfig":
		return "Kubeconfig файлы"
	case "envfile":
		return ".env файлы"
	case "mysql":
		return "MySQL деректер базасы"
	default:
		return t
	}
}

func formatGeo(evt *event.Event) string {
	city := derefStr(evt.GeoCity)
	country := derefStr(evt.GeoCountry)
	asnOrg := derefStr(evt.GeoASNOrg)

	var parens string
	switch {
	case city != "" && country != "":
		parens = `\(` + EscapeMD(city) + ", " + EscapeMD(country) + `\)`
	case country != "":
		parens = `\(` + EscapeMD(country) + `\)`
	case city != "":
		parens = `\(` + EscapeMD(city) + `\)`
	}
	if parens == "" && asnOrg == "" {
		return ""
	}
	if asnOrg == "" {
		return parens
	}
	if parens == "" {
		return "— " + EscapeMD(asnOrg)
	}
	return parens + " — " + EscapeMD(asnOrg)
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func truncateRunes(s string, max int) string {
	if max <= 0 {
		return ""
	}
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max])
}

func EscapeMD(s string) string {
	var b strings.Builder
	b.Grow(len(s) + 8)
	for _, r := range s {
		if strings.ContainsRune(v2SpecialChars, r) {
			b.WriteRune('\\')
		}
		b.WriteRune(r)
	}
	return b.String()
}

func detectExactModel(w, h int, dpr float64, platform string) string {
	if w > h {
		w, h = h, w
	}

	if strings.Contains(platform, "iPhone") || strings.Contains(platform, "iOS") {
		switch {
		case w == 320 && h == 568:
			return "Apple iPhone 5 / 5s / SE (1-буын)"
		case w == 375 && h == 667:
			if dpr >= 2.5 {
				return "Apple iPhone Plus (Zoomed)"
			}
			return "Apple iPhone 6 / 6s / 7 / 8 / SE (2/3-буын)"
		case w == 414 && h == 736:
			return "Apple iPhone 6 Plus / 7 Plus / 8 Plus"
		case w == 375 && h == 812:
			return "Apple iPhone X / XS / 11 Pro / 12 mini / 13 mini"
		case w == 390 && h == 844:
			return "Apple iPhone 12 / 12 Pro / 13 / 13 Pro / 14"
		case w == 393 && h == 852:
			return "Apple iPhone 14 Pro / 15 / 15 Pro / 16"
		case w == 402 && h == 874:
			return "Apple iPhone 16 Pro"
		case w == 414 && h == 896:
			if dpr <= 2.2 {
				return "Apple iPhone XR / iPhone 11"
			}
			return "Apple iPhone XS Max / 11 Pro Max"
		case w == 428 && h == 926:
			return "Apple iPhone 12 Pro Max / 13 Pro Max / 14 Plus"
		case w == 430 && h == 932:
			return "Apple iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus"
		case w == 440 && h == 956:
			return "Apple iPhone 16 Pro Max"
		default:
			if w > 0 && h > 0 {
				return fmt.Sprintf("Apple iPhone (%d×%d, DPR %.1f)", w, h, dpr)
			}
			return "Apple iPhone"
		}
	}

	if strings.Contains(platform, "iPad") {
		return fmt.Sprintf("Apple iPad (%d×%d)", w, h)
	}

	if strings.Contains(platform, "Mac") {
		return fmt.Sprintf("Apple Mac (%d×%d, DPR %.1f)", w, h, dpr)
	}

	if strings.Contains(platform, "Win") {
		return fmt.Sprintf("Windows PC (%d×%d, DPR %.1f)", w, h, dpr)
	}

	if strings.Contains(platform, "Linux") || strings.Contains(platform, "Android") {
		if w > 0 && h > 0 {
			return fmt.Sprintf("Android / Linux (%d×%d, DPR %.1f)", w, h, dpr)
		}
		return "Android құрылғысы"
	}

	if w > 0 && h > 0 {
		return fmt.Sprintf("%s (%d×%d, DPR %.1f)", platform, w, h, dpr)
	}
	return platform
}

func cleanGPUName(r string) string {
	r = strings.TrimSpace(r)
	if strings.HasPrefix(r, "ANGLE (") && strings.HasSuffix(r, ")") {
		inner := strings.TrimSuffix(strings.TrimPrefix(r, "ANGLE ("), ")")
		parts := strings.Split(inner, ",")
		if len(parts) >= 2 {
			return strings.TrimSpace(parts[1])
		}
	}
	return r
}

func formatReferer(ref string) string {
	lower := strings.ToLower(ref)
	switch {
	case strings.Contains(lower, "t.me") || strings.Contains(lower, "telegram"):
		return "Telegram мессенджері"
	case strings.Contains(lower, "whatsapp"):
		return "WhatsApp қолданбасы"
	case strings.Contains(lower, "instagram"):
		return "Instagram қолданбасы"
	case strings.Contains(lower, "facebook") || strings.Contains(lower, "fb.com"):
		return "Facebook"
	case strings.Contains(lower, "twitter") || strings.Contains(lower, "x.com"):
		return "Twitter / X"
	case strings.Contains(lower, "vk.com"):
		return "ВКонтакте"
	case strings.Contains(lower, "tiktok"):
		return "TikTok"
	default:
		return ref
	}
}

func formatLanguages(langHeader string) string {
	parts := strings.Split(langHeader, ",")
	var cleaned []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if idx := strings.Index(p, ";"); idx != -1 {
			p = p[:idx]
		}
		if p != "" {
			cleaned = append(cleaned, p)
		}
		if len(cleaned) >= 4 {
			break
		}
	}
	return strings.Join(cleaned, ", ")
}

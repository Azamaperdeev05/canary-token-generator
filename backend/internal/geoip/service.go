// ©AngelaMos | 2026
// service.go

package geoip

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/oschwald/geoip2-golang/v2"
)

type Lookup struct {
	Country string
	Region  string
	City    string
	ASNOrg  string
	ASN     int
	ISP     string
	Mobile  bool
	Proxy   bool
	Hosting bool
}

type Lookuper interface {
	Lookup(ip string) Lookup
}

type cityReader interface {
	City(netip.Addr) (*geoip2.City, error)
	Close() error
}

type Service struct {
	reader cityReader
}

func Open(path string) (*Service, error) {
	if path == "" {
		return nil, errors.New("geoip: path is empty")
	}
	r, err := geoip2.Open(path)
	if err != nil {
		return nil, fmt.Errorf("geoip open %q: %w", path, err)
	}
	return &Service{reader: r}, nil
}

func (s *Service) Lookup(ip string) Lookup {
	if s == nil || ip == "" {
		return onlineLookup(ip)
	}
	if s.reader == nil {
		return onlineLookup(ip)
	}
	addr, err := netip.ParseAddr(ip)
	if err != nil {
		return Lookup{}
	}
	rec, err := s.reader.City(addr)
	if err != nil || rec == nil || !rec.HasData() {
		return onlineLookup(ip)
	}
	l := extractLookup(rec)
	if l.City == "" && l.Country == "" {
		return onlineLookup(ip)
	}
	ol := onlineLookup(ip)
	if ol.ISP != "" {
		l.ISP = ol.ISP
		if l.ASNOrg == "" {
			l.ASNOrg = ol.ASNOrg
		}
		if l.ASN == 0 {
			l.ASN = ol.ASN
		}
		l.Mobile = ol.Mobile
		l.Proxy = ol.Proxy
		l.Hosting = ol.Hosting
	}
	return l
}

func (s *Service) Close() error {
	if s == nil || s.reader == nil {
		return nil
	}
	return s.reader.Close()
}

type nopService struct{}

func NopService() Lookuper {
	return nopService{}
}

func (nopService) Lookup(ip string) Lookup {
	return onlineLookup(ip)
}

type onlineService struct{}

func OnlineService() Lookuper {
	return onlineService{}
}

func (onlineService) Lookup(ip string) Lookup {
	return onlineLookup(ip)
}

var (
	onlineCache sync.Map
	httpClient  = &http.Client{Timeout: 1500 * time.Millisecond}
)

func isPrivateIP(ipStr string) bool {
	addr, err := netip.ParseAddr(ipStr)
	if err != nil {
		return true
	}
	return addr.IsPrivate() || addr.IsLoopback() || addr.IsLinkLocalUnicast()
}

func onlineLookup(ip string) Lookup {
	if isPrivateIP(ip) {
		return Lookup{}
	}
	if val, ok := onlineCache.Load(ip); ok {
		return val.(Lookup)
	}

	url := "http://ip-api.com/json/" + ip + "?fields=status,country,countryCode,regionName,city,isp,org,as,mobile,proxy,hosting"
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return Lookup{}
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return Lookup{}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Lookup{}
	}

	var res struct {
		Status      string `json:"status"`
		CountryCode string `json:"countryCode"`
		RegionName  string `json:"regionName"`
		City        string `json:"city"`
		ISP         string `json:"isp"`
		Org         string `json:"org"`
		AS          string `json:"as"`
		Mobile      bool   `json:"mobile"`
		Proxy       bool   `json:"proxy"`
		Hosting     bool   `json:"hosting"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil || res.Status != "success" {
		return Lookup{}
	}

	asnNum := 0
	asnOrg := res.Org
	if asnOrg == "" {
		asnOrg = res.ISP
	}
	if strings.HasPrefix(res.AS, "AS") {
		parts := strings.SplitN(res.AS, " ", 2)
		if n, err := strconv.Atoi(strings.TrimPrefix(parts[0], "AS")); err == nil {
			asnNum = n
		}
		if len(parts) > 1 && (asnOrg == "" || asnOrg == res.ISP) {
			asnOrg = parts[1]
		}
	}

	l := Lookup{
		Country: res.CountryCode,
		Region:  res.RegionName,
		City:    res.City,
		ASNOrg:  asnOrg,
		ASN:     asnNum,
		ISP:     res.ISP,
		Mobile:  res.Mobile,
		Proxy:   res.Proxy,
		Hosting: res.Hosting,
	}

	onlineCache.Store(ip, l)
	return l
}

func extractLookup(rec *geoip2.City) Lookup {
	if rec == nil {
		return Lookup{}
	}
	return Lookup{
		Country: rec.Country.ISOCode,
		Region:  firstSubdivisionName(rec.Subdivisions),
		City:    rec.City.Names.English,
	}
}

func firstSubdivisionName(subs []geoip2.CitySubdivision) string {
	for _, s := range subs {
		if s.Names.English != "" {
			return s.Names.English
		}
		if s.ISOCode != "" {
			return s.ISOCode
		}
	}
	return ""
}

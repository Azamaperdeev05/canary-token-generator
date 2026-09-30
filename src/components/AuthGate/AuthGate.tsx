// ==========================================
// © SiteQur — Dashboard Access Gate
// AuthGate.tsx
// ==========================================

import React, { useState } from 'react'
import { FiEye, FiEyeOff, FiKey, FiLock } from 'react-icons/fi'
import { toast } from 'sonner'
import styles from './AuthGate.module.scss'

// Default hardcoded SHA-256 hash of the master password:
// "SiteQur-2026-X9kM7Q-vL4pRtY-MasterKey-9842"
const MASTER_SHA256 = '38d9b3b0a8fc99c99de979d9fe6073518cce868c2dd5a463d3d5ea386bcf8692'
const AUTH_STORAGE_KEY = 'sitequr_auth_token'
const AUTH_VALUE = 'authorized_admin_azamat'

async function computeSHA256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text)
  const hashBuf = await crypto.subtle.digest('SHA-256', enc)
  const hashArr = Array.from(new Uint8Array(hashBuf))
  return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function logoutDashboard(): void {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    window.location.reload()
  } catch {}
}

export function AuthGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return (
        sessionStorage.getItem(AUTH_STORAGE_KEY) === AUTH_VALUE ||
        localStorage.getItem(AUTH_STORAGE_KEY) === AUTH_VALUE
      )
    } catch {
      return false
    }
  })

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = password.trim()
    if (!trimmed) {
      setError('Құпиясөзді енгізіңіз')
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      const hashed = await computeSHA256(trimmed)
      const envPassword = import.meta.env.VITE_DASHBOARD_PASSWORD?.trim()

      const isValid = hashed === MASTER_SHA256 || (envPassword && trimmed === envPassword)

      if (isValid) {
        if (rememberMe) {
          localStorage.setItem(AUTH_STORAGE_KEY, AUTH_VALUE)
        } else {
          sessionStorage.setItem(AUTH_STORAGE_KEY, AUTH_VALUE)
        }
        toast.success('✅ Қолжетімділік ашылды! Қош келдіңіз.')
        setIsAuthenticated(true)
      } else {
        setError('❌ Құпиясөз қате! Дұрыс көшіріп салғаныңызға көз жеткізіңіз.')
        toast.error('Қате құпиясөз!')
      }
    } catch {
      setError('Тексеру кезінде қате орын алды')
    } finally {
      setIsVerifying(false)
    }
  }

  if (isAuthenticated) {
    return <>{children}</>
  }

  return (
    <div className={styles.gateOverlay}>
      <div className={styles.lockCard}>
        <div className={styles.iconCircle}>
          <FiLock />
        </div>

        <span className={styles.badge}>ҚОРҒАЛҒАН БАСҚАРУ ТАҚТАСЫ</span>
        <h1 className={styles.title}>ҚОЛЖЕТІМДІЛІК ЖАБЫҚ</h1>
        <p className={styles.subtitle}>
          Бұл жүйеге кіру үшін әкімшілік шебер кілтті (Master Password) енгізу қажет.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputWrapper}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Шебер құпиясөзді осында қойыңыз (Paste)…"
              className={styles.input}
              autoFocus
              disabled={isVerifying}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={styles.toggleBtn}
              tabIndex={-1}
              aria-label={showPassword ? 'Құпиясөзді жасыру' : 'Құпиясөзді көрсету'}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          <label className={styles.rememberRow}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Мені есте сақтау (келесіде сұрамау)
          </label>

          <button type="submit" disabled={isVerifying} className={styles.submitBtn}>
            <FiKey style={{ fontSize: 16 }} />
            {isVerifying ? 'Тексерілуде…' : 'КІРУ (РҰҚСАТ АЛУ)'}
          </button>

          {error && <div className={styles.errorText}>{error}</div>}
        </form>

        <div className={styles.footerNote}>
          🔒 256-bit SHA-256 криптографиялық хэшпен қорғалған. Рұқсатсыз адамдар бақылау тақтасын көре алмайды.
        </div>
      </div>
    </div>
  )
}

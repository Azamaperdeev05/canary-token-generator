// ===================
// ©AngelaMos | 2026
// shell.tsx
// ===================

import { Suspense, useEffect } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Outlet, useNavigate } from 'react-router-dom'

function ShellErrorFallback({ error }: { error: Error }): React.ReactElement {
  return <pre>{error.message}</pre>
}

export function Shell(): React.ReactElement {
  const navigate = useNavigate()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashPath = window.location.hash.replace(/^#\/?/, '/')
      if (hashPath && hashPath !== '/') {
        navigate(hashPath, { replace: true })
      }
    }
  }, [navigate])

  return (
    <ErrorBoundary FallbackComponent={ShellErrorFallback}>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  )
}

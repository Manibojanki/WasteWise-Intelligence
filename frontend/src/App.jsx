
import { useEffect, useState } from 'react'
import Auth from './Auth'
import Workspace from './Workspace'
import './App.css'

const API_URL = 'http://127.0.0.1:8000'

// Install the authentication wrapper immediately when this module loads.
// This ensures Workspace API requests receive the token from their first request.
if (
  typeof window !== 'undefined' &&
  !window.__wastewiseFetchPatched
) {
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (resource, options = {}) => {
    const url =
      typeof resource === 'string'
        ? resource
        : resource instanceof Request
          ? resource.url
          : String(resource)

    const isBackendRequest = url.startsWith(API_URL)

    const isPublicAuthRequest =
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/register-admin')

    if (!isBackendRequest || isPublicAuthRequest) {
      return originalFetch(resource, options)
    }

    const token = sessionStorage.getItem('wastewise_token')

    const headers = new Headers(
      resource instanceof Request ? resource.headers : undefined
    )

    if (options.headers) {
      new Headers(options.headers).forEach((value, key) => {
        headers.set(key, value)
      })
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return originalFetch(resource, {
      ...options,
      headers
    })
  }

  window.__wastewiseFetchPatched = true
}

function App() {
  const [user, setUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let active = true

    async function restoreSession() {
      const token = sessionStorage.getItem('wastewise_token')

      if (!token) {
        if (active) {
          setCheckingSession(false)
        }
        return
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/me`)

        if (!response.ok) {
          sessionStorage.removeItem('wastewise_token')
          sessionStorage.removeItem('wastewise_user')

          if (active) {
            setUser(null)
          }

          return
        }

        const account = await response.json()

        if (active) {
          setUser(account)
          sessionStorage.setItem(
            'wastewise_user',
            JSON.stringify(account)
          )
        }
      } catch (error) {
        console.error('Session restoration failed:', error)

        sessionStorage.removeItem('wastewise_token')
        sessionStorage.removeItem('wastewise_user')

        if (active) {
          setUser(null)
        }
      } finally {
        if (active) {
          setCheckingSession(false)
        }
      }
    }

    restoreSession()

    return () => {
      active = false
    }
  }, [])

  function handleAuthenticated(account) {
    setUser(account)
  }

  function handleLogout() {
    sessionStorage.removeItem('wastewise_token')
    sessionStorage.removeItem('wastewise_user')
    setUser(null)
  }

  if (checkingSession) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#f4f6f0',
          color: '#315c43',
          fontFamily: 'Inter, Segoe UI, sans-serif'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 12 }}>
            ♧
          </div>
          <strong>Checking your WasteWise session...</strong>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Auth onAuthenticated={handleAuthenticated} />
  }

  const role = String(user.role || 'user').toLowerCase()

  return (
    <div className={`authenticated-app role-${role}`}>
      <div
        style={{
          minHeight: 48,
          padding: '8px 22px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 15,
          flexWrap: 'wrap',
          background: '#fbfcf9',
          borderBottom: '1px solid #e8ece5',
          color: '#607365',
          fontSize: 12
        }}
      >
        <span>
          Signed in as{' '}
          <strong style={{ color: '#315c43' }}>
            {user.username}
          </strong>
        </span>

        <span
          style={{
            padding: '5px 10px',
            borderRadius: 20,
            background: '#e8eee3',
            color: '#315c43',
            fontWeight: 700,
            textTransform: 'capitalize'
          }}
        >
          {role}
        </span>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            border: '1px solid #dce5d8',
            background: '#fff',
            color: '#315c43',
            borderRadius: 8,
            padding: '8px 13px',
            fontWeight: 700,
            fontSize: 11,
            cursor: 'pointer'
          }}
        >
          Log out
        </button>
      </div>

      <Workspace />

      <style>{`
        .role-user .sidebar nav .nav-item:nth-child(6),
        .role-user .sidebar nav .nav-item:nth-child(8) {
          display: none;
        }

        .role-reviewer .sidebar nav .nav-item:nth-child(8) {
          display: none;
        }
      `}</style>
    </div>
  )
}

export default App

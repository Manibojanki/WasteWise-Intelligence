
import { useState } from 'react'

const API_URL = 'http://127.0.0.1:8000'

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (loading) return

    setLoading(true)

    try {
      const endpoint = mode === 'login'
        ? '/api/auth/login'
        : '/api/auth/register'

      const payload = mode === 'login'
        ? {
            username_or_email: username.trim(),
            password
          }
        : {
            username: username.trim(),
            email: email.trim(),
            password
          }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        const detail = typeof data.detail === 'string'
          ? data.detail
          : 'Authentication request failed.'

        throw new Error(detail)
      }

      if (mode === 'register') {
        setMessage('Account created successfully. You can now log in.')
        setMode('login')
        setPassword('')
        return
      }

      if (!data.access_token || !data.user) {
        throw new Error('The server returned an incomplete login response.')
      }

      sessionStorage.setItem('wastewise_token', data.access_token)
      sessionStorage.setItem('wastewise_user', JSON.stringify(data.user))

      onAuthenticated(data.user)
    } catch (err) {
      setError(err.message || 'Unable to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '13px 14px',
    border: '1px solid #dce5d8',
    borderRadius: 9,
    background: '#fff',
    color: '#304b35',
    fontSize: 14,
    outline: 'none'
  }

  const labelStyle = {
    display: 'grid',
    gap: 8,
    color: '#52644f',
    fontSize: 13,
    fontWeight: 600
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
      background: '#f4f6f0'
    }}>
      <div style={{
        background: '#e8eee3',
        padding: 'clamp(30px, 7vw, 90px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          marginBottom: 65
        }}>
          <div style={{
            width: 49,
            height: 49,
            display: 'grid',
            placeItems: 'center',
            background: '#315c43',
            color: '#fff',
            borderRadius: 14,
            fontSize: 27
          }}>
            ♧
          </div>

          <div>
            <h2 style={{
              margin: 0,
              color: '#263d2f',
              fontSize: 22
            }}>
              WasteWise
            </h2>
            <span style={{
              color: '#708273',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 2
            }}>
              INTELLIGENCE
            </span>
          </div>
        </div>

        <p style={{
          color: '#839386',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 2
        }}>
          SMARTER WASTE MANAGEMENT
        </p>

        <h1 style={{
          color: '#263d2f',
          fontSize: 'clamp(35px, 5vw, 55px)',
          lineHeight: 1.15,
          letterSpacing: -2,
          maxWidth: 480
        }}>
          Understand your waste. Make a difference.
        </h1>

        <p style={{
          color: '#718174',
          fontSize: 15,
          lineHeight: 1.9,
          maxWidth: 440
        }}>
          AI-powered waste classification, intelligent sorting guidance,
          and meaningful insights for a cleaner future.
        </p>

        <div style={{
          marginTop: 35,
          display: 'grid',
          gap: 15,
          color: '#526b59',
          fontSize: 13
        }}>
          <div>✓ AI-powered waste recognition</div>
          <div>✓ Local disposal guidance</div>
          <div>✓ Classification history and analytics</div>
          <div>✓ Human-reviewed predictions</div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        placeItems: 'center',
        padding: 25
      }}>
        <div style={{
          width: '100%',
          maxWidth: 440,
          background: '#fff',
          border: '1px solid #e9eee6',
          borderRadius: 18,
          padding: 'clamp(24px, 5vw, 42px)',
          boxShadow: '0 15px 45px rgba(49,92,67,0.06)'
        }}>
          <p style={{
            color: '#839386',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 2,
            marginBottom: 12
          }}>
            {mode === 'login' ? 'WELCOME BACK' : 'JOIN WASTEWISE'}
          </p>

          <h2 style={{
            color: '#263d2f',
            fontSize: 29,
            margin: '0 0 10px'
          }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </h2>

          <p style={{
            color: '#89968a',
            fontSize: 13,
            lineHeight: 1.7,
            marginBottom: 28
          }}>
            {mode === 'login'
              ? 'Enter your credentials to access your workspace.'
              : 'Create a standard user account to get started.'}
          </p>

          <form onSubmit={handleSubmit} style={{
            display: 'grid',
            gap: 18
          }}>
            <label style={labelStyle}>
              {mode === 'login' ? 'Username or email' : 'Username'}

              <input
                type="text"
                value={username}
                onChange={event => setUsername(event.target.value)}
                placeholder={mode === 'login' ? 'Enter username or email' : 'Choose a username'}
                minLength={mode === 'login' ? undefined : 3}
                maxLength={mode === 'login' ? 150 : 50}
                autoComplete="username"
                required
                style={inputStyle}
              />
            </label>

            {mode === 'register' && (
              <label style={labelStyle}>
                Email address

                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="Enter your email address"
                  maxLength={150}
                  autoComplete="email"
                  required
                  style={inputStyle}
                />
              </label>
            )}

            <label style={labelStyle}>
              Password

              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Enter your password"
                minLength={mode === 'register' ? 8 : 1}
                maxLength={72}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                style={inputStyle}
              />
            </label>

            {error && (
              <div role="alert" style={{
                background: '#fff0ed',
                color: '#b34b43',
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.6
              }}>
                {error}
              </div>
            )}

            {message && (
              <div role="status" style={{
                background: '#e8f3e6',
                color: '#39734b',
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.6
              }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: 14,
                border: 0,
                borderRadius: 9,
                background: '#315c43',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.65 : 1
              }}
            >
              {loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign in →'
                  : 'Create account →'}
            </button>
          </form>

          <div style={{
            borderTop: '1px solid #edf0eb',
            marginTop: 25,
            paddingTop: 22,
            textAlign: 'center',
            color: '#829084',
            fontSize: 13
          }}>
            {mode === 'login'
              ? "Don't have an account?"
              : 'Already have an account?'}

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                setError('')
                setMessage('')
                setPassword('')
              }}
              style={{
                marginLeft: 6,
                border: 0,
                background: 'transparent',
                color: '#315c43',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>

          <p style={{
            textAlign: 'center',
            color: '#a0aaa1',
            fontSize: 10,
            margin: '25px 0 0'
          }}>
            WasteWise Intelligence · Secure access
          </p>
        </div>
      </div>
    </div>
  )
}

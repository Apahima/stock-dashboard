import { useState, useEffect, useCallback } from 'react'
import './App.css'

const APP_USER = import.meta.env.VITE_APP_USER || 'admin'
const APP_PASS = import.meta.env.VITE_APP_PASS || ''

const INDICES = [
  { symbol: 'SPY', label: 'S&P 500 (SPY)' },
  { symbol: 'QQQ', label: 'NASDAQ (QQQ)'  },
  { symbol: 'DIA', label: 'DOW (DIA)'     },
  { symbol: 'IWM', label: 'Russell 2000'  },
]

const STOCKS = [
  { symbol: 'AAPL',  name: 'Apple' },
  { symbol: 'MSFT',  name: 'Microsoft' },
  { symbol: 'NVDA',  name: 'NVIDIA' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMZN',  name: 'Amazon' },
  { symbol: 'META',  name: 'Meta' },
  { symbol: 'TSLA',  name: 'Tesla' },
  { symbol: 'JPM',   name: 'JPMorgan Chase' },
  { symbol: 'V',     name: 'Visa' },
  { symbol: 'UNH',   name: 'UnitedHealth' },
  { symbol: 'WMT',   name: 'Walmart' },
  { symbol: 'XOM',   name: 'Exxon Mobil' },
]

function isMarketOpen() {
  const et   = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day  = et.getDay()
  const mins = et.getHours() * 60 + et.getMinutes()
  return day >= 1 && day <= 5 && mins >= 570 && mins < 960
}

function fmt(n) {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts * 1000) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return `${Math.floor(diff / 1440)}d ago`
}

function fgColor(score) {
  if (score <= 24) return '#ef4444'
  if (score <= 44) return '#f97316'
  if (score <= 54) return '#eab308'
  if (score <= 74) return '#22c55e'
  return '#16a34a'
}

function ChangeLabel({ d, dp }) {
  if (d == null) return <span className="neutral">—</span>
  const cls   = d >= 0 ? 'positive' : 'negative'
  const arrow = d >= 0 ? '▲' : '▼'
  return (
    <span className={cls}>
      {arrow} {fmt(Math.abs(d))} ({fmt(Math.abs(dp))}%)
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="stock-card">
      <div className="skeleton skeleton-line" style={{ width: '40%' }} />
      <div className="skeleton skeleton-line" style={{ width: '70%', marginBottom: 14 }} />
      <div className="skeleton skeleton-price" />
      <div className="skeleton skeleton-line" style={{ width: '60%' }} />
    </div>
  )
}

// ── Login screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [user, setUser]   = useState('')
  const [pass, setPass]   = useState('')
  const [error, setError] = useState('')
  const [show, setShow]   = useState(false)

  const submit = () => {
    if (user.trim() === APP_USER && pass === APP_PASS) {
      onLogin()
    } else {
      setError('Incorrect username or password.')
      setPass('')
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">📈</div>
        <h1 className="login-title">Stock Dashboard</h1>
        <p className="login-sub">Sign in to access your market data</p>
        {error && <div className="login-error">{error}</div>}
        <div className="login-field">
          <label>Username</label>
          <input type="text" placeholder="Enter username" value={user}
            autoComplete="username"
            onChange={e => setUser(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        <div className="login-field">
          <label>Password</label>
          <div className="pass-wrap">
            <input type={show ? 'text' : 'password'} placeholder="Enter password" value={pass}
              autoComplete="current-password"
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} />
            <button className="show-btn" onClick={() => setShow(s => !s)} type="button">
              {show ? '🙈' : '👁'}
            </button>
          </div>
        </div>
        <button className="btn login-btn" onClick={submit}>Sign In</button>
      </div>
    </div>
  )
}

// ── API key setup (one-time per device, shown after login) ────────────────────
function ApiKeyScreen({ onSave }) {
  const [key, setKey]     = useState('')
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)

  const verify = async () => {
    const k = key.trim()
    if (!k) return
    setTesting(true)
    setError('')
    try {
      const res  = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${k}`)
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      localStorage.setItem('finnhub_key', k)
      onSave(k)
    } catch (e) {
      setError(`Key invalid: ${e.message}. Get a free key at finnhub.io/register`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 440 }}>
        <div className="login-logo">🔑</div>
        <h1 className="login-title" style={{ fontSize: '1.25rem' }}>One-time Setup</h1>
        <p className="login-sub">
          Enter your free <a href="https://finnhub.io/register" target="_blank" rel="noreferrer"
            style={{ color: '#38bdf8' }}>Finnhub API key</a> to load stock data.
          It saves in this browser — you won't need it again on this device.
        </p>
        {error && <div className="login-error">{error}</div>}
        <div className="login-field">
          <label>Finnhub API Key</label>
          <input type="text" placeholder="e.g. d7lf361r01qm7o0bk5n0"
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && verify()}
            style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }} />
        </div>
        <button className="btn login-btn" onClick={verify} disabled={!key.trim() || testing}>
          {testing ? 'Verifying…' : 'Save & Continue'}
        </button>
      </div>
    </div>
  )
}

// ── Sentiment cards ───────────────────────────────────────────────────────────
function FearGreedCard({ data, error }) {
  if (error) return (
    <div className="sentiment-card">
      <div className="section-title" style={{ marginBottom: 8 }}>Fear &amp; Greed Index</div>
      <p className="neutral" style={{ fontSize: '0.82rem' }}>
        CNN API unavailable.&nbsp;
        <a href="https://edition.cnn.com/markets/fear-and-greed" target="_blank" rel="noreferrer"
          style={{ color: '#38bdf8' }}>View on CNN →</a>
      </p>
    </div>
  )

  if (!data) return (
    <div className="sentiment-card">
      <div className="skeleton skeleton-line" style={{ width: '55%', marginBottom: 12 }} />
      <div className="skeleton skeleton-price" style={{ width: '30%', marginBottom: 10 }} />
      <div className="skeleton skeleton-line" style={{ width: '80%', marginBottom: 8 }} />
      <div className="skeleton skeleton-line" style={{ width: '60%' }} />
    </div>
  )

  const color = fgColor(data.score)
  return (
    <div className="sentiment-card">
      <div className="section-title" style={{ marginBottom: 12 }}>Fear &amp; Greed Index</div>
      <div className="fg-score" style={{ color }}>{data.score}</div>
      <div className="fg-rating" style={{ color }}>{data.rating}</div>
      <div className="fg-bar-wrap">
        <div className="fg-bar" style={{ width: `${data.score}%`, background: color }} />
      </div>
      <div className="fg-labels">
        <span style={{ color: '#ef4444', fontSize: '0.68rem' }}>Extreme Fear</span>
        <span style={{ color: '#16a34a', fontSize: '0.68rem' }}>Extreme Greed</span>
      </div>
      <div className="fg-history">
        {[
          { label: 'Yesterday',  val: data.previousClose },
          { label: 'Last Week',  val: data.previousWeek  },
          { label: 'Last Month', val: data.previousMonth },
        ].map(({ label, val }) => (
          <div key={label} className="fg-hist-item">
            <span className="fg-hist-label">{label}</span>
            <span style={{ color: fgColor(val), fontWeight: 600 }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AaiiCard({ data }) {
  if (!data || data.date === 'pending') return (
    <div className="sentiment-card">
      <div className="section-title" style={{ marginBottom: 8 }}>AAII Sentiment Survey</div>
      <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6 }}>
        Updated weekly every Thursday via GitHub Actions.
        <br />
        <a href="https://www.aaii.com/sentimentsurvey" target="_blank" rel="noreferrer"
          style={{ color: '#38bdf8' }}>View latest at AAII.com →</a>
      </p>
    </div>
  )

  const total   = data.bullish + data.neutral + data.bearish
  const bullPct = +(data.bullish / total * 100).toFixed(1)
  const neutPct = +(data.neutral / total * 100).toFixed(1)
  const bearPct = +(data.bearish / total * 100).toFixed(1)

  return (
    <div className="sentiment-card">
      <div className="section-title" style={{ marginBottom: 6 }}>AAII Sentiment Survey</div>
      <div className="aaii-date">Week ending {data.date}</div>
      <div className="aaii-bar-track">
        <div style={{ width: `${bullPct}%`, background: '#22c55e' }} />
        <div style={{ width: `${neutPct}%`, background: '#eab308' }} />
        <div style={{ width: `${bearPct}%`, background: '#ef4444' }} />
      </div>
      <div className="aaii-legend">
        <span className="positive">▲ Bull {data.bullish}%</span>
        <span style={{ color: '#eab308' }}>● Neutral {data.neutral}%</span>
        <span className="negative">▼ Bear {data.bearish}%</span>
      </div>
      {data.historicalAvg && (
        <div className="aaii-avg">
          Long-run avg · Bull {data.historicalAvg.bullish}% · Bear {data.historicalAvg.bearish}%
        </div>
      )}
    </div>
  )
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem('auth') === '1')
  const [apiKey, setApiKey]     = useState(() => localStorage.getItem('finnhub_key') || '')
  const [quotes, setQuotes]     = useState({})
  const [news, setNews]         = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [fearGreed, setFearGreed]     = useState(null)
  const [fgError, setFgError]         = useState(false)
  const [aaii, setAaii]               = useState(null)

  const handleLogin = () => { sessionStorage.setItem('auth', '1'); setLoggedIn(true) }
  const handleLogout = () => {
    sessionStorage.removeItem('auth')
    setLoggedIn(false)
  }

  // Fear & Greed — CNN public API, no key needed
  useEffect(() => {
    if (!loggedIn || !apiKey) return
    fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        const fg   = data.fear_and_greed
        const hist = data.fear_and_greed_historical?.data ?? []
        setFearGreed({
          score:         Math.round(fg.score),
          rating:        fg.rating,
          previousClose: Math.round(hist.at(-2)?.y  ?? fg.score),
          previousWeek:  Math.round(hist.at(-6)?.y  ?? fg.score),
          previousMonth: Math.round(hist.at(-22)?.y ?? fg.score),
        })
      })
      .catch(() => setFgError(true))
  }, [loggedIn, apiKey])

  // AAII — cached JSON updated weekly by GitHub Actions
  useEffect(() => {
    if (!loggedIn || !apiKey) return
    fetch('/stock-dashboard/aaii.json')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setAaii)
      .catch(() => {})
  }, [loggedIn, apiKey])

  const fetchQuote = useCallback(async (symbol) => {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data
  }, [apiKey])

  const fetchAll = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    setError('')
    try {
      const allSymbols = [...INDICES.map(i => i.symbol), ...STOCKS.map(s => s.symbol)]
      const results    = await Promise.allSettled(allSymbols.map(s => fetchQuote(s)))
      const map = {}
      allSymbols.forEach((sym, i) => {
        if (results[i].status === 'fulfilled') map[sym] = results[i].value
      })
      if (Object.keys(map).length === 0) {
        const firstErr = results.find(r => r.status === 'rejected')?.reason?.message
        throw new Error(firstErr || 'No data returned — API key may be invalid.')
      }
      setQuotes(map)
      setLastUpdated(new Date())

      const newsRes = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${apiKey}`)
      if (newsRes.ok) setNews((await newsRes.json()).slice(0, 9))
    } catch (e) {
      setError(e.message || 'Failed to fetch data.')
    } finally {
      setLoading(false)
    }
  }, [apiKey, fetchQuote])

  useEffect(() => { if (loggedIn && apiKey) fetchAll() }, [loggedIn, apiKey, fetchAll])

  // ── Render ────────────────────────────────────────────────────────────────
  if (!loggedIn)        return <LoginScreen onLogin={handleLogin} />
  if (!apiKey)          return <ApiKeyScreen onSave={setApiKey} />

  const open = isMarketOpen()

  return (
    <div className="app">
      <div className="header">
        <h1>📈 <span>Stock</span> Dashboard</h1>
        <div className="header-right">
          <div className="market-status">
            <div className={`status-dot${open ? '' : ' closed'}`} />
            {open ? 'Market Open' : 'Market Closed'}
            {lastUpdated && ` · ${lastUpdated.toLocaleTimeString()}`}
          </div>
          <button className="btn" onClick={fetchAll} disabled={loading}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
          <button className="btn btn-outline" onClick={() => { localStorage.removeItem('finnhub_key'); setApiKey('') }}>
            ⚙ Key
          </button>
          <button className="btn btn-outline" onClick={handleLogout}>Sign Out</button>
        </div>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}

      {/* Sentiment */}
      <div className="sentiment-row">
        <FearGreedCard data={fearGreed} error={fgError} />
        <AaiiCard data={aaii} />
      </div>

      {/* Indices */}
      <div className="section-title">Major Indices</div>
      <div className="indices-grid">
        {INDICES.map(({ symbol, label }) => {
          const q = quotes[symbol]
          return (
            <div className="index-card" key={symbol}>
              <div className="index-label">{label}</div>
              {q ? (
                <>
                  <div className="index-price">${fmt(q.c)}</div>
                  <div className="index-change"><ChangeLabel d={q.d} dp={q.dp} /></div>
                </>
              ) : (
                <>
                  <div className="skeleton skeleton-price" />
                  <div className="skeleton skeleton-line" style={{ width: '60%' }} />
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Stocks */}
      <div className="stocks-section">
        <div className="section-title">Top Stocks</div>
        <div className="stocks-grid">
          {STOCKS.map(({ symbol, name }) => {
            const q = quotes[symbol]
            if (!q) return <SkeletonCard key={symbol} />
            return (
              <div className="stock-card" key={symbol}>
                <div className="stock-symbol">{symbol}</div>
                <div className="stock-name">{name}</div>
                <div className="stock-price">${fmt(q.c)}</div>
                <div className="stock-change-row"><ChangeLabel d={q.d} dp={q.dp} /></div>
              </div>
            )
          })}
        </div>
      </div>

      {/* News */}
      {news.length > 0 && (
        <div className="news-section">
          <div className="section-title">Market News</div>
          <div className="news-grid">
            {news.map(item => (
              <a key={item.id} className="news-card" href={item.url} target="_blank" rel="noreferrer">
                <div className="news-source">{item.source}</div>
                <div className="news-headline">{item.headline}</div>
                <div className="news-time">{timeAgo(item.datetime)}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="footer">
        Stocks &amp; news: <a href="https://finnhub.io" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>Finnhub.io</a>
        &nbsp;· Fear &amp; Greed: <a href="https://edition.cnn.com/markets/fear-and-greed" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>CNN</a>
        &nbsp;· Sentiment: <a href="https://www.aaii.com/sentimentsurvey" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>AAII</a>
        &nbsp;· Prices may be delayed 15 min
      </div>
    </div>
  )
}

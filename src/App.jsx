import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

const APP_USER = import.meta.env.VITE_APP_USER || 'admin'
const APP_PASS = import.meta.env.VITE_APP_PASS || ''

const INDICES = [
  { symbol: 'SPY', label: 'S&P 500 (SPY)' },
  { symbol: 'QQQ', label: 'NASDAQ (QQQ)'  },
  { symbol: 'DIA', label: 'DOW (DIA)'     },
  { symbol: 'IWM', label: 'Russell 2000'  },
]

const DEFAULT_STOCKS = [
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

// ─── localStorage helpers ────────────────────────────────────────────────────
function loadStocks() {
  try { const s = localStorage.getItem('watchlist'); if (s) return JSON.parse(s) } catch {}
  return DEFAULT_STOCKS
}
function saveStocks(list) { localStorage.setItem('watchlist', JSON.stringify(list)) }

function loadPortfolio() {
  try { const s = localStorage.getItem('portfolio'); if (s) return JSON.parse(s) } catch {}
  return []
}
function savePortfolio(list) { localStorage.setItem('portfolio', JSON.stringify(list)) }

// ─── helpers ─────────────────────────────────────────────────────────────────
function isMarketOpen() {
  const et   = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day  = et.getDay()
  const mins = et.getHours() * 60 + et.getMinutes()
  return day >= 1 && day <= 5 && mins >= 570 && mins < 960
}

function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
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
  const cls = d >= 0 ? 'positive' : 'negative'
  return <span className={cls}>{d >= 0 ? '▲' : '▼'} {fmt(Math.abs(d))} ({fmt(Math.abs(dp))}%)</span>
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

// ─── Stock search input (shared between watchlist + portfolio modals) ─────────
function StockSearch({ apiKey, onSelect, placeholder = 'Search symbol or company…' }) {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef               = useRef(null)

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res  = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${apiKey}`)
        const data = await res.json()
        setResults(
          (data.result || [])
            .filter(r => (r.type === 'Common Stock' || r.type === 'ETP') && !r.symbol.includes('.'))
            .slice(0, 6)
        )
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 350)
  }, [query, apiKey])

  const pick = (r) => {
    onSelect(r)
    setQuery('')
    setResults([])
  }

  return (
    <div className="stock-search-wrap">
      <div className="modal-search-wrap" style={{ padding: 0 }}>
        <input className="modal-search" type="text" placeholder={placeholder}
          value={query} onChange={e => setQuery(e.target.value)} autoFocus />
        {searching && <span className="search-spinner">↻</span>}
      </div>
      {results.length > 0 && (
        <div className="search-results" style={{ margin: '8px 0 0' }}>
          {results.map(r => (
            <div key={r.symbol} className="search-result-row" style={{ cursor: 'pointer' }}
              onClick={() => pick(r)}>
              <div>
                <span className="sr-symbol">{r.symbol}</span>
                <span className="sr-name">{r.description}</span>
              </div>
              <span className="sr-type-badge">{r.type === 'ETP' ? 'ETF' : 'Stock'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Manage Watchlist Modal ───────────────────────────────────────────────────
function ManageStocksModal({ stocks, apiKey, onSave, onClose }) {
  const [list, setList] = useState(stocks)
  const [adding, setAdding] = useState(null) // selected result before confirming add

  const handleSelect = (r) => {
    if (!list.find(s => s.symbol === r.symbol))
      setList(l => [...l, { symbol: r.symbol, name: r.description }])
  }

  const remove = (symbol) => setList(l => l.filter(s => s.symbol !== symbol))

  const handleSave = () => { saveStocks(list); onSave(list); onClose() }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Manage Watchlist</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 24px 0' }}>
          <StockSearch apiKey={apiKey} onSelect={handleSelect} />
        </div>
        <div className="modal-list-label">Your watchlist ({list.length} stocks)</div>
        <div className="modal-list">
          {list.map(({ symbol, name }) => (
            <div key={symbol} className="modal-list-row">
              <div><span className="sr-symbol">{symbol}</span><span className="sr-name">{name}</span></div>
              <button className="remove-btn" onClick={() => remove(symbol)}>✕</button>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => setList(DEFAULT_STOCKS)}>Reset to default</button>
          <button className="btn" onClick={handleSave}>Save &amp; Reload</button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Holding Modal ────────────────────────────────────────────────────────
function AddHoldingModal({ apiKey, existing, onAdd, onClose }) {
  const [selected, setSelected] = useState(null)
  const [shares, setShares]     = useState('')
  const [avgCost, setAvgCost]   = useState('')
  const [err, setErr]           = useState('')

  const handleSelect = (r) => {
    setSelected(r)
    setErr('')
  }

  const handleAdd = () => {
    if (!selected) { setErr('Please search and select a stock or ETF.'); return }
    const sh = parseFloat(shares)
    if (!sh || sh <= 0) { setErr('Enter a valid number of shares.'); return }
    const ac = avgCost ? parseFloat(avgCost) : null
    if (avgCost && (isNaN(ac) || ac <= 0)) { setErr('Enter a valid average cost.'); return }

    const holding = {
      symbol:  selected.symbol,
      name:    selected.description,
      shares:  sh,
      avgCost: ac,
    }
    onAdd(holding)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Add Holding</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stock search */}
          {!selected ? (
            <StockSearch apiKey={apiKey} onSelect={handleSelect}
              placeholder="Search stock or ETF (e.g. VOO, VT, AAPL)…" />
          ) : (
            <div className="selected-stock-row">
              <div>
                <span className="sr-symbol">{selected.symbol}</span>
                <span className="sr-name">{selected.description}</span>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>Change</button>
            </div>
          )}

          {/* Shares */}
          <div className="login-field">
            <label>Number of Shares</label>
            <input type="number" min="0" step="any" placeholder="e.g. 10"
              value={shares} onChange={e => setShares(e.target.value)} />
          </div>

          {/* Avg cost */}
          <div className="login-field">
            <label>Average Cost per Share (optional)</label>
            <input type="number" min="0" step="any" placeholder="e.g. 480.00"
              value={avgCost} onChange={e => setAvgCost(e.target.value)} />
          </div>

          {err && <div className="login-error" style={{ marginTop: 0 }}>{err}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={handleAdd}>Add to Portfolio</button>
        </div>
      </div>
    </div>
  )
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [user, setUser]   = useState('')
  const [pass, setPass]   = useState('')
  const [error, setError] = useState('')
  const [show, setShow]   = useState(false)

  const submit = () => {
    if (user.trim() === APP_USER && pass === APP_PASS) { onLogin() }
    else { setError('Incorrect username or password.'); setPass('') }
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
          <input type="text" placeholder="Enter username" value={user} autoComplete="username"
            onChange={e => setUser(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        <div className="login-field">
          <label>Password</label>
          <div className="pass-wrap">
            <input type={show ? 'text' : 'password'} placeholder="Enter password" value={pass}
              autoComplete="current-password"
              onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
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

// ─── API Key setup ─────────────────────────────────────────────────────────────
function ApiKeyScreen({ onSave }) {
  const [key, setKey]         = useState('')
  const [error, setError]     = useState('')
  const [testing, setTesting] = useState(false)

  const verify = async () => {
    const k = key.trim(); if (!k) return
    setTesting(true); setError('')
    try {
      const res  = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${k}`)
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      localStorage.setItem('finnhub_key', k); onSave(k)
    } catch (e) {
      setError(`Key invalid: ${e.message}. Get a free key at finnhub.io/register`)
    } finally { setTesting(false) }
  }

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 440 }}>
        <div className="login-logo">🔑</div>
        <h1 className="login-title" style={{ fontSize: '1.25rem' }}>One-time Setup</h1>
        <p className="login-sub">
          Enter your free <a href="https://finnhub.io/register" target="_blank" rel="noreferrer"
            style={{ color: '#38bdf8' }}>Finnhub API key</a>. Saved in this browser only.
        </p>
        {error && <div className="login-error">{error}</div>}
        <div className="login-field">
          <label>Finnhub API Key</label>
          <input type="text" placeholder="e.g. d7lf361r01qm7o0bk5n0" value={key}
            onChange={e => setKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && verify()}
            style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }} />
        </div>
        <button className="btn login-btn" onClick={verify} disabled={!key.trim() || testing}>
          {testing ? 'Verifying…' : 'Save & Continue'}
        </button>
      </div>
    </div>
  )
}

// ─── Sentiment cards ──────────────────────────────────────────────────────────
function FearGreedCard({ data, error }) {
  if (error) return (
    <div className="sentiment-card">
      <div className="section-title" style={{ marginBottom: 8 }}>Fear &amp; Greed Index</div>
      <p className="neutral" style={{ fontSize: '0.82rem' }}>
        CNN API unavailable.&nbsp;
        <a href="https://edition.cnn.com/markets/fear-and-greed" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>View on CNN →</a>
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
      <div className="fg-bar-wrap"><div className="fg-bar" style={{ width: `${data.score}%`, background: color }} /></div>
      <div className="fg-labels">
        <span style={{ color: '#ef4444', fontSize: '0.68rem' }}>Extreme Fear</span>
        <span style={{ color: '#16a34a', fontSize: '0.68rem' }}>Extreme Greed</span>
      </div>
      <div className="fg-history">
        {[{ label: 'Yesterday', val: data.previousClose }, { label: 'Last Week', val: data.previousWeek }, { label: 'Last Month', val: data.previousMonth }].map(({ label, val }) => (
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
        Updated weekly every Thursday via GitHub Actions.<br />
        <a href="https://www.aaii.com/sentimentsurvey" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>View latest at AAII.com →</a>
      </p>
    </div>
  )
  const total = data.bullish + data.neutral + data.bearish
  return (
    <div className="sentiment-card">
      <div className="section-title" style={{ marginBottom: 6 }}>AAII Sentiment Survey</div>
      <div className="aaii-date">Week ending {data.date}</div>
      <div className="aaii-bar-track">
        <div style={{ width: `${(data.bullish/total*100).toFixed(1)}%`, background: '#22c55e' }} />
        <div style={{ width: `${(data.neutral/total*100).toFixed(1)}%`, background: '#eab308' }} />
        <div style={{ width: `${(data.bearish/total*100).toFixed(1)}%`, background: '#ef4444' }} />
      </div>
      <div className="aaii-legend">
        <span className="positive">▲ Bull {data.bullish}%</span>
        <span style={{ color: '#eab308' }}>● Neutral {data.neutral}%</span>
        <span className="negative">▼ Bear {data.bearish}%</span>
      </div>
      {data.historicalAvg && (
        <div className="aaii-avg">Long-run avg · Bull {data.historicalAvg.bullish}% · Bear {data.historicalAvg.bearish}%</div>
      )}
    </div>
  )
}

// ─── Portfolio View ───────────────────────────────────────────────────────────
function PortfolioView({ portfolio, setPortfolio, apiKey, usdIls }) {
  const [quotes, setQuotes]         = useState({})
  const [loading, setLoading]       = useState(false)
  const [showAdd, setShowAdd]       = useState(false)
  const [editingIdx, setEditingIdx] = useState(null)

  const fetchQuotes = useCallback(async (holdings) => {
    const syms = [...new Set(holdings.map(h => h.symbol))]
    if (!syms.length) return
    setLoading(true)
    try {
      const results = await Promise.allSettled(
        syms.map(s => fetch(`https://finnhub.io/api/v1/quote?symbol=${s}&token=${apiKey}`).then(r => r.json()))
      )
      const map = {}
      syms.forEach((s, i) => { if (results[i].status === 'fulfilled') map[s] = results[i].value })
      setQuotes(map)
    } finally { setLoading(false) }
  }, [apiKey])

  useEffect(() => { fetchQuotes(portfolio) }, [portfolio, fetchQuotes])

  const handleAdd = (holding) => {
    const idx = portfolio.findIndex(h => h.symbol === holding.symbol)
    let next
    if (idx >= 0) {
      // merge: sum shares, weighted avg cost
      const existing = portfolio[idx]
      const totalShares = existing.shares + holding.shares
      const avgCost = (existing.avgCost && holding.avgCost)
        ? ((existing.avgCost * existing.shares) + (holding.avgCost * holding.shares)) / totalShares
        : (existing.avgCost || holding.avgCost)
      next = portfolio.map((h, i) => i === idx ? { ...h, shares: totalShares, avgCost } : h)
    } else {
      next = [...portfolio, holding]
    }
    savePortfolio(next)
    setPortfolio(next)
    fetchQuotes(next)
  }

  const removeHolding = (symbol) => {
    const next = portfolio.filter(h => h.symbol !== symbol)
    savePortfolio(next)
    setPortfolio(next)
  }

  const updateShares = (symbol, shares) => {
    const next = portfolio.map(h => h.symbol === symbol ? { ...h, shares: parseFloat(shares) || h.shares } : h)
    savePortfolio(next)
    setPortfolio(next)
  }

  // Totals
  const totalValue = portfolio.reduce((sum, h) => {
    const q = quotes[h.symbol]
    return sum + (q?.c ? h.shares * q.c : 0)
  }, 0)

  const totalCost = portfolio.reduce((sum, h) => {
    return h.avgCost ? sum + h.shares * h.avgCost : sum
  }, 0)

  const hasAllCosts = portfolio.length > 0 && portfolio.every(h => h.avgCost)
  const totalGain   = hasAllCosts ? totalValue - totalCost : null

  return (
    <div>
      {showAdd && (
        <AddHoldingModal apiKey={apiKey} existing={portfolio} onAdd={handleAdd} onClose={() => setShowAdd(false)} />
      )}

      {/* USD/ILS rate + totals */}
      <div className="portfolio-summary-row">
        <div className="portfolio-fx-card">
          <div className="section-title" style={{ marginBottom: 6 }}>USD / ILS Rate</div>
          {usdIls ? (
            <>
              <div className="fx-rate">₪{fmt(usdIls, 3)}</div>
              <div className="fx-sub">1 USD = {fmt(usdIls, 3)} ILS</div>
            </>
          ) : (
            <>
              <div className="skeleton skeleton-price" style={{ width: '50%', marginBottom: 6 }} />
              <div className="skeleton skeleton-line" style={{ width: '70%' }} />
            </>
          )}
        </div>

        <div className="portfolio-total-card">
          <div className="section-title" style={{ marginBottom: 6 }}>Total Portfolio Value</div>
          {loading && !totalValue ? (
            <div className="skeleton skeleton-price" style={{ width: '60%' }} />
          ) : (
            <>
              <div className="portfolio-total-usd">${fmt(totalValue)}</div>
              {usdIls && <div className="portfolio-total-ils">≈ ₪{fmt(totalValue * usdIls)}</div>}
              {totalGain !== null && (
                <div className={`portfolio-gain ${totalGain >= 0 ? 'positive' : 'negative'}`}>
                  {totalGain >= 0 ? '▲' : '▼'} ${fmt(Math.abs(totalGain))}
                  {' '}({fmt(Math.abs(totalGain / totalCost * 100))}%)
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Holdings */}
      <div className="section-title-row" style={{ marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>
          Holdings <span className="stock-count">({portfolio.length})</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => fetchQuotes(portfolio)} disabled={loading}>
            {loading ? '↻' : '↻ Refresh'}
          </button>
          <button className="btn btn-sm" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </div>

      {portfolio.length === 0 ? (
        <div className="portfolio-empty">
          <p>No holdings yet.</p>
          <button className="btn" onClick={() => setShowAdd(true)}>Add your first holding</button>
        </div>
      ) : (
        <div className="holdings-table-wrap">
          <table className="holdings-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="hide-xs">Name</th>
                <th>Shares</th>
                <th>Avg Cost</th>
                <th>Price</th>
                <th>Value</th>
                <th>Gain / Loss</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((h) => {
                const q        = quotes[h.symbol]
                const price    = q?.c
                const value    = price != null ? h.shares * price : null
                const cost     = h.avgCost ? h.shares * h.avgCost : null
                const gain     = value != null && cost != null ? value - cost : null
                const gainPct  = gain != null && cost ? (gain / cost * 100) : null
                const gainCls  = gain == null ? '' : gain >= 0 ? 'positive' : 'negative'

                return (
                  <tr key={h.symbol}>
                    <td className="holding-symbol">{h.symbol}</td>
                    <td className="holding-name hide-xs">{h.name}</td>
                    <td>
                      {editingIdx === h.symbol ? (
                        <input
                          className="shares-input"
                          type="number"
                          defaultValue={h.shares}
                          onBlur={e => { updateShares(h.symbol, e.target.value); setEditingIdx(null) }}
                          onKeyDown={e => { if (e.key === 'Enter') { updateShares(h.symbol, e.target.value); setEditingIdx(null) } }}
                          autoFocus
                        />
                      ) : (
                        <span className="shares-val" onClick={() => setEditingIdx(h.symbol)} title="Click to edit">
                          {fmt(h.shares, h.shares % 1 === 0 ? 0 : 4)}
                        </span>
                      )}
                    </td>
                    <td>{h.avgCost ? `$${fmt(h.avgCost)}` : <span className="neutral">—</span>}</td>
                    <td>{price != null ? `$${fmt(price)}` : <span className="skeleton skeleton-line" style={{ width: 50, height: 12, display: 'inline-block' }} />}</td>
                    <td className="holding-value">{value != null ? `$${fmt(value)}` : '—'}</td>
                    <td className={gainCls}>
                      {gain != null ? `${gain >= 0 ? '+' : ''}$${fmt(Math.abs(gain))} (${gainPct >= 0 ? '+' : ''}${fmt(gainPct)}%)` : '—'}
                    </td>
                    <td>
                      <button className="remove-btn" onClick={() => removeHolding(h.symbol)} title="Remove">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn]     = useState(() => sessionStorage.getItem('auth') === '1')
  const [apiKey, setApiKey]         = useState(() => localStorage.getItem('finnhub_key') || '')
  const [tab, setTab]               = useState('dashboard')
  const [stocks, setStocks]         = useState(loadStocks)
  const [portfolio, setPortfolio]   = useState(loadPortfolio)
  const [showManage, setShowManage] = useState(false)
  const [quotes, setQuotes]         = useState({})
  const [news, setNews]             = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [lastUpdated, setLastUpdated]   = useState(null)
  const [fearGreed, setFearGreed]       = useState(null)
  const [fgError, setFgError]           = useState(false)
  const [aaii, setAaii]                 = useState(null)
  const [usdIls, setUsdIls]             = useState(null)

  const handleLogin  = () => { sessionStorage.setItem('auth', '1'); setLoggedIn(true) }
  const handleLogout = () => { sessionStorage.removeItem('auth'); setLoggedIn(false) }

  // Fear & Greed
  useEffect(() => {
    if (!loggedIn || !apiKey) return
    fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        const fg = data.fear_and_greed, hist = data.fear_and_greed_historical?.data ?? []
        setFearGreed({ score: Math.round(fg.score), rating: fg.rating,
          previousClose: Math.round(hist.at(-2)?.y ?? fg.score),
          previousWeek:  Math.round(hist.at(-6)?.y ?? fg.score),
          previousMonth: Math.round(hist.at(-22)?.y ?? fg.score) })
      })
      .catch(() => setFgError(true))
  }, [loggedIn, apiKey])

  // AAII
  useEffect(() => {
    if (!loggedIn || !apiKey) return
    fetch('/stock-dashboard/aaii.json')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setAaii).catch(() => {})
  }, [loggedIn, apiKey])

  // USD/ILS exchange rate — free, no key needed
  useEffect(() => {
    if (!loggedIn || !apiKey) return
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(data => setUsdIls(data.rates?.ILS ?? null))
      .catch(() => {})
  }, [loggedIn, apiKey])

  const fetchQuote = useCallback(async (symbol) => {
    const res  = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data
  }, [apiKey])

  const fetchAll = useCallback(async (stockList) => {
    if (!apiKey) return
    setLoading(true); setError('')
    try {
      const allSymbols = [...INDICES.map(i => i.symbol), ...(stockList || stocks).map(s => s.symbol)]
      const results    = await Promise.allSettled(allSymbols.map(s => fetchQuote(s)))
      const map = {}
      allSymbols.forEach((sym, i) => { if (results[i].status === 'fulfilled') map[sym] = results[i].value })
      if (!Object.keys(map).length) {
        const firstErr = results.find(r => r.status === 'rejected')?.reason?.message
        throw new Error(firstErr || 'No data returned — API key may be invalid.')
      }
      setQuotes(map)
      setLastUpdated(new Date())
      const newsRes = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${apiKey}`)
      if (newsRes.ok) setNews((await newsRes.json()).slice(0, 9))
    } catch (e) { setError(e.message || 'Failed to fetch data.') }
    finally { setLoading(false) }
  }, [apiKey, stocks, fetchQuote])

  useEffect(() => { if (loggedIn && apiKey) fetchAll() }, [loggedIn, apiKey])

  const handleStocksSaved = (newList) => { setStocks(newList); fetchAll(newList) }

  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />
  if (!apiKey)   return <ApiKeyScreen onSave={setApiKey} />

  const open = isMarketOpen()

  return (
    <div className="app">
      {showManage && (
        <ManageStocksModal stocks={stocks} apiKey={apiKey}
          onSave={handleStocksSaved} onClose={() => setShowManage(false)} />
      )}

      {/* Header */}
      <div className="header">
        <h1>📈 <span>Stock</span> Dashboard</h1>
        <div className="header-right">
          <div className="market-status">
            <div className={`status-dot${open ? '' : ' closed'}`} />
            {open ? 'Market Open' : 'Market Closed'}
            {lastUpdated && ` · ${lastUpdated.toLocaleTimeString()}`}
          </div>
          {tab === 'dashboard' && (
            <button className="btn" onClick={() => fetchAll()} disabled={loading}>
              {loading ? 'Loading…' : '↻ Refresh'}
            </button>
          )}
          <button className="btn btn-outline" onClick={() => { localStorage.removeItem('finnhub_key'); setApiKey('') }}>⚙ Key</button>
          <button className="btn btn-outline" onClick={handleLogout}>Sign Out</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          📊 Dashboard
        </button>
        <button className={`tab-btn ${tab === 'portfolio' ? 'active' : ''}`} onClick={() => setTab('portfolio')}>
          💼 Portfolio
        </button>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}

      {/* ── Dashboard Tab ── */}
      {tab === 'dashboard' && (
        <>
          <div className="sentiment-row">
            <FearGreedCard data={fearGreed} error={fgError} />
            <AaiiCard data={aaii} />
          </div>

          <div className="section-title">Major Indices</div>
          <div className="indices-grid">
            {INDICES.map(({ symbol, label }) => {
              const q = quotes[symbol]
              return (
                <a className="index-card" key={symbol}
                  href={`https://www.tradingview.com/chart/?symbol=${symbol}`}
                  target="_blank" rel="noreferrer">
                  <div className="index-label">{label}</div>
                  {q ? (<><div className="index-price">${fmt(q.c)}</div><div className="index-change"><ChangeLabel d={q.d} dp={q.dp} /></div></>)
                     : (<><div className="skeleton skeleton-price" /><div className="skeleton skeleton-line" style={{ width: '60%' }} /></>)}
                </a>
              )
            })}
          </div>

          <div className="stocks-section">
            <div className="section-title-row">
              <div className="section-title" style={{ marginBottom: 0 }}>
                Watchlist <span className="stock-count">({stocks.length})</span>
              </div>
              <button className="edit-watchlist-btn" onClick={() => setShowManage(true)}>+ Edit</button>
            </div>
            <div className="stocks-grid" style={{ marginTop: 12 }}>
              {stocks.map(({ symbol, name }) => {
                const q = quotes[symbol]
                if (!q) return <SkeletonCard key={symbol} />
                return (
                  <a className="stock-card" key={symbol}
                    href={`https://www.tradingview.com/chart/?symbol=${symbol}`}
                    target="_blank" rel="noreferrer">
                    <div className="stock-symbol">{symbol}</div>
                    <div className="stock-name">{name}</div>
                    <div className="stock-price">${fmt(q.c)}</div>
                    <div className="stock-change-row"><ChangeLabel d={q.d} dp={q.dp} /></div>
                    <div className="tv-hint">Open in TradingView ↗</div>
                  </a>
                )
              })}
            </div>
          </div>

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
        </>
      )}

      {/* ── Portfolio Tab ── */}
      {tab === 'portfolio' && (
        <PortfolioView
          portfolio={portfolio}
          setPortfolio={setPortfolio}
          apiKey={apiKey}
          usdIls={usdIls}
        />
      )}

      <div className="footer">
        Stocks &amp; news: <a href="https://finnhub.io" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>Finnhub.io</a>
        &nbsp;· Fear &amp; Greed: <a href="https://edition.cnn.com/markets/fear-and-greed" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>CNN</a>
        &nbsp;· Sentiment: <a href="https://www.aaii.com/sentimentsurvey" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>AAII</a>
        &nbsp;· FX: <a href="https://open.er-api.com" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>ExchangeRate-API</a>
        &nbsp;· Prices may be delayed 15 min
      </div>
    </div>
  )
}

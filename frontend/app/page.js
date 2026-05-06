'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function CitedText({ text }) {
  const parts = text.split(/(\[P\d+,\s*page\s*\d+\])/g)
  return (
    <p className="text-sm whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) =>
        /\[P\d+,\s*page\s*\d+\]/.test(part) ? (
          <span key={i} className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded mx-0.5">
            {part}
          </span>
        ) : (
          <span key={i} className="text-gray-600">{part}</span>
        )
      )}
    </p>
  )
}

function Section({ title, content, bg, titleColor }) {
  return (
    <div className={`${bg} rounded-xl p-5`}>
      <h2 className={`text-sm font-semibold ${titleColor} mb-3`}>{title}</h2>
      <CitedText text={content} />
    </div>
  )
}

export default function Home() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')

  const [files, setFiles] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
    supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
  }, [])

  useEffect(() => {
    if (user) fetchHistory()
  }, [user])

  const fetchHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('https://researchos-production-c3d6.up.railway.app/history', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const data = await res.json()
    setHistory(data.history || [])
  }

  const handleAuth = async () => {
    setAuthError('')
    const { error } =
      authMode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    if (error) setAuthError(error.message)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setResult(null)
    setHistory([])
  }

  const handleFiles = (e) => {
    setFiles(Array.from(e.target.files))
    setResult(null)
    setError('')
  }

  const handleAnalyse = async () => {
    if (files.length === 0) return
    setLoading(true)
    setResult(null)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))

      const headers = {}
      if (session) headers['Authorization'] = `Bearer ${session.access_token}`

      const res = await fetch('https://researchos-production-c3d6.up.railway.app/synthesise', {
        method: 'POST',
        headers,
        body: formData,
      })

      if (!res.ok) throw new Error('Server error')
      const data = await res.json()
      setResult(data)
      if (user) fetchHistory()
    } catch (e) {
      setError('Something went wrong. Make sure the backend is running.')
    }

    setLoading(false)
  }

  // Auth screen
  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">ResearchOS</h1>
          <p className="text-gray-500 text-sm mb-6">AI-powered research synthesis</p>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-3 outline-none focus:border-blue-400"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 outline-none focus:border-blue-400"
          />

          {authError && <p className="text-red-500 text-xs mb-3">{authError}</p>}

          <button
            onClick={handleAuth}
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            {authMode === 'login' ? 'Log in' : 'Sign up'}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-blue-600 hover:underline"
            >
              {authMode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">ResearchOS</h1>
            <p className="text-gray-500 text-sm mt-1">Logged in as {user.email}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            >
              {showHistory ? 'New synthesis' : `History (${history.length})`}
            </button>
            <button
              onClick={handleLogout}
              className="text-sm px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-500"
            >
              Log out
            </button>
          </div>
        </div>

        {/* History view */}
        {showHistory ? (
          <div className="space-y-4">
            {history.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-12">No saved syntheses yet.</p>
            ) : (
              history.map((h, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-xs text-gray-400 mb-2">{new Date(h.created_at).toLocaleDateString()}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {h.papers.map((p, j) => (
                      <span key={j} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3">{h.synthesis}</p>
                  <button
                    onClick={() => { setResult(h); setShowHistory(false) }}
                    className="text-xs text-blue-600 mt-2 hover:underline"
                  >
                    View full synthesis →
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            {/* Upload card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center mb-4 hover:border-blue-300 transition">
                <input type="file" accept=".pdf" multiple onChange={handleFiles} className="hidden" id="fileInput" />
                <label htmlFor="fileInput" className="cursor-pointer">
                  {files.length === 0 ? (
                    <div>
                      <p className="text-gray-400 text-sm">Click to select PDFs</p>
                      <p className="text-gray-300 text-xs mt-1">Up to 10 research papers</p>
                    </div>
                  ) : (
                    <ul className="text-left space-y-1">
                      {files.map((f, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="text-blue-400 text-xs font-medium">P{i+1}</span>
                          {f.name}
                        </li>
                      ))}
                      <li className="text-xs text-gray-400 mt-2">Click to change selection</li>
                    </ul>
                  )}
                </label>
              </div>

              <button
                onClick={handleAnalyse}
                disabled={files.length === 0 || loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition"
              >
                {loading ? `Synthesising ${files.length} paper${files.length > 1 ? 's' : ''}...` : `Synthesise ${files.length} Paper${files.length !== 1 ? 's' : ''}`}
              </button>

              {error && <p className="text-red-500 text-xs mt-3 text-center">{error}</p>}
            </div>

            {/* Results */}
            {result && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Papers analysed</p>
                  <ul className="space-y-1">
                    {result.papers.map((p, i) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-2">
                        <span className="bg-blue-100 text-blue-700 font-medium px-1.5 py-0.5 rounded text-xs">P{i+1}</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <Section title="🔗 Common Themes" content={result.themes} bg="bg-white border border-gray-100" titleColor="text-gray-700" />
                <Section title="⚡ Agreements & Contradictions" content={result.agreements} bg="bg-white border border-gray-100" titleColor="text-gray-700" />
                <Section title="🔍 Research Gaps" content={result.gaps} bg="bg-yellow-50" titleColor="text-yellow-800" />
                <Section title="✅ Unified Synthesis" content={result.synthesis} bg="bg-green-50" titleColor="text-green-800" />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
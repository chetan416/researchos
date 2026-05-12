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

  const exportPDF = (result) => {
    const { jsPDF } = window.jspdf
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    const maxWidth = pageWidth - margin * 2
    let y = 20

    const addText = (text, size = 11, bold = false, color = [30, 30, 30]) => {
      doc.setFontSize(size)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setTextColor(...color)
      const lines = doc.splitTextToSize(text, maxWidth)
      lines.forEach(line => {
        if (y > 270) { doc.addPage(); y = 20 }
        doc.text(line, margin, y)
        y += size * 0.5
      })
      y += 4
    }

    const addSection = (title, content) => {
      if (y > 240) { doc.addPage(); y = 20 }
      y += 4
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, y, pageWidth - margin, y)
      y += 8
      addText(title, 13, true, [30, 60, 120])
      addText(content, 10)
    }

    addText('ResearchOS - Synthesis Report', 18, true, [30, 60, 120])
    addText(new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }), 10, false, [120, 120, 120])
    y += 6

    addText('Papers Analysed', 13, true, [30, 60, 120])
    result.papers.forEach((p, i) => addText(`[P${i + 1}] ${p}`, 10))

    addSection('Common Themes', result.themes)
    addSection('Agreements and Contradictions', result.agreements)
    addSection('Research Gaps', result.gaps)
    addSection('Unified Synthesis', result.synthesis)

    doc.save('researchos-synthesis.pdf')
  }

  const exportBibTeX = (result) => {
    const entries = result.papers.map((paper, i) => {
      const name = paper.replace('.pdf', '').replace(/[^a-zA-Z0-9\s]/g, '').trim()
      const key = name.split(' ').slice(0, 3).join('').toLowerCase()
      const year = new Date().getFullYear()
      return `@article{${key}${year},
  title     = {${name}},
  author    = {Unknown},
  year      = {${year}},
  note      = {Uploaded to ResearchOS on ${new Date().toLocaleDateString()}}
}`
    }).join('\n\n')

    const blob = new Blob([entries], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'researchos-citations.bib'
    a.click()
    URL.revokeObjectURL(url)
  }

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
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
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

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 border border-gray-200 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition text-gray-700"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A353" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.31z"/>
            </svg>
            Continue with Google
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

          <p className="text-center text-xs text-gray-400 mt-2">
            By continuing, you agree to our{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>        
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
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => exportPDF(result)}
                    className="text-sm px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-700"
                  >
                    Export PDF
                  </button>
                  <button
                    onClick={() => exportBibTeX(result)}
                    className="text-sm px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-700"
                  >
                    Export BibTeX
                  </button>
                </div>

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
                <Section title="Common Themes" content={result.themes} bg="bg-white border border-gray-100" titleColor="text-gray-700" />
                <Section title="Agreements & Contradictions" content={result.agreements} bg="bg-white border border-gray-100" titleColor="text-gray-700" />
                <Section title="Research Gaps" content={result.gaps} bg="bg-yellow-50" titleColor="text-yellow-800" />
                <Section title="Unified Synthesis" content={result.synthesis} bg="bg-green-50" titleColor="text-green-800" />
              </div>
            )}
          </>
        )}
      </div>
      <div className="mt-12 text-center">
        <a href="/privacy" className="text-xs text-gray-400 hover:underline">Privacy Policy</a>
      </div>
    </main>
  )
}
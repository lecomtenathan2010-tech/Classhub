import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type ClassRow } from '../lib/supabase'
import ClassView from './ClassView'

export default function Home({ session }: { session: Session }) {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [current, setCurrent] = useState<ClassRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newSchool, setNewSchool] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, school, invite_code')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setClasses(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function createClass(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_class', {
      p_name: newName,
      p_school: newSchool || null,
    })
    setBusy(false)
    if (error) return setError(error.message)
    setNewName('')
    setNewSchool('')
    await load()
    setCurrent(data as ClassRow)
  }

  async function joinClass(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('join_class', { p_code: code })
    setBusy(false)
    if (error) return setError(error.message)
    setCode('')
    await load()
  }

  if (current) {
    return (
      <ClassView
        cls={current}
        userId={session.user.id}
        onBack={() => setCurrent(null)}
        onLeft={() => {
          setCurrent(null)
          load()
        }}
      />
    )
  }

  return (
    <div className="page">
      <header className="topbar">
        <strong>ClassHub</strong>
        <button className="link" onClick={() => supabase.auth.signOut()}>
          Déconnexion
        </button>
      </header>

      <h2>Mes classes</h2>
      {loading && <p className="muted">Chargement…</p>}
      {!loading && classes.length === 0 && (
        <p className="muted">Tu n'as pas encore de classe. Crées-en une ou rejoins-en une avec un code.</p>
      )}
      <ul className="list">
        {classes.map((c) => (
          <li key={c.id}>
            <button className="row-btn" onClick={() => setCurrent(c)}>
              <span>
                <strong>{c.name}</strong>
                {c.school && <span className="muted"> · {c.school}</span>}
              </span>
              <span className="muted">›</span>
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="error">{error}</p>}

      <div className="grid-2">
        <form onSubmit={joinClass} className="card stack">
          <h3>Rejoindre une classe</h3>
          <input
            placeholder="Code d'invitation (6 caractères)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            required
          />
          <button disabled={busy}>Rejoindre</button>
        </form>
        <form onSubmit={createClass} className="card stack">
          <h3>Créer une classe</h3>
          <input
            placeholder="Nom (ex. 5e Sciences A)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            minLength={2}
            maxLength={60}
            required
          />
          <input
            placeholder="École (optionnel)"
            value={newSchool}
            onChange={(e) => setNewSchool(e.target.value)}
            maxLength={80}
          />
          <button disabled={busy}>Créer</button>
        </form>
      </div>
    </div>
  )
}

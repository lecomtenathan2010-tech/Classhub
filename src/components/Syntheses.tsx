import { useCallback, useEffect, useState } from 'react'
import { supabase, type SynthesisRow } from '../lib/supabase'

const SELECT =
  'id, class_id, user_id, subject, chapter, title, file_path, created_at, profiles(display_name), ratings(user_id, stars, comment)'
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg']

export default function Syntheses({ classId, userId }: { classId: string; userId: string }) {
  const [items, setItems] = useState<SynthesisRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('syntheses')
      .select(SELECT)
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setItems((data ?? []) as unknown as SynthesisRow[])
    setLoading(false)
  }, [classId])

  useEffect(() => {
    load()
  }, [load])

  const subjects = Array.from(new Set(items.map((i) => i.subject))).sort()
  const shown = filter ? items.filter((i) => i.subject === filter) : items

  return (
    <div>
      <p className="notice">Contenu créé par des élèves, à vérifier avec ton cours.</p>

      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Toutes les matières</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Fermer' : '+ Publier'}</button>
      </div>

      {showForm && (
        <UploadForm
          classId={classId}
          onDone={() => {
            setShowForm(false)
            load()
          }}
        />
      )}

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Chargement…</p>}
      {!loading && shown.length === 0 && <p className="muted center">Aucune synthèse pour l'instant.</p>}

      <ul className="list">
        {shown.map((s) => (
          <SynthesisCard key={s.id} s={s} userId={userId} onChanged={load} />
        ))}
      </ul>
    </div>
  )
}

function UploadForm({ classId, onDone }: { classId: string; onDone: () => void }) {
  const [subject, setSubject] = useState('')
  const [chapter, setChapter] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return setError('Choisis un fichier.')
    if (!ALLOWED.includes(file.type)) return setError('Formats acceptés : PDF, PNG ou JPG.')
    if (file.size > MAX_BYTES) return setError('Fichier trop lourd (10 Mo max).')
    setBusy(true)
    setError(null)

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${classId}/${crypto.randomUUID()}-${safeName}`
    const up = await supabase.storage.from('syntheses').upload(path, file, { contentType: file.type })
    if (up.error) {
      setBusy(false)
      return setError(up.error.message)
    }
    const { error } = await supabase.from('syntheses').insert({
      class_id: classId,
      subject: subject.trim(),
      chapter: chapter.trim() || null,
      title: title.trim(),
      file_path: path,
    })
    if (error) {
      await supabase.storage.from('syntheses').remove([path])
      setBusy(false)
      return setError(error.message)
    }
    setBusy(false)
    onDone()
  }

  return (
    <form onSubmit={submit} className="card stack">
      <input placeholder="Matière (ex. Maths)" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={60} required />
      <input placeholder="Chapitre (optionnel)" value={chapter} onChange={(e) => setChapter(e.target.value)} maxLength={80} />
      <input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} minLength={2} maxLength={120} required />
      <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
      <p className="muted small">PDF, PNG ou JPG, 10 Mo max. Ne publie pas de réponses d'examen ni de contenu protégé.</p>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Envoi…' : 'Publier'}</button>
    </form>
  )
}

function SynthesisCard({
  s,
  userId,
  onChanged,
}: {
  s: SynthesisRow
  userId: string
  onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const mine = s.user_id === userId
  const count = s.ratings.length
  const avg = count ? s.ratings.reduce((sum, r) => sum + r.stars, 0) / count : 0
  const myRating = s.ratings.find((r) => r.user_id === userId)?.stars ?? 0

  async function open() {
    setError(null)
    const { data, error } = await supabase.storage.from('syntheses').createSignedUrl(s.file_path, 120)
    if (error || !data) return setError(error?.message ?? 'Impossible d\'ouvrir le fichier.')
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function rate(stars: number) {
    setError(null)
    const { error } = await supabase
      .from('ratings')
      .upsert({ synthesis_id: s.id, user_id: userId, stars }, { onConflict: 'synthesis_id,user_id' })
    if (error) setError(error.message)
    else onChanged()
  }

  async function remove() {
    if (!confirm('Supprimer cette synthèse ?')) return
    const { error } = await supabase.from('syntheses').delete().eq('id', s.id)
    if (error) return setError(error.message)
    await supabase.storage.from('syntheses').remove([s.file_path])
    onChanged()
  }

  return (
    <li className="card synth">
      <div className="synth-head">
        <span className="tag">{s.subject}</span>
        {s.chapter && <span className="muted small">{s.chapter}</span>}
      </div>
      <h3>{s.title}</h3>
      <p className="muted small">
        par {s.profiles?.display_name ?? 'Élève'} · {new Date(s.created_at).toLocaleDateString('fr-BE')}
      </p>
      <p className="small">
        {count ? `★ ${avg.toFixed(1)} (${count} avis)` : 'Pas encore noté'}
      </p>
      <div className="actions">
        <button onClick={open}>Ouvrir</button>
        {!mine && (
          <span className="stars" aria-label="Ta note">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={`star ${n <= myRating ? 'on' : ''}`} onClick={() => rate(n)} aria-label={`${n} étoiles`}>
                ★
              </button>
            ))}
          </span>
        )}
        {mine && (
          <button className="link danger" onClick={remove}>
            Supprimer
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </li>
  )
}

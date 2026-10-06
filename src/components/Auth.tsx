import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } },
      })
      if (error) setError(error.message)
      else if (!data.session) setInfo('Compte créé. Vérifie tes e-mails pour confirmer, puis connecte-toi.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setBusy(false)
  }

  return (
    <div className="center-card">
      <h1>ClassHub</h1>
      <p className="muted">La classe digitale : chat, synthèses, entraide.</p>
      <form onSubmit={submit} className="stack">
        {mode === 'signup' && (
          <input
            placeholder="Prénom (ou pseudo)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={40}
            required
          />
        )}
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Mot de passe (6 caractères min.)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <button disabled={busy}>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button>
      </form>
      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}
      <button className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
      </button>
    </div>
  )
}

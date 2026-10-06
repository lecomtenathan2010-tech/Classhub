import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from './lib/supabase'
import Auth from './components/Auth'
import Home from './components/Home'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isConfigured) {
    return (
      <div className="center-card">
        <h1>ClassHub</h1>
        <p className="error">
          Supabase n'est pas configuré. Copie <code>.env.example</code> vers <code>.env.local</code>,
          remplis les deux valeurs, puis relance <code>npm run dev</code>. (Voir le README, étape 2.)
        </p>
      </div>
    )
  }
  if (loading) return <div className="center-card">Chargement…</div>
  return session ? <Home session={session} /> : <Auth />
}

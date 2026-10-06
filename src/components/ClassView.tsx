import { useState } from 'react'
import { supabase, type ClassRow } from '../lib/supabase'
import Chat from './Chat'
import Syntheses from './Syntheses'

type Props = {
  cls: ClassRow
  userId: string
  onBack: () => void
  onLeft: () => void
}

export default function ClassView({ cls, userId, onBack, onLeft }: Props) {
  const [tab, setTab] = useState<'chat' | 'syntheses'>('chat')
  const [showCode, setShowCode] = useState(false)

  async function leave() {
    if (!confirm('Quitter cette classe ?')) return
    const { error } = await supabase
      .from('memberships')
      .delete()
      .eq('class_id', cls.id)
      .eq('user_id', userId)
    if (error) alert(error.message)
    else onLeft()
  }

  return (
    <div className="page">
      <header className="topbar">
        <button className="link" onClick={onBack}>
          ‹ Classes
        </button>
        <strong>{cls.name}</strong>
        <button className="link" onClick={() => setShowCode(!showCode)}>
          Inviter
        </button>
      </header>

      {showCode && (
        <div className="card invite">
          <p>Code d'invitation à partager avec ta classe :</p>
          <div className="code">{cls.invite_code}</div>
          <button className="link danger" onClick={leave}>
            Quitter la classe
          </button>
        </div>
      )}

      <nav className="tabs">
        <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
          Chat
        </button>
        <button className={tab === 'syntheses' ? 'active' : ''} onClick={() => setTab('syntheses')}>
          Synthèses
        </button>
      </nav>

      {tab === 'chat' ? (
        <Chat classId={cls.id} userId={userId} />
      ) : (
        <Syntheses classId={cls.id} userId={userId} />
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { supabase, type MessageRow } from '../lib/supabase'

const SELECT = 'id, class_id, user_id, channel, body, created_at, profiles(display_name)'

export default function Chat({ classId, userId }: { classId: string; userId: string }) {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true

    supabase
      .from('messages')
      .select(SELECT)
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(error.message)
        else setMessages(((data ?? []) as unknown as MessageRow[]).reverse())
      })

    const channel = supabase
      .channel(`messages:${classId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `class_id=eq.${classId}` },
        async (payload) => {
          const { data } = await supabase.from('messages').select(SELECT).eq('id', payload.new.id).single()
          if (!active || !data) return
          const row = data as unknown as MessageRow
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => setMessages((prev) => prev.filter((m) => m.id !== payload.old.id)),
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [classId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    setError(null)
    const { error } = await supabase.from('messages').insert({ class_id: classId, body })
    if (error) {
      setError(error.message)
      setText(body)
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if (error) setError(error.message)
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages.length === 0 && <p className="muted center">Aucun message pour l'instant. Lance la discussion !</p>}
        {messages.map((m) => {
          const mine = m.user_id === userId
          return (
            <div key={m.id} className={`msg ${mine ? 'mine' : ''}`}>
              {!mine && <div className="author">{m.profiles?.display_name ?? 'Élève'}</div>}
              <div className="bubble">{m.body}</div>
              <div className="meta">
                {new Date(m.created_at).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
                {mine && (
                  <button className="link tiny" onClick={() => remove(m.id)}>
                    supprimer
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      {error && <p className="error">{error}</p>}
      <form onSubmit={send} className="composer">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écris un message…"
          maxLength={2000}
        />
        <button>Envoyer</button>
      </form>
    </div>
  )
}

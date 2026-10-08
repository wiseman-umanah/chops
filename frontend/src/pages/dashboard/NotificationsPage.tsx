import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Seo } from '@/hooks/useSeo'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import RemixIcon from '@/components/RemixIcon'

const BRAND = '#FF6900'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  <  1) return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

const TYPE_ICON: Record<string, { icon: string; bg: string; color: string }> = {
  payment:        { icon: 'ri-money-dollar-circle-fill', bg: '#dcfce7', color: '#16a34a' },
  session_closed: { icon: 'ri-checkbox-circle-fill',     bg: '#fef9c3', color: '#ca8a04' },
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-neutral-100" />
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const notifications = useQuery(api.notifications.list, {})
  const markRead      = useMutation(api.notifications.markRead)
  const markAllRead   = useMutation(api.notifications.markAllRead)

  async function handleClick(id: Id<'notifications'>, read: boolean) {
    if (!read) await markRead({ notificationId: id })
  }

  const displayed = notifications
    ? filter === 'unread'
      ? notifications.filter(n => !n.read)
      : notifications
    : null

  const unreadCount = notifications?.filter(n => !n.read).length ?? 0

  return (
    <div className="max-w-[680px] mx-auto">
      <Seo title="Notifications" path="/dashboard/notifications" noIndex />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          aria-label="Back"
          className="text-neutral-400 hover:text-neutral-700 transition-colors shrink-0"
        >
          <RemixIcon name="ri-arrow-left-s-line" size={26} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-extrabold text-neutral-900 leading-tight">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-[13px] text-neutral-400">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead()}
            className="text-[13px] font-semibold transition-colors hover:opacity-70 shrink-0"
            style={{ color: BRAND }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-5">
        {(['all', 'unread'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className="px-4 py-1.5 rounded-full text-[13px] font-semibold capitalize transition-colors"
            style={
              filter === tab
                ? { background: BRAND, color: '#fff' }
                : { background: '#f4f4f5', color: '#52525b' }
            }
          >
            {tab}
            {tab === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full"
                style={{ background: filter === 'unread' ? 'rgba(255,255,255,0.3)' : BRAND, color: filter === 'unread' ? '#fff' : '#fff' }}>
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {displayed === null ? (
        <Skeleton />
      ) : displayed.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: '#f4f4f5' }}>
            <RemixIcon name="ri-notification-off-line" size={24} color="#a1a1aa" />
          </div>
          <p className="text-[15px] font-semibold text-neutral-500">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-[13px] text-neutral-400 mt-1">
            {filter === 'unread' ? "You're all caught up!" : 'Activity on your chops will appear here.'}
          </p>
        </motion.div>
      ) : (
        <AnimatePresence initial={false}>
          <div className="flex flex-col gap-2">
            {displayed.map(notif => {
              const meta = TYPE_ICON[notif.type] ?? TYPE_ICON.payment
              return (
                <motion.button
                  key={notif._id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  onClick={() => handleClick(notif._id, notif.read)}
                  className="w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition-colors"
                  style={{
                    borderColor: notif.read ? '#f4f4f5' : '#fed7aa',
                    background:  notif.read ? '#ffffff' : '#fff7ed',
                  }}
                >
                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: meta.bg }}
                  >
                    <RemixIcon name={meta.icon} size={18} color={meta.color} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-neutral-900 leading-snug truncate">
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="text-[12px] text-neutral-500 mt-0.5 leading-snug line-clamp-2">
                        {notif.body}
                      </p>
                    )}
                    <p className="text-[11px] text-neutral-400 mt-1">
                      {timeAgo(notif._creationTime)}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full shrink-0 mt-2"
                      style={{ background: BRAND }} />
                  )}
                </motion.button>
              )
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}

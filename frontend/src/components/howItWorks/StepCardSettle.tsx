/** Step 3 — Direct Payment & Auto-Settlement (cream card) */
export default function StepCardSettle() {
  const participants = [
    { name: 'Tomiwa', avatar: '/avatar.png' },
    { name: 'Wakki',  avatar: '/avatar.png' },
  ]

  return (
    <div className="flex flex-col h-full p-7">
      {/* Header text */}
      <div className="mb-6 text-center">
        <h3 className="font-creato font-extrabold text-[28px] sm:text-[32px] leading-tight" style={{ color: '#FF6900' }}>
          Direct Payment &<br />Auto-Settlement
        </h3>
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: '#FF6900' }}>
          Friends open the link, pick their share,<br />hit Pay, and the bill is settled instantly in<br />real-time.
        </p>
      </div>

      {/* Payment rows */}
      <div className="mt-auto flex flex-col gap-2">
        {participants.map(({ name, avatar }) => (
          <div key={name} className="flex items-center gap-3 bg-white rounded-full px-4 py-6">
            <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0" />
            <span className="text-[14px] font-semibold text-neutral-900 flex-1">{name}</span>
            <span
              className="text-[11px] font-bold px-3 py-1 rounded-full"
              style={{ background: '#dcfce7', color: '#16a34a' }}
            >
              sent
            </span>
          </div>
        ))}

        {/* CTA */}
        <button
          className="mt-2 w-full py-6 rounded-full text-[13px] font-bold text-white"
          style={{ background: '#FF6900' }}
        >
          Check out
        </button>
      </div>
    </div>
  )
}

/** Step 3 — Direct Payment & Auto-Settlement (cream card) */
export default function StepCardSettle() {
  const participants = [
    { name: 'Tomiwa', avatar: '/avatar.png' },
    { name: 'Wakki',  avatar: '/avatar.png' },
  ]

  return (
    <div className="flex flex-col h-full p-[6%]">
      {/* Header text */}
      <div className="mb-[5%] text-center">
        <h3 className="font-creato font-extrabold text-[clamp(18px,5vw,28px)] leading-tight" style={{ color: '#FF6900' }}>
          Direct Payment &<br />Auto-Settlement
        </h3>
        <p className="mt-2 text-[clamp(11px,3vw,13px)] leading-relaxed" style={{ color: '#FF6900' }}>
          Friends open the link, pick their share,<br />hit Pay, and the bill is settled instantly in<br />real-time.
        </p>
      </div>

      {/* Payment rows */}
      <div className="mt-auto flex flex-col gap-2">
        {participants.map(({ name, avatar }) => (
          <div key={name} className="flex items-center gap-3 bg-white rounded-full px-4 py-4">
            <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />
            <span className="text-[clamp(11px,3vw,14px)] font-semibold text-neutral-900 flex-1">{name}</span>
            <span
              className="text-[clamp(9px,2.2vw,11px)] font-bold px-3 py-1 rounded-full"
              style={{ background: '#dcfce7', color: '#16a34a' }}
            >
              sent
            </span>
          </div>
        ))}

        {/* CTA */}
        <button
          className="mt-2 w-full py-4 rounded-full text-[clamp(11px,3vw,13px)] font-bold text-white"
          style={{ background: '#FF6900' }}
        >
          Check out
        </button>
      </div>
    </div>
  )
}

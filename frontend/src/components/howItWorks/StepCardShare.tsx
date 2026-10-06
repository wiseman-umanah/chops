/** Step 2 — Share the Web Link (dark card) */
import jigsaw  from '../../../asset/images/jigsaw.png'
import avatar1 from '../../../asset/images/avatar1.png'

export default function StepCardShare() {
  return (
    <div className="relative flex flex-col h-full p-7 overflow-hidden">
      {/* Jigsaw background — 5% opacity */}
      <img
        src={jigsaw}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        style={{ opacity: 0.05, zIndex: 0 }}
      />
      {/* Header text */}
      <div className="relative mb-6 text-center" style={{ zIndex: 1 }}>
        <h3 className="font-creato font-bold text-[32px] sm:text-[36px] leading-tight text-white">
          Share the<br />Web Link
        </h3>
        <p className="mt-3 text-[16px] text-white font-bold leading-relaxed">
          Copy your unique Chop link and<br />paste it straight into your WhatsApp<br />group or chat.
        </p>
      </div>

      {/* Session preview mock */}
      <div className="absolute right-10 -bottom-10 left-10 bg-white rounded-[30px] p-8 pb-[60px]" style={{ zIndex: 1 }}>
        <div className="mb-3">
          <p className="text-[14px] font-bold text-neutral-900">Group Lunch</p>
          <p className="text-[12px] text-neutral-400">Food || 7 Members</p>
          {/* Progress bar */}
          <div className="mt-2 h-1 rounded-full bg-neutral-100 overflow-hidden">
            <div className="h-full rounded-full w-[30%]" style={{ background: '#FF6900' }} />
          </div>
        </div>

        {/* Participant row */}
        <div className="flex items-center gap-3 py-2">
          <img src={avatar1} alt="Tomiwa" className="w-8 h-8 rounded-full object-cover shrink-0" />
          <span className="text-[13px] font-semibold text-neutral-800 flex-1">Tomiwa</span>
          <span className="text-[14px] font-bold text-neutral-900">₦1500</span>
        </div>

        {/* CTA */}
        <button
          className="mt-3 py-6 rounded-full text-[13px] font-bold text-white"
          style={{ background: '#FF6900', position: 'relative', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% + 8rem)' }}
        >
          Copy link
        </button>
      </div>
    </div>
  )
}

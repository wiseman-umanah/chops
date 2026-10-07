/** Step 2 — Share the Web Link (dark card) */
import jigsaw  from '../../../asset/images/jigsaw.png'
import avatar1 from '../../../asset/images/avatar1.png'

export default function StepCardShare() {
  return (
    <div className="relative flex flex-col h-full p-[6%] overflow-hidden">
      {/* Jigsaw background — 5% opacity */}
      <img
        src={jigsaw}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        style={{ opacity: 0.05, zIndex: 0 }}
      />
      {/* Header text */}
      <div className="relative mb-[5%] text-center" style={{ zIndex: 1 }}>
        <h3 className="font-creato font-bold text-[clamp(20px,5.5vw,32px)] leading-tight text-white">
          Share the<br />Web Link
        </h3>
        <p className="mt-2 text-[clamp(12px,3.5vw,16px)] text-white font-bold leading-relaxed">
          Copy your unique Chop link and<br />paste it straight into your WhatsApp<br />group or chat.
        </p>
      </div>

      {/* Session preview mock */}
      <div className="absolute right-[8%] -bottom-[2%] left-[8%] bg-white rounded-[30px] p-[7%] pb-[14%]" style={{ zIndex: 1 }}>
        <div className="mb-2">
          <p className="text-[clamp(11px,3vw,14px)] font-bold text-neutral-900">Group Lunch</p>
          <p className="text-[clamp(10px,2.5vw,12px)] text-neutral-400">Food || 7 Members</p>
          {/* Progress bar */}
          <div className="mt-1.5 h-1 rounded-full bg-neutral-100 overflow-hidden">
            <div className="h-full rounded-full w-[30%]" style={{ background: '#FF6900' }} />
          </div>
        </div>

        {/* Participant row */}
        <div className="flex items-center gap-2 py-1.5">
          <img src={avatar1} alt="Tomiwa" className="w-7 h-7 rounded-full object-cover shrink-0" />
          <span className="text-[clamp(10px,2.5vw,13px)] font-semibold text-neutral-800 flex-1">Tomiwa</span>
          <span className="text-[clamp(10px,2.5vw,14px)] font-bold text-neutral-900">₦1500</span>
        </div>

        {/* CTA */}
        <button
          className="mt-2 py-4 rounded-full text-[clamp(10px,2.5vw,13px)] font-bold text-white"
          style={{ background: '#FF6900', position: 'relative', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% + 4rem)' }}
        >
          Copy link
        </button>
      </div>
    </div>
  )
}

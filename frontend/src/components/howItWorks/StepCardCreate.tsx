/** Step 1 — Create Your Chop Session (orange card) */
export default function StepCardCreate() {
  return (
    <div className="relative flex flex-col h-full p-[6%]">
      {/* Header text */}
      <div className="mb-[5%] text-center">
        <h3 className="font-creato font-extrabold text-[clamp(18px,5vw,28px)] leading-tight text-white">
          Create Your<br />Chop Session
        </h3>
        <p className="mt-2 text-[clamp(12px,3.5vw,16px)] text-white font-bold leading-relaxed">
          Choose your mode (Food, Fund Pool,<br />or Expense Split) and add the total<br />amount or line items.
        </p>
      </div>

      {/* Category selector mock */}
      <div className="absolute left-[8%] -right-[18%] mt-auto bg-white rounded-2xl p-[8%] pb-[14%] -bottom-[2%]">
        <p className="text-[clamp(10px,2.5vw,12px)] font-bold text-neutral-500 mb-2">Category</p>
        <div className="flex flex-col gap-1.5">
          {/* Selected */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-full border-2" style={{ borderColor: '#FF6900', background: '#fff8f3' }}>
            <span className="w-3.5 h-3.5 rounded-full border-[4px] shrink-0" style={{ borderColor: '#FF6900' }} />
            <span className="text-[clamp(10px,2.5vw,13px)] font-bold text-neutral-800">Food</span>
          </div>
          {/* Unselected */}
          {['Fund Pool', 'Expense Split'].map(label => (
            <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-full">
              <span className="w-3.5 h-3.5 rounded-full border shrink-0 border-neutral-300" />
              <span className="text-[clamp(10px,2.5vw,13px)] text-neutral-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

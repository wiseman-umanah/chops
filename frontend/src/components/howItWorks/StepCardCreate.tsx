/** Step 1 — Create Your Chop Session (orange card) */
export default function StepCardCreate() {
  return (
    <div className="relative flex flex-col h-full p-7">
      {/* Header text */}
      <div className="mb-6 text-center">
        <h3 className="font-creato font-extrabold text-[28px] sm:text-[32px] leading-tight text-white">
          Create Your<br />Chop Session
        </h3>
        <p className="mt-3 text-[16px] text-white font-bold leading-relaxed">
          Choose your mode (Food, Fund Pool,<br />or Expense Split) and add the total<br />amount or line items.
        </p>
      </div>

      {/* Category selector mock */}
      <div className="absolute left-10 -right-20 mt-auto bg-white rounded-2xl p-10 pb-[60px] -bottom-10">
        <p className="text-[12px] font-bold text-neutral-500 mb-3">Category</p>
        <div className="flex flex-col gap-2">
          {/* Selected */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-full border-2" style={{ borderColor: '#FF6900', background: '#fff8f3' }}>
            <span className="w-4 h-4 rounded-full border-[5px] shrink-0" style={{ borderColor: '#FF6900' }} />
            <span className="text-[13px] font-bold text-neutral-800">Food</span>
          </div>
          {/* Unselected */}
          {['Fund Pool', 'Expense Split'].map(label => (
            <div key={label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-full">
              <span className="w-4 h-4 rounded-full border shrink-0 border-neutral-300" />
              <span className="text-[13px] text-neutral-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

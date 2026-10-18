import { Link } from 'react-router-dom'
import { Seo } from '@/hooks/useSeo'
import Logo from '@/components/Logo'

export default function NotFoundPage() {
  return (
    <>
      <Seo
        title="Page not found"
        description="This page doesn't exist on Chop."
        path="/404"
        noIndex
      />
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
        <Link to="/" className="flex items-center gap-2 mb-10">
          <Logo width={36} height={36} />
          <span style={{ fontSize: 22, letterSpacing: '2px', fontFamily: 'Godber, sans-serif', color: '#18181b' }}>
            Chop
          </span>
        </Link>

        {/* Big 404 */}
        <p className="text-[80px] sm:text-[120px] font-extrabold leading-none"
          style={{ color: '#FF6900', opacity: 0.15, userSelect: 'none' }}>
          404
        </p>

        <h1 className="text-[26px] sm:text-[32px] font-extrabold text-neutral-900 mt-2 mb-3">
          Page not found
        </h1>
        <p className="text-[15px] text-neutral-500 max-w-[360px] mb-8 leading-relaxed">
          This page doesn't exist or the link may have expired. Head back home and start chopping.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[320px]">
          <Link
            to="/"
            className="flex-1 py-3.5 rounded-full text-[14px] font-bold text-white text-center transition-opacity hover:opacity-90"
            style={{ background: '#FF6900' }}
          >
            Go home
          </Link>
          <Link
            to="/dashboard"
            className="flex-1 py-3.5 rounded-full text-[14px] font-semibold text-neutral-700 text-center border border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </>
  )
}

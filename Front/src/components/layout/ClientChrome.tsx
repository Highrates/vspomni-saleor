'use client'

import { usePathname } from 'next/navigation'
import Footer from '@/components/layout/Footer'
import Header from '@/components/layout/Header'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

export default function ClientChrome({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const hideChrome = [
    '/login',
    '/register',
    '/auth/reset',
    '/checkout',
  ].includes(pathname)

  const fullBleedRoutes = ['/korporativnye-podarki']
  const fullBleed = fullBleedRoutes.includes(pathname)

  const overlayRoutes = ['/profile', '/catalog']
  const headerVariant = overlayRoutes.includes(pathname) ? 'overlay' : 'default'

  return (
    <>
      {!hideChrome && <Header variant={headerVariant} />}
      <main
        className={`${!hideChrome ? 'pt-[80px]' : ''} w-full min-h-screen ${fullBleed ? 'bg-[#0c0c0c]' : ''}`}
      >
        {fullBleed ? children : <div className="container">{children}</div>}
      </main>
      <ToastContainer
        className="vspomni-toast-container"
        position="top-center"
        autoClose={2000}
        pauseOnHover={false}
        theme="dark"
        limit={3}
      />
      {!hideChrome && <Footer />}
    </>
  )
}

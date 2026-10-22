'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, User, ShoppingBag, Send, Menu, X } from 'lucide-react'
import ModalCart from '../modals/CartModal'
import SearchResults from '../search/SearchResults'
import { useCartStore } from '@/stores/useCart'
import { useCartUiStore } from '@/stores/useCartUiStore'
import { useAuthStore } from '@/stores/useAuth'
import { searchProducts } from '@/graphql/queries/search.service'
import { ProductNode } from '@/graphql/types/product.types'
import Image from 'next/image'
import { SITE_PRIMARY_NAV } from '@/lib/seo/siteNav'

interface HeaderProps {
  variant: 'default' | 'overlay'
}

export default function Header({ variant = 'default' }: HeaderProps) {
  const [showCart, setShowCart] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductNode[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  
  const cartQuantity = useCartStore((state) => state.totalItems)
  const cartHasItems = useCartStore((state) => state.totalItems > 0)
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const isHome = pathname === '/'

  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout>(null)

  const isOverlay = variant === 'overlay'

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const cartModalOpenSignal = useCartUiStore((s) => s.openSignal)
  useEffect(() => {
    if (cartModalOpenSignal > 0) setShowCart(true)
  }, [cartModalOpenSignal])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
        setSearchQuery('')
        setSearchResults([])
      }
    }
    if (searchOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      searchInputRef.current?.focus()
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [searchOpen])

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    if (searchQuery.trim().length === 0) {
      setSearchResults([])
      return
    }

    if (searchQuery.trim().length < 2) return

    setSearchLoading(true)
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchProducts(searchQuery, 10)
        setSearchResults(results)
      } catch (error) {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [searchQuery])

  const handleProfile = () => {
    isAuthenticated ? router.push('/profile') : router.push('/login')
  }

  const getHeaderStyles = () => {
    if (isOverlay) {
      return scrolled
        ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-black/10'
        : 'bg-transparent'
    }
    return scrolled
      ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-black/10'
      : 'bg-white'
  }

  const getMenuBackground = () => {
    if (isOverlay && !scrolled) {
      return 'bg-white/20 backdrop-blur-sm border-white/30 z-10'
    }
    return 'bg-white border-black/15'
  }

  const iconColor = isOverlay && !scrolled ? '#FFFFFF' : '#000000'
  const cartIconColor = cartHasItems ? '#E52F20' : iconColor

  return (
    <>
      {isOverlay && (
        <div className="mx-auto h-[511px] w-full max-w-[1679px] bg-[url('/images/catalog.jpg')] bg-cover bg-center z-0 pointer-events-none rounded-none sm:mt-3 sm:mb-3 sm:w-[calc(100%-24px)] sm:rounded-3xl" />
      )}

      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 z-50 w-full overflow-visible py-4 transition-all duration-300 ${getHeaderStyles()}`}
        style={{ height: '80px' }}
      >
        <div className="container flex h-full items-center justify-between overflow-visible sm:px-6 md:px-[33px]">
          {isHome ? (
            <span className="text-base sm:text-[18px] font-semibold tracking-wide inline-flex shrink-0">
              <Image
                src={'/logo/logo-vspomni.svg'}
                alt="ВСПОМНИ"
                width={100}
                height={20}
                className={isOverlay && !scrolled ? 'brightness-0 invert' : ''}
              />
            </span>
          ) : (
            <Link
              href="/"
              aria-label="ВСПОМНИ — на главную"
              className="text-base sm:text-[18px] font-semibold tracking-wide inline-flex shrink-0"
            >
              <Image
                src={'/logo/logo-vspomni.svg'}
                alt="ВСПОМНИ — на главную"
                width={100}
                height={20}
                className={isOverlay && !scrolled ? 'brightness-0 invert' : ''}
              />
            </Link>
          )}

          {/* Desktop Menu */}
          <div
            className={`hidden md:flex items-center justify-center rounded-full border px-3 lg:px-6 xl:px-8 shrink-0 max-w-[min(100%,52rem)] ${getMenuBackground()}`}
            style={{ height: '46px', width: 'auto' }}
          >
            <nav
              className={`flex items-center gap-2.5 lg:gap-4 xl:gap-6 text-[13px] lg:text-sm xl:text-[15px] font-medium ${isOverlay && !scrolled ? 'text-white' : 'text-black/80'}`}
              aria-label="Основное меню"
            >
              {SITE_PRIMARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:opacity-80 transition whitespace-nowrap"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="https://t.me/vspomni_corp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:opacity-80 transition whitespace-nowrap"
              >
                <Send size={16} strokeWidth={1.8} color="#229ED9" />
                <span className="hidden xl:inline">Связаться</span>
              </Link>
            </nav>

            <div
              className={`flex items-center gap-3 border-l pl-6 lg:gap-5 ml-4 lg:space-x-5 ${isOverlay && !scrolled ? 'border-white/50' : 'border-black/50'}`}
            >
              <button
                aria-label="Поиск"
                onClick={() => setSearchOpen((v) => !v)}
                className="hover:opacity-70 transition-opacity"
              >
                <Search size={22} strokeWidth={1.8} color={iconColor} />
              </button>

              <button
                aria-label="Корзина"
                className="relative hover:opacity-70 transition-opacity cursor-pointer"
                onClick={() => setShowCart(!showCart)}
              >
                <ShoppingBag size={22} strokeWidth={1.8} color={cartIconColor} />
                <span className={`absolute -top-1 -right-4 text-[12px] font-semibold ${isOverlay && !scrolled ? 'text-white' : 'text-black'}`}>
                  ({cartQuantity})
                </span>
              </button>

              <button
                aria-label="Профиль"
                className="hover:opacity-70 transition-opacity cursor-pointer"
                onClick={handleProfile}
              >
                <User size={22} strokeWidth={1.8} color={iconColor} />
              </button>
            </div>
          </div>

          {/* Mobile Icons */}
          <div className="flex items-center gap-3 overflow-visible md:hidden">
            <button
              type="button"
              aria-label="Поиск"
              className="flex h-10 w-10 shrink-0 items-center justify-center hover:opacity-70"
              onClick={() => {
                setSearchOpen((v) => !v)
                setMenuOpen(false)
              }}
            >
              <Search size={20} strokeWidth={1.8} color={iconColor} />
            </button>
            <button
              type="button"
              aria-label="Корзина"
              className="relative flex h-10 shrink-0 items-center justify-center gap-0.5 hover:opacity-70"
              onClick={() => setShowCart(!showCart)}
            >
              <ShoppingBag size={20} strokeWidth={1.8} color={cartIconColor} />
              <span
                className={`min-w-[1.25rem] text-left text-[12px] font-semibold tabular-nums leading-none ${
                  cartHasItems
                    ? 'text-[#E52F20]'
                    : isOverlay && !scrolled
                      ? 'text-white'
                      : 'text-black'
                }`}
              >
                ({cartQuantity})
              </span>
            </button>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center hover:opacity-70"
              onClick={() => {
                setMenuOpen((v) => !v)
                setSearchOpen(false)
              }}
              aria-label="Меню"
            >
              {menuOpen ? (
                <X size={22} strokeWidth={1.8} color={iconColor} />
              ) : (
                <Menu size={22} strokeWidth={1.8} color={iconColor} />
              )}
            </button>
          </div>
        </div>

        {/* Global Search Dropdown (Works on Mobile & Desktop) */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              ref={searchRef}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
              className="absolute top-full left-0 w-full bg-white border-t border-black/10 shadow-md mt-px"
            >
              <div className="container sm:px-6 md:px-8 py-4 relative z-50">
                <div className="flex items-center justify-between gap-2">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Поиск по каталогу..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-sm sm:text-md px-3 sm:px-4 py-2 border border-black/20 rounded-full outline-none focus:border-black transition"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      setSearchOpen(false)
                      setSearchQuery('')
                      setSearchResults([])
                    }}
                    className="ml-2 sm:ml-4 p-2 hover:bg-black/5 rounded-full transition shrink-0"
                    aria-label="Закрыть поиск"
                  >
                    <X size={20} strokeWidth={1.8} />
                  </button>
                </div>
                {(searchQuery.length >= 2 || searchResults.length > 0 || searchLoading) && (
                  <SearchResults
                    products={searchResults}
                    loading={searchLoading}
                    onClose={() => {
                      setSearchOpen(false)
                      setSearchQuery('')
                      setSearchResults([])
                    }}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className={`absolute top-full left-0 w-full border-t shadow-md md:hidden mt-px ${
                isOverlay && !scrolled
                  ? 'bg-white/95 backdrop-blur-md border-white/20 text-black'
                  : 'bg-white border-black/10'
              }`}
            >
              <nav
                className="flex flex-col px-2 sm:px-6 py-5 text-md font-medium gap-4"
                aria-label="Мобильное меню"
              >
                {SITE_PRIMARY_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="https://t.me/vspomni_corp"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-1"
                >
                  <Send size={16} strokeWidth={1.8} color="#229ED9" />
                  Связаться
                </Link>

                <div className={`flex items-center gap-6 pt-4 border-t mt-4 ${isOverlay && !scrolled ? 'border-white/20' : 'border-black/10'}`}>
                  <button
                    type="button"
                    onClick={handleProfile}
                    className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                    aria-label="Личный кабинет"
                  >
                    <User size={20} strokeWidth={1.8} color="#000000" />
                    <span className="text-md font-medium text-black">
                      Личный кабинет
                    </span>
                  </button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <ModalCart visible={showCart} onClose={() => setShowCart(false)} />
    </>
  )
}
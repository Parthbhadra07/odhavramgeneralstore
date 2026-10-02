"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMounted } from "@/hooks/use-mounted";
import {
  ShoppingCart,
  User,
  Menu,
  X,
  Heart,
  LayoutDashboard,
} from "lucide-react";
import { APP_NAME, STORE_PHONE, STORE_PHONE_TEL } from "@/lib/constants";
import { CallStoreButton } from "@/components/call-store-button";
import { useAuth } from "@/hooks/use-auth";
import { useCartStore } from "@/store/cart-store";
import { SearchBar } from "@/components/search-bar";
import { CartDrawer } from "@/components/cart-drawer";
import { cn } from "@/utils/cn";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop" },
  { href: "/track-order", label: "Track Order" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mounted = useMounted();
  const { profile, isAdmin } = useAuth();
  const { getItemCount, setOpen } = useCartStore();
  const itemCount = mounted ? getItemCount() : 0;

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const isCatalogPage = Boolean(
    pathname?.startsWith("/products") ||
    pathname?.startsWith("/categories") ||
    pathname === "/products"
  );

  return (
    <>
      <header
        data-main-navbar="true"
        className={cn(
          "main-website-header sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 text-white shadow-md border-b border-blue-950/40",
          isCatalogPage && "hidden md:block"
        )}
      >
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white p-0.5 shadow-sm transition-transform group-hover:scale-105">
                <Image
                  src="/logo.png"
                  alt={APP_NAME}
                  width={40}
                  height={40}
                  priority
                  className="h-full w-full rounded-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="hidden text-base font-bold leading-tight text-white sm:inline">{APP_NAME}</span>
                <span className="text-sm font-bold text-white sm:hidden">OGS</span>
                <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-blue-200 sm:inline">Fresh &amp; Daily Grocery</span>
              </div>
            </Link>

            <div className="hidden flex-1 max-w-xl md:block">
              <SearchBar />
            </div>

            <nav className="hidden items-center gap-6 lg:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-blue-100 hover:text-white px-2 py-1 rounded-lg hover:bg-blue-800/60 transition"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <a
                href={STORE_PHONE_TEL}
                className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue-100 hover:text-white hover:bg-blue-800/80 border border-blue-600/60 md:flex transition"
              >
                {STORE_PHONE}
              </a>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="relative rounded-lg p-2 text-blue-100 hover:text-white hover:bg-blue-800/60 transition"
                aria-label="Open cart"
              >
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-blue-950 shadow-xs border border-white">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </button>

              {profile ? (
                <div className="hidden items-center gap-1 sm:flex">
                  <Link
                    href="/dashboard/wishlist"
                    className="rounded-lg p-2 text-blue-100 hover:text-white hover:bg-blue-800/60 transition"
                    aria-label="Wishlist"
                  >
                    <Heart className="h-5 w-5" />
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-lg p-2 text-blue-100 hover:text-white hover:bg-blue-800/60 transition"
                    aria-label="Account"
                  >
                    <User className="h-5 w-5" />
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="rounded-lg p-2 text-blue-100 hover:text-white hover:bg-blue-800/60 transition"
                      aria-label="Admin"
                    >
                      <LayoutDashboard className="h-5 w-5" />
                    </Link>
                  )}
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="hidden rounded-lg bg-white px-4 py-2 text-sm font-bold text-blue-900 shadow-sm hover:bg-blue-50 transition sm:block"
                >
                  Sign In
                </Link>
              )}

              <button
                type="button"
                className="rounded-lg p-2 text-blue-100 hover:text-white hover:bg-blue-800/60 lg:hidden"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {!isCatalogPage && (
            <div className="pb-3 md:hidden">
              <SearchBar />
            </div>
          )}
        </div>

        <div
          className={cn(
            "border-t border-blue-800 bg-blue-900/95 backdrop-blur-md lg:hidden",
            mobileOpen ? "block" : "hidden"
          )}
        >
          <nav className="container mx-auto flex flex-col gap-1 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-blue-100 hover:text-white hover:bg-blue-800"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {!profile && (
              <Link
                href="/auth/login"
                className="rounded-lg px-3 py-2 font-bold text-amber-300 hover:bg-blue-800"
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
            )}
            {profile && (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-lg px-3 py-2 text-blue-100 hover:text-white hover:bg-blue-800"
                  onClick={() => setMobileOpen(false)}
                >
                  My Account
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="rounded-lg px-3 py-2 text-blue-100 hover:text-white hover:bg-blue-800"
                    onClick={() => setMobileOpen(false)}
                  >
                    Admin Panel
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>
      </header>
      <CartDrawer />
    </>
  );
}

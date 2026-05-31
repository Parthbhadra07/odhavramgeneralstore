"use client";

import Link from "next/link";
import { useState } from "react";
import { useMounted } from "@/hooks/use-mounted";
import {
  ShoppingCart,
  User,
  Menu,
  X,
  Leaf,
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const mounted = useMounted();
  const { profile, isAdmin } = useAuth();
  const { getItemCount, setOpen } = useCartStore();
  const itemCount = mounted ? getItemCount() : 0;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-green-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600 text-white">
                <Leaf className="h-5 w-5" />
              </div>
              <span className="hidden text-lg font-bold text-green-800 sm:inline">{APP_NAME}</span>
              <span className="text-sm font-bold text-green-800 sm:hidden">OGS</span>
            </Link>

            <div className="hidden flex-1 max-w-xl md:block">
              <SearchBar />
            </div>

            <nav className="hidden items-center gap-6 lg:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-gray-700 hover:text-green-700"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <a
                href={STORE_PHONE_TEL}
                className="hidden items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 md:flex"
              >
                {STORE_PHONE}
              </a>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="relative rounded-lg p-2 text-gray-700 hover:bg-green-50"
                aria-label="Open cart"
              >
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </button>

              {profile ? (
                <div className="hidden items-center gap-1 sm:flex">
                  <Link
                    href="/dashboard/wishlist"
                    className="rounded-lg p-2 text-gray-700 hover:bg-green-50"
                    aria-label="Wishlist"
                  >
                    <Heart className="h-5 w-5" />
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-lg p-2 text-gray-700 hover:bg-green-50"
                    aria-label="Account"
                  >
                    <User className="h-5 w-5" />
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="rounded-lg p-2 text-gray-700 hover:bg-green-50"
                      aria-label="Admin"
                    >
                      <LayoutDashboard className="h-5 w-5" />
                    </Link>
                  )}
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="hidden rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 sm:block"
                >
                  Sign In
                </Link>
              )}

              <button
                type="button"
                className="rounded-lg p-2 lg:hidden"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          <div className="pb-3 md:hidden">
            <SearchBar />
          </div>
        </div>

        <div
          className={cn(
            "border-t border-green-100 bg-white lg:hidden",
            mobileOpen ? "block" : "hidden"
          )}
        >
          <nav className="container mx-auto flex flex-col gap-1 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-gray-700 hover:bg-green-50"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {!profile && (
              <Link
                href="/auth/login"
                className="rounded-lg px-3 py-2 font-medium text-green-700"
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
            )}
            {profile && (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-lg px-3 py-2 text-gray-700 hover:bg-green-50"
                  onClick={() => setMobileOpen(false)}
                >
                  My Account
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="rounded-lg px-3 py-2 text-gray-700 hover:bg-green-50"
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

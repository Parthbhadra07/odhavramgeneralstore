import Link from "next/link";
import { Leaf, Mail, Phone, MapPin } from "lucide-react";
import {
  APP_NAME,
  STORE_PHONE,
  STORE_PHONE_TEL,
  STORE_EMAIL,
  STORE_ADDRESS,
} from "@/lib/constants";
import { CallStoreButton } from "@/components/call-store-button";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-green-100 bg-green-900 text-green-50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600">
                <Leaf className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold leading-tight">{APP_NAME}</span>
            </div>
            <p className="text-sm text-green-200">
              Your trusted local grocery store. Daily essentials delivered with care.
            </p>
            <div className="mt-4">
              <CallStoreButton variant="outline" className="border-green-400 text-green-50 hover:bg-green-800" />
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold">Quick Links</h3>
            <ul className="space-y-2 text-sm text-green-200">
              <li><Link href="/products" className="hover:text-white">Shop All</Link></li>
              <li><Link href="/track-order" className="hover:text-white">Track Order</Link></li>
              <li><Link href="/dashboard/orders" className="hover:text-white">My Orders</Link></li>
              <li><Link href="/dashboard" className="hover:text-white">My Account</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 font-semibold">Customer</h3>
            <ul className="space-y-2 text-sm text-green-200">
              <li><Link href="/cart" className="hover:text-white">Cart</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact Us</Link></li>
              <li><Link href="/auth/login" className="hover:text-white">Sign In</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 font-semibold">Contact</h3>
            <ul className="space-y-2 text-sm text-green-200">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <a href={STORE_PHONE_TEL} className="hover:text-white">
                  {STORE_PHONE}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" /> {STORE_EMAIL}
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {STORE_ADDRESS}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-green-800 pt-8 text-center text-sm text-green-300">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

import { Phone, Mail, MapPin, Clock } from "lucide-react";
import {
  APP_NAME,
  STORE_PHONE,
  STORE_PHONE_TEL,
  STORE_EMAIL,
  STORE_ADDRESS,
} from "@/lib/constants";
import { CallStoreButton } from "@/components/call-store-button";

export const metadata = { title: "Contact Us" };

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Contact {APP_NAME}</h1>
      <p className="mb-8 text-gray-600">
        Visit us or call for orders, delivery, and support.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Store Details</h2>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Mobile</p>
                <a href={STORE_PHONE_TEL} className="text-green-700 hover:underline">
                  {STORE_PHONE}
                </a>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Email</p>
                <p className="text-gray-600">{STORE_EMAIL}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Address</p>
                <p className="text-gray-600">{STORE_ADDRESS}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Hours</p>
                <p className="text-gray-600">Mon–Sun: 8:00 AM – 9:00 PM</p>
              </div>
            </li>
          </ul>
          <CallStoreButton className="mt-6" />
        </div>

        <div className="rounded-xl border bg-green-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-green-900">Order by Phone</h2>
          <p className="text-green-800">
            Call {STORE_PHONE} to place your order directly. We deliver locally
            around Odhav, Ahmedabad.
          </p>
          <a
            href={STORE_PHONE_TEL}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700 md:hidden"
          >
            <Phone className="h-5 w-5" />
            Call Store Now
          </a>
        </div>
      </div>
    </div>
  );
}

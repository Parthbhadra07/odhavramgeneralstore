import { PROMO_OFFERS } from "@/lib/constants";
import { Tag } from "lucide-react";

export function PromoOffers() {
  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">Special Offers</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PROMO_OFFERS.map((offer) => (
            <div
              key={offer.code}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${offer.color} p-6 text-white shadow-lg`}
            >
              <Tag className="mb-2 h-6 w-6 opacity-80" />
              <h3 className="text-xl font-bold">{offer.title}</h3>
              <p className="mt-1 text-sm text-white/90">{offer.description}</p>
              <div className="mt-4 inline-block rounded-lg bg-white/20 px-3 py-1 font-mono text-sm font-bold backdrop-blur">
                {offer.code}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

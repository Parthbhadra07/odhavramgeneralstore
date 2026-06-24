import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Truck, ShieldCheck, Clock } from "lucide-react";

export function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-green-700 via-green-600 to-emerald-500 text-white">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-2xl">
          <span className="mb-4 inline-block rounded-full bg-white/20 px-4 py-1 text-sm font-medium backdrop-blur">
            Odhavram General Store · Odhav
          </span>
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
            Your Local Grocery Store, Now Online
          </h1>
          <p className="mb-8 text-lg text-green-100 md:text-xl">
            Daily essentials, snacks, dairy, and household items.
            Order online or call 8160373047 for home delivery.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/products">Shop Now</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
              asChild
            >
              <Link href="/products?featured=true">View Deals</Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Truck, title: "Free Delivery", desc: "On orders above ₹499" },
            { icon: ShieldCheck, title: "Quality Assured", desc: "100% fresh guarantee" },
            { icon: Clock, title: "Fast Delivery", desc: "Within 2 hours" },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex items-center gap-3 rounded-xl bg-white/10 p-4 backdrop-blur"
            >
              <Icon className="h-8 w-8 shrink-0" />
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-green-100">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-10 right-1/4 h-40 w-40 rounded-full bg-emerald-400/20 blur-2xl" />
    </section>
  );
}

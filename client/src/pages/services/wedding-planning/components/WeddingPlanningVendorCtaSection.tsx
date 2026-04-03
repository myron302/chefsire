import { ArrowRight, Building2 } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function WeddingPlanningVendorCtaSection() {
  return (
    <div className="mt-12 mb-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-purple-950 to-pink-900 px-6 py-10 md:px-12 md:py-14 text-white">
        <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-lg">
            <Badge className="bg-pink-500/80 text-white text-xs px-3 py-1">For Wedding Vendors</Badge>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">
              Are you a wedding vendor?
              <span className="block text-pink-300 mt-1">List your business with us.</span>
            </h2>
            <p className="text-slate-300 text-sm md:text-base">
              Reach thousands of couples actively planning weddings right now. Get discovered, accept bookings, and grow your business — all in one place.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto md:min-w-[200px]">
            <Link href="/services/vendor-listing" className="w-full">
              <Button size="lg" className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold shadow-lg shadow-pink-900/40">
                <Building2 className="h-5 w-5 mr-2" />
                List My Business
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/services/vendor-listing" className="w-full">
              <Button size="lg" className="w-full bg-white/15 border border-white/40 text-white hover:bg-white/25 hover:text-white">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

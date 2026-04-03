import { ArrowRight, Building2 } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function WeddingPlanningVendorPromoCard() {
  return (
    <div className="w-full sm:w-[360px] md:w-[420px]">
      <Card className="border-2 border-pink-200/70 dark:border-pink-900/50 bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-pink-950/40 dark:via-background dark:to-purple-950/30 shadow-sm">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-gradient-to-r from-pink-600 to-purple-600 text-white border-0 text-[10px] md:text-xs">Vendors</Badge>
                <span className="text-[11px] md:text-xs text-muted-foreground">Get more bookings</span>
              </div>

              <h2 className="text-base md:text-lg font-extrabold leading-tight">List your business where couples are actively planning</h2>

              <p className="text-sm md:text-[15px] text-muted-foreground mt-2 leading-relaxed">
                Show up in search & on the vendor map, get direct leads, and respond faster with built-in messaging.
              </p>
            </div>

            <div className="flex-shrink-0 rounded-xl p-2 bg-white/60 dark:bg-black/20 border border-pink-200/50 dark:border-pink-900/40">
              <Building2 className="w-6 h-6 md:w-7 md:h-7 text-pink-700 dark:text-pink-300" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-lg border bg-background/70 p-2 text-center">
              <p className="text-xs font-semibold">More leads</p>
              <p className="text-[10px] text-muted-foreground">In search</p>
            </div>
            <div className="rounded-lg border bg-background/70 p-2 text-center">
              <p className="text-xs font-semibold">Direct chat</p>
              <p className="text-[10px] text-muted-foreground">Fast replies</p>
            </div>
            <div className="rounded-lg border bg-background/70 p-2 text-center">
              <p className="text-xs font-semibold">Boosted</p>
              <p className="text-[10px] text-muted-foreground">Feature options</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Link href="/services/vendor-listing">
                <Button size="lg" className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md hover:opacity-95">
                  <Building2 className="w-4 h-4 mr-2 text-white" />
                  List My Business
                  <ArrowRight className="w-4 h-4 ml-2 text-white/90" />
                </Button>
              </Link>
            </div>
            <div className="sm:w-[160px]">
              <Link href="/services/vendor-listing">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-pink-300 text-pink-700 hover:bg-pink-50 dark:border-pink-800 dark:text-pink-200 dark:hover:bg-pink-950/40"
                >
                  Learn More
                </Button>
              </Link>
            </div>
          </div>

          <p className="mt-3 text-[11px] md:text-xs text-muted-foreground">
            Free to start • Upgrade anytime for featured placement & a verified badge
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

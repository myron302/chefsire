import { useState } from "react";
import { ChefHat } from "lucide-react";
import { formatCateringPackagePrice, type CateringPackage } from "@shared/catering-packages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function PackageCover({ item, detail = false }: { item: CateringPackage; detail?: boolean }) {
  if (item.coverImage) {
    return <img src={item.coverImage} alt={`${item.title} cover`} loading="lazy" className={detail ? "max-h-72 w-full rounded-lg object-cover" : "h-44 w-full object-cover"} />;
  }
  return (
    <div
      role="img"
      aria-label={`No cover image for ${item.title}`}
      className={`flex w-full flex-col items-center justify-center gap-2 border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 text-orange-800 ${detail ? "h-64 rounded-lg border" : "h-44 border-b"}`}
    >
      <span className="rounded-full bg-white/80 p-3 shadow-sm" aria-hidden="true"><ChefHat className="h-7 w-7" /></span>
      <span className="text-sm font-medium">No cover image</span>
    </div>
  );
}

export function PackageGallery({ packages, requestQuote }: { packages: CateringPackage[]; requestQuote: (item: CateringPackage) => void }) {
  const [selected, setSelected] = useState<CateringPackage>();
  if (!packages.length) return <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">This provider has not published packages yet.</p>;

  return <>
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {packages.map((item) => <Card key={item.id} className="overflow-hidden">
        <PackageCover item={item} />
        <CardContent className="space-y-3 p-4">
          {item.featured && <Badge>Featured</Badge>}
          <div><h3 className="text-lg font-semibold">{item.title}</h3><p className="text-sm text-muted-foreground">{item.category}</p></div>
          <p className="line-clamp-3 text-sm">{item.description}</p>
          <p className="font-medium">{formatCateringPackagePrice(item)}</p>
          <p className="text-sm text-muted-foreground">{item.minimumGuests}{item.maximumGuests ? `–${item.maximumGuests}` : "+"} guests</p>
          <div className="flex flex-wrap gap-2">{item.dietaryAccommodations.slice(0, 3).map((tag) => <Badge variant="secondary" key={tag}>{tag}</Badge>)}</div>
          <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setSelected(item)}>View Details</Button><Button onClick={() => requestQuote(item)}>Request Quote</Button></div>
        </CardContent>
      </Card>)}
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(undefined)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {selected && <>
          <DialogHeader><DialogTitle>{selected.title}</DialogTitle><DialogDescription>{selected.category} · {formatCateringPackagePrice(selected)}</DialogDescription></DialogHeader>
          <PackageCover item={selected} detail />
          <p className="whitespace-pre-wrap">{selected.description}</p>
          <Details label="Included services" values={selected.includedServices} />
          <Details label="Optional add-ons" values={selected.optionalAddOns} />
          <Details label="Dietary accommodations" values={selected.dietaryAccommodations} />
          <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Preparation style</dt><dd>{selected.preparationStyle || "Not specified"}</dd></div><div><dt className="font-semibold">Service style</dt><dd>{selected.serviceStyle || "Not specified"}</dd></div><div><dt className="font-semibold">Duration</dt><dd>{selected.estimatedDuration ? `${selected.estimatedDuration} minutes` : "Varies"}</dd></div><div><dt className="font-semibold">Guest limits</dt><dd>{selected.minimumGuests}{selected.maximumGuests ? `–${selected.maximumGuests}` : "+"}</dd></div></dl>
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Additional gallery images coming soon</div>
          <Button onClick={() => { setSelected(undefined); requestQuote(selected); }}>Request quote for this package</Button>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}

function Details({ label, values }: { label: string; values: string[] }) {
  return <section><h4 className="font-semibold">{label}</h4>{values.length ? <ul className="ml-5 list-disc">{values.map((value) => <li key={value}>{value}</li>)}</ul> : <p className="text-sm text-muted-foreground">None specified</p>}</section>;
}

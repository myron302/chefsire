import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type HubLink = { id: string; name: string; route: string; emoji: string };

const OTHER_DRINK_HUBS: HubLink[] = [
  { id: "drinks", name: "Drinks Hub", route: "/drinks", emoji: "🥤" },
  { id: "smoothies", name: "Smoothies", route: "/drinks/smoothies", emoji: "🍎" },
  { id: "detoxes", name: "Detoxes", route: "/drinks/detoxes", emoji: "🍃" },
  { id: "potent", name: "Potent Potables (21+)", route: "/drinks/potent-potables", emoji: "🍷" },
];

const PROTEIN_SISTERS: HubLink[] = [
  { id: "whey", name: "Whey", route: "/drinks/protein-shakes/whey", emoji: "🥛" },
  { id: "plant", name: "Plant-Based", route: "/drinks/protein-shakes/plant-based", emoji: "🌱" },
  { id: "casein", name: "Casein", route: "/drinks/protein-shakes/casein", emoji: "🧀" },
  { id: "collagen", name: "Collagen", route: "/drinks/protein-shakes/collagen", emoji: "✨" },
];

export default function CollagenProteinPage() {
  const sisters = PROTEIN_SISTERS.filter((s) => s.id !== "collagen");

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">✨</span>
              <h1 className="text-3xl font-bold text-gray-900">Collagen Protein Shakes</h1>
              <Badge className="bg-orange-100 text-orange-800">Skin/Hair</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/drinks">
                <Button variant="outline">Drinks Hub</Button>
              </Link>
              <Link href="/drinks/protein-shakes">
                <Button variant="outline">Protein Hub</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-hub nav */}
      <div className="max-w-7xl mx-auto px-4 mt-8">
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Explore Other Drink Categories
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {OTHER_DRINK_HUBS.map((hub) => (
                <Link key={hub.id} href={hub.route}>
                  <Button
                    variant="outline"
                    className="w-full justify-start hover:bg-indigo-50 hover:border-indigo-300"
                  >
                    <span className="mr-2">{hub.emoji}</span>
                    {hub.name}
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sisters (no self-link) */}
      <div className="max-w-7xl mx-auto px-4">
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Protein Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {sisters.map((s) => (
                <Link key={s.id} href={s.route}>
                  <Button
                    variant="outline"
                    className="w-full justify-start hover:bg-amber-50 hover:border-amber-300"
                  >
                    <span className="mr-2">{s.emoji}</span>
                    {s.name}
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Minimal content */}
      <div className="max-w-7xl mx-auto px-4 pb-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { id: "g1", title: "Berry Glow", emoji: "🫐" },
        { id: "g2", title: "Citrus Radiance", emoji: "🍊" },
          { id: "g3", title: "Vanilla Glow Latte", emoji: "☕️" },
        ].map((f) => (
          <Card key={f.id} className="hover:shadow-lg transition">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>{f.emoji}</span>
                {f.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <Badge variant="outline">Collagen</Badge>
              <Link href="/drinks">
                <Button variant="outline" size="sm">
                  Explore Drinks
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

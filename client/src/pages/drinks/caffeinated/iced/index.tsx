import React from 'react';
import { Link } from 'wouter';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Droplet } from 'lucide-react';

export default function IcedCoffeeDrinks() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Link href="/drinks/caffeinated">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Caffeinated Drinks
          </Button>
        </Link>
        <div className="text-center py-20">
          <Droplet className="w-24 h-24 mx-auto mb-4 text-blue-600" />
          <h1 className="text-5xl font-bold mb-4">Iced Coffee</h1>
          <p className="text-xl text-gray-600">Refreshing iced coffee drinks - coming soon!</p>
        </div>
      </div>
    </div>
  );
}

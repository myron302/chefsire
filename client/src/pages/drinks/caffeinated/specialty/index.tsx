import React from 'react';
import { Link } from 'wouter';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star } from 'lucide-react';

export default function SpecialtyCoffee() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Link href="/drinks/caffeinated">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Caffeinated Drinks
          </Button>
        </Link>
        <div className="text-center py-20">
          <Star className="w-24 h-24 mx-auto mb-4 text-purple-600" />
          <h1 className="text-5xl font-bold mb-4">Specialty Coffee</h1>
          <p className="text-xl text-gray-600">Unique coffee creations - coming soon!</p>
        </div>
      </div>
    </div>
  );
}

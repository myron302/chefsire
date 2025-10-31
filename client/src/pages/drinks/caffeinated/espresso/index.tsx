import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Coffee, Clock, Heart, Star, ArrowLeft, Zap,
  Sparkles, Flame, Sun, Target
} from 'lucide-react';
import { useDrinks } from '@/contexts/DrinksContext';
import UniversalSearch from '@/components/UniversalSearch';

const espressoDrinks = [
  {
    id: 'classic-espresso',
    name: 'Classic Espresso Shot',
    description: 'Pure, intense coffee flavor in a small shot',
    ingredients: ['1 shot espresso (1 oz)', 'Hot water for Americano variation'],
    benefits: ['Quick energy', 'Mental clarity', 'Focus boost'],
    nutrition: { calories: 3, caffeine: 64, carbs: 0, sugar: 0 },
    difficulty: 'Easy',
    prepTime: '2 min',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400'
  },
  {
    id: 'doppio',
    name: 'Doppio',
    description: 'Double shot of espresso for double the energy',
    ingredients: ['2 shots espresso (2 oz)'],
    benefits: ['High energy', 'Intense flavor', 'Quick caffeine hit'],
    nutrition: { calories: 6, caffeine: 128, carbs: 0, sugar: 0 },
    difficulty: 'Easy',
    prepTime: '2 min',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400'
  },
  {
    id: 'macchiato',
    name: 'Espresso Macchiato',
    description: 'Espresso "marked" with a dollop of foamed milk',
    ingredients: ['1 shot espresso', '1 tbsp foamed milk'],
    benefits: ['Smooth taste', 'Less intense', 'Balanced flavor'],
    nutrition: { calories: 10, caffeine: 64, carbs: 1, sugar: 1 },
    difficulty: 'Medium',
    prepTime: '3 min',
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400'
  },
  {
    id: 'americano',
    name: 'Caffè Americano',
    description: 'Espresso diluted with hot water for a fuller cup',
    ingredients: ['2 shots espresso', '6 oz hot water'],
    benefits: ['Sustained energy', 'Smooth flavor', 'Less intense'],
    nutrition: { calories: 6, caffeine: 128, carbs: 0, sugar: 0 },
    difficulty: 'Easy',
    prepTime: '3 min',
    rating: 4.6,
    image: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400'
  },
  {
    id: 'ristretto',
    name: 'Ristretto',
    description: 'Short shot of espresso for concentrated flavor',
    ingredients: ['1 ristretto shot (0.75 oz espresso)'],
    benefits: ['Intense flavor', 'Less bitter', 'Smooth finish'],
    nutrition: { calories: 2, caffeine: 50, carbs: 0, sugar: 0 },
    difficulty: 'Medium',
    prepTime: '2 min',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400'
  },
  {
    id: 'lungo',
    name: 'Lungo',
    description: 'Long shot of espresso with more water',
    ingredients: ['1 lungo shot (2 oz espresso)'],
    benefits: ['Milder taste', 'More volume', 'Balanced caffeine'],
    nutrition: { calories: 4, caffeine: 80, carbs: 0, sugar: 0 },
    difficulty: 'Easy',
    prepTime: '3 min',
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400'
  }
];

export default function EspressoDrinks() {
  const { addPoints, incrementDrinksMade, addToFavorites, isFavorite, addToRecentlyViewed } = useDrinks();
  const [selectedDrink, setSelectedDrink] = useState(null);

  const handleDrinkSelection = (drink) => {
    setSelectedDrink(drink);
    addToRecentlyViewed(drink);
  };

  const handleMakeDrink = async (drink) => {
    try {
      const response = await fetch('/api/custom-drinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: drink.name,
          category: 'caffeinated',
          drinkType: 'espresso',
          ingredients: drink.ingredients,
          calories: drink.nutrition.calories,
          caffeine: drink.nutrition.caffeine,
          prepTime: parseInt(drink.prepTime),
          rating: drink.rating,
          isPublic: false
        })
      });

      if (response.ok) {
        incrementDrinksMade();
        addPoints(100);
        alert(`${drink.name} added to your drinks!`);
      }
    } catch (error) {
      console.error('Error saving drink:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-brown-600 text-white py-12 px-6 rounded-xl shadow-2xl">
          <Link href="/drinks/caffeinated">
            <Button variant="ghost" className="text-white mb-4 hover:bg-white/20">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Caffeinated Drinks
            </Button>
          </Link>

          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
              <Coffee className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Espresso Drinks</h1>
              <p className="text-xl text-amber-100">Pure, intense coffee in every shot</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4 text-center">
                <Coffee className="h-8 w-8 mx-auto mb-2 text-amber-300" />
                <div className="text-2xl font-bold">{espressoDrinks.length}</div>
                <div className="text-sm text-amber-100">Recipes</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4 text-center">
                <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-300" />
                <div className="text-2xl font-bold">64mg</div>
                <div className="text-sm text-amber-100">Avg Caffeine</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-orange-300" />
                <div className="text-2xl font-bold">2min</div>
                <div className="text-sm text-amber-100">Avg Prep</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4 text-center">
                <Star className="h-8 w-8 mx-auto mb-2 text-yellow-300" />
                <div className="text-2xl font-bold">4.7</div>
                <div className="text-sm text-amber-100">Avg Rating</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Universal Search */}
        <div className="max-w-2xl mx-auto">
          <UniversalSearch
            onSelectDrink={handleDrinkSelection}
            placeholder="Search espresso drinks..."
            className="w-full"
          />
        </div>

        {/* Drinks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {espressoDrinks.map((drink) => (
            <Card key={drink.id} className="overflow-hidden hover:shadow-xl transition-shadow">
              <div className="relative h-48">
                <img
                  src={drink.image}
                  alt={drink.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3">
                  <Badge className="bg-white text-gray-900">
                    <Star className="w-3 h-3 mr-1 text-yellow-400 fill-current" />
                    {drink.rating}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-3 left-3"
                  onClick={() => addToFavorites(drink)}
                >
                  <Heart className={`w-4 h-4 ${isFavorite(drink.id) ? 'fill-red-500 text-red-500' : ''}`} />
                </Button>
              </div>

              <CardContent className="p-4">
                <h3 className="font-bold text-lg mb-2">{drink.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{drink.description}</p>

                <div className="flex items-center gap-4 mb-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {drink.prepTime}
                  </span>
                  <Badge variant="outline">{drink.difficulty}</Badge>
                </div>

                <div className="mb-3">
                  <div className="text-sm font-medium mb-2">Benefits:</div>
                  <div className="flex flex-wrap gap-1">
                    {drink.benefits.map((benefit, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {benefit}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-600">
                      {drink.nutrition.calories}
                    </div>
                    <div className="text-xs text-gray-600">Calories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-amber-600">
                      {drink.nutrition.caffeine}mg
                    </div>
                    <div className="text-xs text-gray-600">Caffeine</div>
                  </div>
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600"
                  onClick={() => handleMakeDrink(drink)}
                >
                  <Coffee className="w-4 h-4 mr-2" />
                  Make This
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { Dog, Bone, Heart, Star, Clock } from 'lucide-react';

const DogFoodRecipes: React.FC = () => {
  const [favorites, setFavorites] = useState<string[]>([]);

  const recipes = [
    // 10 featured dog food recipes with nutrition info
  ];

  return (
    <div>
      <section className="hero" style={{background: 'linear-gradient(to right, #FFB74D, #FF9800)'}}>
        <h1><Dog /> Dog Food Recipes</h1>
      </section>
      <div>
        {/* Age categories and recipes here */}
      </div>
    </div>
  );
};

export default DogFoodRecipes;
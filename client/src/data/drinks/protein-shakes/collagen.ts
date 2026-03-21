type Measured = { amount: number | string; unit: string; item: string; note?: string };
const m = (amount: number | string, unit: string, item: string, note: string = ''): Measured => ({ amount, unit, item, note });

export const collagenShakes = [
  {
    id: 'collagen-1',
    name: 'Beauty Boost Berry',
    description: 'Type I & III collagen for radiant skin and strong nails',
    image: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=400&h=300&fit=crop',
    collagenTypes: ['Type I', 'Type III'],
    source: 'Grass-Fed Bovine',
    flavor: 'Mixed Berry',
    servingSize: '20g',
    nutrition: {
      calories: 70,
      protein: 18,
      carbs: 0,
      fat: 0,
      collagen: 18,
      vitamin_c: 60,
      biotin: 30
    },
    ingredients: ['Hydrolyzed Collagen Peptides', 'Natural Berry Flavors', 'Vitamin C', 'Biotin', 'Hyaluronic Acid'],
    benefits: ['Skin Elasticity', 'Hair Growth', 'Nail Strength', 'Anti-Aging'],
    absorption: 'Fast',
    absorptionTime: '15-30 minutes',
    leucineContent: 1.2,
    bioavailability: 95,
    difficulty: 'Easy',
    prepTime: 1,
    rating: 4.8,
    reviews: 2156,
    trending: true,
    featured: true,
    price: 39.99,
    bestTime: 'Morning',
    primaryBenefit: 'Skin Health',
    ageGroup: 'All Ages',
    certifications: ['Grass-Fed', 'Pasture-Raised', 'Non-GMO'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (20g)', 'hydrolyzed collagen peptides'),
        m(0.75, 'cup', 'unsweetened almond milk'),
        m(0.5, 'cup', 'mixed berries, frozen'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(1, 'tsp', 'vitamin C powder'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Add milk and collagen first, then berries and powders.',
        'Blend until smooth and creamy.'
      ]
    }
  },
  {
    id: 'collagen-2',
    name: 'Joint Support Vanilla',
    description: 'Type II collagen for cartilage and joint mobility',
    collagenTypes: ['Type II'],
    source: 'Chicken Sternum',
    flavor: 'Vanilla Cream',
    servingSize: '15g',
    nutrition: {
      calories: 50,
      protein: 12,
      carbs: 1,
      fat: 0,
      collagen: 12,
      glucosamine: 500,
      chondroitin: 400
    },
    ingredients: ['Type II Collagen', 'Glucosamine Sulfate', 'Chondroitin Sulfate', 'MSM', 'Natural Vanilla'],
    benefits: ['Joint Health', 'Cartilage Support', 'Mobility', 'Flexibility'],
    absorption: 'Moderate',
    absorptionTime: '30-45 minutes',
    leucineContent: 0.8,
    bioavailability: 87,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.6,
    reviews: 1543,
    trending: false,
    featured: true,
    price: 45.99,
    bestTime: 'Post-Workout',
    primaryBenefit: 'Joint Health',
    ageGroup: '30+',
    certifications: ['Free-Range', 'Hormone-Free', 'Antibiotic-Free'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (15g)', 'type II collagen'),
        m(1, 'cup', 'coconut water'),
        m(0.5, 'tsp', 'vanilla extract'),
        m(0.25, 'tsp', 'ground cinnamon'),
        m(1, 'tsp', 'glucosamine powder'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Blend liquids with collagen and supplements first.',
        'Add cinnamon and ice; blend until frothy.'
      ]
    }
  },
  {
    id: 'collagen-3',
    name: 'Marine Glow Tropical',
    description: 'Wild-caught marine collagen for premium absorption',
    collagenTypes: ['Type I'],
    source: 'Wild-Caught Fish',
    flavor: 'Tropical Mango',
    servingSize: '12g',
    nutrition: {
      calories: 45,
      protein: 11,
      carbs: 0,
      fat: 0,
      collagen: 11,
      omega_3: 200,
      selenium: 15
    },
    ingredients: ['Marine Collagen Peptides', 'Mango Extract', 'Omega-3 Fatty Acids', 'Selenium', 'Coconut Water Powder'],
    benefits: ['Premium Absorption', 'Skin Hydration', 'Antioxidants', 'Sustainable'],
    absorption: 'Very Fast',
    absorptionTime: '10-20 minutes',
    leucineContent: 1.1,
    bioavailability: 98,
    difficulty: 'Easy',
    prepTime: 1,
    rating: 4.7,
    reviews: 987,
    trending: true,
    featured: false,
    price: 52.99,
    bestTime: 'Morning',
    primaryBenefit: 'Premium Absorption',
    ageGroup: 'All Ages',
    certifications: ['Wild-Caught', 'MSC Certified', 'Sustainable'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (12g)', 'marine collagen peptides'),
        m(0.75, 'cup', 'pineapple juice'),
        m(0.25, 'cup', 'mango chunks, frozen'),
        m(1, 'tsp', 'coconut water powder'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Combine juice and collagen, then add fruit.',
        'Blend for 30 seconds until tropical and smooth.'
      ]
    }
  },
  {
    id: 'collagen-4',
    name: 'Multi-Collagen Complete',
    description: 'Types I, II, III, V & X for comprehensive support',
    collagenTypes: ['Type I', 'Type II', 'Type III', 'Type V', 'Type X'],
    source: 'Multi-Source Blend',
    flavor: 'Unflavored',
    servingSize: '22g',
    nutrition: {
      calories: 80,
      protein: 20,
      carbs: 0,
      fat: 0,
      collagen: 20,
      glycine: 3.2,
      proline: 2.8
    },
    ingredients: ['Bovine Collagen', 'Chicken Collagen', 'Fish Collagen', 'Eggshell Membrane', 'Bone Broth Powder'],
    benefits: ['Complete Spectrum', 'Versatile Use', 'Maximum Coverage', 'All-in-One'],
    absorption: 'Fast',
    absorptionTime: '20-35 minutes',
    leucineContent: 1.4,
    bioavailability: 92,
    difficulty: 'Easy',
    prepTime: 1,
    rating: 4.5,
    reviews: 1876,
    trending: false,
    featured: true,
    price: 48.99,
    bestTime: 'Anytime',
    primaryBenefit: 'Complete Support',
    ageGroup: 'All Ages',
    certifications: ['Multi-Source', 'Third-Party Tested', 'Quality Assured'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (22g)', 'multi-collagen blend'),
        m(1, 'cup', 'water or milk of choice'),
        m(0.5, 'banana', 'ripe'),
        m(1, 'tsp', 'cacao powder'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Stir collagen into liquid until dissolved.',
        'Add fruit and blend smooth.'
      ]
    }
  },
  {
    id: 'collagen-5',
    name: 'Vegan Collagen Builder',
    description: 'Plant-based collagen support with amino acid precursors',
    collagenTypes: ['Collagen Precursors'],
    source: 'Plant-Based',
    flavor: 'Cucumber Mint',
    servingSize: '25g',
    nutrition: {
      calories: 90,
      protein: 15,
      carbs: 8,
      fat: 0,
      collagen: 0,
      vitamin_c: 80,
      silica: 50,
      lysine: 2.1
    },
    ingredients: ['Pea Protein', 'Vitamin C', 'Silica from Bamboo', 'L-Lysine', 'L-Proline', 'Cucumber Extract'],
    benefits: ['Vegan-Friendly', 'Collagen Support', 'Amino Precursors', 'Plant-Based'],
    absorption: 'Moderate',
    absorptionTime: '45-60 minutes',
    leucineContent: 2.1,
    bioavailability: 78,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.2,
    reviews: 634,
    trending: true,
    featured: false,
    price: 42.99,
    bestTime: 'Morning',
    primaryBenefit: 'Vegan Alternative',
    ageGroup: 'All Ages',
    certifications: ['Vegan', 'Non-GMO', 'Organic', 'Plant-Based'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (25g)', 'vegan collagen builder'),
        m(1, 'cup', 'cucumber water'),
        m(2, 'leaves', 'fresh mint'),
        m(0.5, 'tsp', 'lime juice'),
        m(1, 'tsp', 'vitamin C powder'),
        m(4, 'ice cubes', 'ice')
      ],
      directions: [
        'Infuse water with cucumber and mint.',
        'Add builder and blend with lime and ice.'
      ]
    }
  },
  {
    id: 'collagen-6',
    name: 'Anti-Aging Gold Formula',
    description: 'Premium collagen with peptides and antioxidants',
    collagenTypes: ['Type I', 'Type III'],
    source: 'Grass-Fed Bovine',
    flavor: 'Golden Turmeric',
    servingSize: '25g',
    nutrition: {
      calories: 85,
      protein: 20,
      carbs: 2,
      fat: 0,
      collagen: 20,
      curcumin: 500,
      resveratrol: 100
    },
    ingredients: ['Hydrolyzed Collagen', 'Turmeric Extract', 'Resveratrol', 'CoQ10', 'Gold Leaf Extract'],
    benefits: ['Anti-Inflammatory', 'Antioxidant Rich', 'Premium Quality', 'Luxury Formula'],
    absorption: 'Fast',
    absorptionTime: '15-25 minutes',
    leucineContent: 1.3,
    bioavailability: 96,
    difficulty: 'Easy',
    prepTime: 2,
    rating: 4.9,
    reviews: 543,
    trending: false,
    featured: true,
    price: 79.99,
    bestTime: 'Evening',
    primaryBenefit: 'Anti-Aging',
    ageGroup: '35+',
    certifications: ['Premium Grade', 'Lab Tested', 'Luxury'],
    recipe: {
      servings: 1,
      measurements: [
        m(1, 'scoop (25g)', 'anti-aging collagen'),
        m(0.75, 'cup', 'warm almond milk'),
        m(0.25, 'tsp', 'ground turmeric'),
        m(0.125, 'tsp', 'black pepper'),
        m(1, 'tsp', 'honey'),
        m(1, 'pinch', 'resveratrol powder')
      ],
      directions: [
        'Warm milk gently, stir in collagen and spices.',
        'Blend briefly for golden latte texture.'
      ]
    }
  }
];

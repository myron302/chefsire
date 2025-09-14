import * as React from “react”;
import { Button } from “@/components/ui/button”;
import { Badge } from “@/components/ui/badge”;
import { Card } from “@/components/ui/card”;
import { LayoutGrid, List, Heart, MessageCircle } from “lucide-react”;
import RecipeCard from “@/components/recipe-card”; // reuses your upgraded RecipeCard

type Post = {
id: string | number;
title?: string;
caption?: string;
image?: string | null;
imageUrl?: string | null;
cuisine?: string;
isRecipe?: boolean;
author?: string;
user?: { displayName?: string; avatar?: string };
cookTime?: number;
rating?: number; // 0..5
likes?: number;
comments?: number;
difficulty?: “Easy” | “Medium” | “Hard”;
mealType?: string;
dietary?: string[];
createdAt?: string;
recipe?: {
title: string;
cookTime?: number;
servings?: number;
difficulty?: “Easy” | “Medium” | “Hard”;
cuisine?: string;
ingredients: string[];
instructions: string[];
ratingSpoons?: number;
dietTags?: string[];
allergens?: string[];
};
};

const DEMO: Post[] = [
{
id: “1”,
title: “Margherita Pizza”,
image: “https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=800&h=800&fit=crop&auto=format”,
cuisine: “Italian”,
isRecipe: true,
author: “Giulia”,
cookTime: 25,
difficulty: “Easy”,
rating: 4.7,
likes: 223,
comments: 18,
mealType: “Dinner”,
dietary: [“Vegetarian”],
createdAt: “2025-09-08T12:00:00Z”,
user: { displayName: “Giulia” },
recipe: {
title: “Margherita Pizza”,
cookTime: 25,
servings: 2,
difficulty: “Easy”,
cuisine: “Italian”,
ingredients: [“Pizza dough”,“Tomato sauce”,“Mozzarella”,“Basil”,“Olive oil”,“Salt”],
instructions: [
“Preheat oven to 500°F / 260°C.”,
“Stretch dough, add sauce and mozzarella.”,
“Bake 7–10 min. Finish with basil and oil.”,
],
ratingSpoons: 4.7,
dietTags: [“Vegetarian”],
allergens: [“Gluten”,“Dairy”],
},
},
{
id: “2”,
title: “Rainbow Salad”,
image: “https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&h=800&fit=crop&auto=format”,
isRecipe: true,
author: “Ava”,
cookTime: 10,
difficulty: “Easy”,
rating: 4.2,
likes: 150,
comments: 9,
mealType: “Lunch”,
dietary: [“Vegan”,“Gluten-Free”],
createdAt: “2025-09-07T10:00:00Z”,
user: { displayName: “Ava” },
recipe: {
title: “Rainbow Salad”,
cookTime: 10,
servings: 2,
difficulty: “Easy”,
cuisine: “Healthy”,
ingredients: [“Lettuce”,“Cherry tomatoes”,“Cucumber”,“Bell pepper”,“Corn”,“Olive oil”,“Lemon”],
instructions: [“Chop veggies.”,“Whisk oil and lemon.”,“Toss and season.”],
ratingSpoons: 4.2,
dietTags: [“Vegan”,“Gluten-Free”],
allergens: [],
},
},
{
id: “3”,
title: “Street Food Reel”,
image: “https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=800&fit=crop&crop=center&auto=format&q=75”,
isRecipe: false,
author: “Diego”,
likes: 412,
comments: 34,
createdAt: “2025-09-06T15:22:00Z”,
user: { displayName: “Diego” },
},
{
id: “4”,
title: “Choco Truffles”,
image: “https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&h=800&fit=crop&auto=format”,
isRecipe: true,
author: “Noah”,
cookTime: 45,
difficulty: “Medium”,
rating: 4.9,
likes: 512,
comments: 61,
mealType: “Dessert”,
dietary: [“Vegetarian”],
createdAt: “2025-09-05T18:30:00Z”,
user: { displayName: “Noah” },
recipe: {
title: “Choco Truffles”,
cookTime: 45,
servings: 6,
difficulty: “Medium”,
cuisine: “Desserts”,
ingredients: [“Dark chocolate”,“Cream”,“Butter”,“Cocoa powder”,“Salt”],
instructions: [“Heat cream, pour over chocolate.”,“Stir, chill, scoop balls.”,“Roll in cocoa.”],
ratingSpoons: 4.9,
dietTags: [“Vegetarian”],
allergens: [“Dairy”],
},
},
{
id: “5”,
title: “BBQ Brisket”,
image: “https://images.unsplash.com/photo-1558030006-450675393462?w=800&h=800&fit=crop&crop=center&auto=format&q=75”,
isRecipe: false,
author: “Mason”,
likes: 98,
comments: 12,
createdAt: “2025-09-09T14:45:00Z”,
user: { displayName: “Mason” },
},
{
id: “6”,
title: “Avocado Toast”,
image: “https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=800&fit=crop&auto=format”,
isRecipe: true,
author: “Ivy”,
cookTime: 8,
difficulty: “Easy”,
rating: 4.0,
likes: 77,
comments: 4,
mealType: “Breakfast”,
dietary: [“Vegetarian”],
createdAt: “2025-09-10T08:05:00Z”,
user: { displayName: “Ivy” },
recipe: {
title: “Avocado Toast”,
cookTime: 8,
servings: 1,
difficulty: “Easy”,
cuisine: “Breakfast”,
ingredients: [“Bread”,“Avocado”,“Lemon”,“Chili flakes”,“Salt”,“Olive oil”],
instructions: [“Toast bread”,“Mash avocado with lemon”,“Assemble and season”],
ratingSpoons: 4.0,
dietTags: [“Vegetarian”],
allergens: [“Gluten”],
},
},
];

// Simple image tile card for non-recipe posts
function ExploreTile({ post }: { post: Post }) {
const imageUrl = post.image || post.imageUrl || “”;

return (
<div className="relative w-full bg-white border rounded-lg shadow-sm overflow-hidden group">
{/* Image container with fixed dimensions */}
<div
className=“w-full h-48 bg-gray-200 relative overflow-hidden”
style={{ aspectRatio: ‘1/1’ }}
>
{imageUrl ? (
<img
src={imageUrl}
alt={post.title || “post”}
className=“absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300”
onError={(e) => {
console.log(‘Image failed to load:’, imageUrl);
e.currentTarget.style.display = ‘none’;
}}
onLoad={() => console.log(‘Image loaded:’, imageUrl)}
/>
) : (
<div className="absolute inset-0 flex items-center justify-center text-gray-400">
No Image
</div>
)}

```
    {/* Dark overlay on hover */}
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
    
    {/* Stats overlay */}
    <div className="absolute bottom-2 left-2 flex gap-3 text-white">
      <span className="inline-flex items-center gap-1 text-sm bg-black/50 px-2 py-1 rounded">
        <Heart className="h-4 w-4 fill-current" /> {post.likes ?? 0}
      </span>
      <span className="inline-flex items-center gap-1 text-sm bg-black/50 px-2 py-1 rounded">
        <MessageCircle className="h-4 w-4" /> {post.comments ?? 0}
      </span>
    </div>
    
    {/* Title overlay */}
    {post.title && (
      <div className="absolute top-2 left-2 right-2">
        <div className="bg-black/70 backdrop-blur-sm rounded px-2 py-1">
          <p className="text-white text-sm font-medium truncate">{post.title}</p>
        </div>
      </div>
    )}
  </div>
</div>
```

);
}

// Wrapper component for RecipeCard in grid view to constrain its size
function GridRecipeCard({ post }: { post: Post }) {
return (
<div className="w-full overflow-hidden">
<div className="transform scale-75 origin-top-left w-[133.33%]">
<RecipeCard post={post as any} />
</div>
</div>
);
}
const imageUrl = post.image || post.imageUrl || “”;

return (
<div className="relative w-full bg-white border rounded-lg shadow-sm overflow-hidden group">
{/* Image container with fixed dimensions */}
<div
className=“w-full h-48 bg-gray-200 relative overflow-hidden”
style={{ aspectRatio: ‘1/1’ }}
>
{imageUrl ? (
<img
src={imageUrl}
alt={post.title || “post”}
className=“absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300”
onError={(e) => {
console.log(‘Image failed to load:’, imageUrl);
e.currentTarget.style.display = ‘none’;
}}
onLoad={() => console.log(‘Image loaded:’, imageUrl)}
/>
) : (
<div className="absolute inset-0 flex items-center justify-center text-gray-400">
No Image
</div>
)}

```
    {/* Dark overlay on hover */}
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
    
    {/* Stats overlay */}
    <div className="absolute bottom-2 left-2 flex gap-3 text-white">
      <span className="inline-flex items-center gap-1 text-sm bg-black/50 px-2 py-1 rounded">
        <Heart className="h-4 w-4 fill-current" /> {post.likes ?? 0}
      </span>
      <span className="inline-flex items-center gap-1 text-sm bg-black/50 px-2 py-1 rounded">
        <MessageCircle className="h-4 w-4" /> {post.comments ?? 0}
      </span>
    </div>
    
    {/* Title overlay */}
    {post.title && (
      <div className="absolute top-2 left-2 right-2">
        <div className="bg-black/70 backdrop-blur-sm rounded px-2 py-1">
          <p className="text-white text-sm font-medium truncate">{post.title}</p>
        </div>
      </div>
    )}
  </div>
</div>
```

);
}

export default function ExplorePage() {
const [view, setView] = React.useState<“grid” | “list”>(“grid”);

// TODO: later swap DEMO with your personalized algorithm feed via react-query.
const feed = React.useMemo(() => DEMO, []);

return (
<div className="mx-auto max-w-6xl px-4 md:px-6 py-4 space-y-4">
{/* Header */}
<div className="flex items-center justify-between">
<h1 className="text-2xl font-bold">Explore</h1>
<div className="flex gap-2">
<Button
variant={view === “grid” ? “default” : “outline”}
onClick={() => setView(“grid”)}
className=“gap-2”
>
<LayoutGrid className="h-4 w-4" />
Grid
</Button>
<Button
variant={view === “list” ? “default” : “outline”}
onClick={() => setView(“list”)}
className=“gap-2”
>
<List className="h-4 w-4" />
List
</Button>
</div>
</div>

```
  {/* Results */}
  {feed.length === 0 ? (
    <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
      <p className="text-sm text-muted-foreground">No posts… yet.</p>
    </div>
  ) : view === "grid" ? (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {feed.map((p) =>
        p.isRecipe ? (
          <GridRecipeCard key={p.id} post={p} />
        ) : (
          <ExploreTile key={p.id} post={p} />
        )
      )}
    </div>
  ) : (
    <div className="space-y-3">
      {feed.map((p) => (
        <div key={p.id}>
          {p.isRecipe ? (
            <RecipeCard post={p as any} />
          ) : (
            <ExploreTile post={p} />
          )}
        </div>
      ))}
    </div>
  )}

  {/* Note: No filters here. We'll plug in the algorithm later. */}
</div>
```

);
}

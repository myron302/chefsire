import { 
  Home, 
  Compass, 
  BookOpen, 
  User, 
  Plus,
  ChefHat,
  Shuffle,
  ShoppingCart,
  Activity,
  ChevronRight,
  Utensils, // Catering icon
  GlassWater // 👈 icon for Potent Potables (you can swap this if you prefer another)
} from "lucide-react";
import { Link } from "wouter";

const navigation = [
  { name: "Feed", href: "/feed", icon: Home },
  { name: "Explore", href: "/explore", icon: Compass },
  { 
    name: "Recipes", 
    href: "/recipes", 
    icon: BookOpen,
    hasSubmenu: true,
    submenu: [
      { name: "Browse Recipes", href: "/recipes", icon: BookOpen },
      { name: "My Pantry", href: "/pantry", icon: ChefHat },
      { name: "Substitutions", href: "/substitutions", icon: Shuffle },
    ]
  },
  { name: "Potent Potables", href: "/potent-potables", icon: GlassWater }, // 👈 Added new link
  { name: "Catering", href: "/catering", icon: Utensils },
  { name: "Marketplace", href: "/marketplace", icon: ShoppingCart },
  { name: "Nutrition", href: "/nutrition", icon: Activity, isPremium: true },
  { name: "Profile", href: "/profile", icon: User },
];

export default function Sidebar({ onCreatePost }) {
  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-card border-r border-border fixed">
      <nav className="flex-1 py-6 px-4 space-y-2">
        {navigation.map(item =>
          item.hasSubmenu ? (
            <div key={item.name}>
              <div className="flex items-center mb-1">
                <item.icon className="w-5 h-5 mr-2" />
                <span className="font-bold">{item.name}</span>
                <ChevronRight className="w-4 h-4 ml-auto" />
              </div>
              <div className="ml-6 space-y-1">
                {item.submenu.map(sub =>
                  <Link key={sub.name} href={sub.href}>
                    <div className="flex items-center py-1 hover:bg-muted rounded px-2 cursor-pointer">
                      <sub.icon className="w-4 h-4 mr-2" />
                      <span>{sub.name}</span>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <Link key={item.name} href={item.href}>
              <div className="flex items-center py-2 hover:bg-muted rounded px-2 cursor-pointer">
                <item.icon className="w-5 h-5 mr-2" />
                <span>{item.name}</span>
                {item.isPremium && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-300 text-xs rounded">Premium</span>
                )}
              </div>
            </Link>
          )
        )}
        <button
          onClick={onCreatePost}
          className="mt-8 flex items-center py-2 px-2 bg-primary text-white rounded hover:bg-primary/80 font-semibold"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Post
        </button>
      </nav>
    </aside>
  );
}

import { 
  Home, 
  Compass, 
  BookOpen, 
  User, 
  Plus,
  Bookmark,
  Users,
  Settings,
  ChefHat,
  Shuffle,
  ShoppingCart,
  Activity,
  ChevronDown,
  ChevronRight,
  Zap,
  Utensils // Add this import for catering icon
} from "lucide-react";

// Navigation array
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
  { name: "Catering", href: "/catering", icon: Utensils }, // Catering link
  { name: "Marketplace", href: "/marketplace", icon: ShoppingCart },
  { name: "Nutrition", href: "/nutrition", icon: Activity, isPremium: true },
  { name: "Profile", href: "/profile", icon: User },
];

export default navigation;

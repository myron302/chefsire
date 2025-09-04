import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, Compass, Plus, User, Utensils } from "lucide-react"; // Add Utensils import
import { cn } from "@/lib/utils";

interface MobileNavProps {
  onCreatePost: () => void;
}

export default function MobileNav({ onCreatePost }: MobileNavProps) {
  const [location] = useLocation();
  
  const navigation = [
    { name: "Feed", href: "/feed", icon: Home },
    { name: "Explore", href: "/explore", icon: Compass },
    { name: "Create", action: onCreatePost, icon: Plus },
    { name: "Catering", href: "/catering", icon: Utensils }, // Add this line
    { name: "Profile", href: "/profile", icon: User },
  ];
  
  // ... rest of the component stays the same
}

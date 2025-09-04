import { useState, useEffect } from "react";
import { 
  Search, 
  Bell, 
  MessageCircle, 
  Home, 
  Compass, 
  BookOpen, 
  User, 
  Plus,
  Bookmark,
  Users,
  Settings,
  ChevronDown,
  LogOut,
  Activity,
  Shuffle,
  ShoppingCart,
  ChefHat,
  Menu,
  X
} from "lucide-react";

// Inline UI Components (replacing shadcn imports)
const Input = ({ className = "", ...props }) => (
  <input
    className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:ring-offset-gray-950 dark:placeholder:text-gray-400 dark:focus-visible:ring-gray-300 ${className}`}
    {...props}
  />
);

const Button = ({ variant = "default", size = "default", className = "", children, ...props }) => {
  const variants = {
    default: "bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200",
    ghost: "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-50",
  };
  
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
  };
  
  return (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-gray-950 dark:focus-visible:ring-gray-300 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Avatar = ({ className = "", children }) => (
  <div className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className}`}>
    {children}
  </div>
);

const AvatarImage = ({ src, alt = "" }) => (
  <img className="aspect-square h-full w-full object-cover" src={src} alt={alt} />
);

const AvatarFallback = ({ children }) => (
  <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
    {children}
  </div>
);

// Simple Link component replacement
const Link = ({ href, children, onClick }) => (
  <a href={href} onClick={(e) => { e.preventDefault(); onClick && onClick(); }}>
    {children}
  </a>
);

// Logo as inline SVG (since we can't import external images)
const ChefLogo = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <circle cx="50" cy="50" r="45" fill="#ff6b35"/>
    <path d="M50 25 C30 25 25 35 25 45 C25 65 35 75 50 75 C65 75 75 65 75 45 C75 35 70 25 50 25 Z" fill="white"/>
    <circle cx="40" cy="45" r="3" fill="#ff6b35"/>
    <circle cx="60" cy="45" r="3" fill="#ff6b35"/>
    <path d="M40 58 Q50 65 60 58" stroke="#ff6b35" strokeWidth="2" fill="none"/>
  </svg>
);

// Sidebar Component
const Sidebar = ({ onCreatePost }) => {
  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Compass, label: "Explore", href: "/explore" },
    { icon: BookOpen, label: "Recipes", href: "/recipes" },
    { icon: Bookmark, label: "Saved", href: "/saved" },
    { icon: Users, label: "Community", href: "/community" },
    { icon: User, label: "Profile", href: "/profile" },
  ];

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4">
      <nav className="space-y-2">
        {navItems.map((item) => (
          <Link key={item.label} href={item.href}>
            <div className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
              <item.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</span>
            </div>
          </Link>
        ))}
      </nav>
      <div className="mt-4">
        <Button 
          onClick={onCreatePost}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Post
        </Button>
      </div>
    </aside>
  );
};

// Mobile Navigation Component
const MobileNav = ({ onCreatePost }) => {
  const navItems = [
    { icon: Home, label: "Home" },
    { icon: Compass, label: "Explore" },
    { icon: Plus, label: "Create", isCreate: true },
    { icon: Bookmark, label: "Saved" },
    { icon: User, label: "Profile" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={item.isCreate ? onCreatePost : undefined}
            className={`p-3 rounded-lg transition-colors ${
              item.isCreate 
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </div>
    </nav>
  );
};

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Load Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const handleCreatePost = () => {
    alert('Create post functionality - implement your create post logic here');
    setIsCreateModalOpen(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Logo */}
            <Link href="/" onClick={() => {}}>
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full overflow-hidden shadow-lg flex items-center justify-center bg-white">
                  <ChefLogo />
                </div>
                <h1 
                  className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent"
                  style={{ 
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700,
                    letterSpacing: '-0.5px'
                  }}
                >
                  ChefSire
                </h1>
              </div>
            </Link>
            
            {/* Search Bar */}
            <div className="hidden md:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search recipes, chefs, or ingredients..."
                  className="w-full pl-10 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-full"
                />
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
              >
                <Bell className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
              >
                <MessageCircle className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </Button>
              
              {/* User Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full p-1 transition-colors"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src="https://images.unsplash.com/photo-1566554273541-37a9ca77b91f" />
                    <AvatarFallback>CA</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
                
                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <>
                    {/* Backdrop to close dropdown */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                      {/* Chef's Corner Section */}
                      <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-b-2 border-orange-200 dark:border-orange-800 px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 bg-white rounded-full overflow-hidden shadow-md flex-shrink-0">
                            <ChefLogo />
                          </div>
                          <div>
                            <span 
                              className="font-bold text-orange-900 dark:text-orange-100 text-base"
                              style={{ fontFamily: "'Playfair Display', serif" }}
                            >
                              Chef's Corner
                            </span>
                            <div className="text-xs text-orange-700 dark:text-orange-300">
                              Your culinary kingdom awaits
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Navigation Links */}
                      <div className="py-2">
                        <Link href="/profile" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                            <User className="w-5 h-5 mr-3 text-gray-600 dark:text-gray-400" />
                            My Profile
                          </div>
                        </Link>
                        
                        {/* Recipe Tools Submenu */}
                        <div className="px-4 py-2">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Recipe Tools
                          </div>
                          <div className="space-y-1 ml-2">
                            <Link href="/pantry" onClick={() => setIsDropdownOpen(false)}>
                              <div className="flex items-center px-2 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
                                <ChefHat className="w-4 h-4 mr-3 text-gray-600 dark:text-gray-400" />
                                My Pantry
                              </div>
                            </Link>
                            
                            <Link href="/substitutions" onClick={() => setIsDropdownOpen(false)}>
                              <div className="flex items-center px-2 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
                                <Shuffle className="w-4 h-4 mr-3 text-gray-600 dark:text-gray-400" />
                                Ingredient Substitutions
                              </div>
                            </Link>
                          </div>
                        </div>
                        
                        <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                        
                        <Link href="/nutrition" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                            <Activity className="w-5 h-5 mr-3 text-gray-600 dark:text-gray-400" />
                            <div>
                              <div>Nutrition & Meal Plans</div>
                              <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">Premium</div>
                            </div>
                          </div>
                        </Link>
                        
                        <Link href="/marketplace" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                            <ShoppingCart className="w-5 h-5 mr-3 text-gray-600 dark:text-gray-400" />
                            Marketplace
                          </div>
                        </Link>
                        
                        <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                        
                        <Link href="/settings" onClick={() => setIsDropdownOpen(false)}>
                          <div className="flex items-center px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                            <Settings className="w-5 h-5 mr-3 text-gray-600 dark:text-gray-400" />
                            Settings
                          </div>
                        </Link>
                        
                        <button 
                          onClick={() => {
                            setIsDropdownOpen(false);
                            console.log('Logging out...');
                          }}
                          className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-left transition-colors"
                        >
                          <LogOut className="w-5 h-5 mr-3" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <Sidebar onCreatePost={handleCreatePost} />
        
        {/* Main Content */}
        <main className="flex-1 lg:ml-64 pb-16 lg:pb-0 p-4">
          {/* Demo Content */}
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Welcome to ChefSire</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Your culinary social platform</p>
            
            {/* Sample content cards */}
            <div className="grid gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-2">Featured Recipe</h3>
                <p className="text-gray-600 dark:text-gray-400">Discover amazing recipes from talented chefs</p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-2">Community Posts</h3>
                <p className="text-gray-600 dark:text-gray-400">See what's cooking in your community</p>
              </div>
            </div>
          </div>
          
          {/* Children would be rendered here in actual implementation */}
          {children}
        </main>
      </div>
      
      {/* Mobile Navigation */}
      <MobileNav onCreatePost={handleCreatePost} />
    </div>
  );
}

export default BitesRow;

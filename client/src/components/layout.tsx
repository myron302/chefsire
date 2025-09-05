{/* User Dropdown */}
<div 
  className="relative"
  onMouseLeave={() => setIsDropdownOpen(false)} // auto-close when mouse leaves (desktop)
>
  <button 
    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
    className="flex items-center space-x-2 hover:bg-muted rounded-full p-1 transition-colors"
  >
    <Avatar className="w-8 h-8">
      <AvatarImage src="https://images.unsplash.com/photo-1566554273541-37a9ca77b91f" />
      <AvatarFallback>CA</AvatarFallback>
    </Avatar>
    <ChevronDown className="w-4 h-4 text-muted-foreground" />
  </button>
  
  {/* Dropdown Menu */}
  {isDropdownOpen && (
    <>
      {/* Backdrop to close dropdown (mobile & desktop click outside) */}
      <div 
        className="fixed inset-0 z-10" 
        onClick={() => setIsDropdownOpen(false)}
      />

      <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
        {/* Chef's Corner Section */}
        <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-b-2 border-orange-200 dark:border-orange-800 px-4 py-3">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md">
              <img 
                src={chefLogo} 
                alt="ChefSire Logo" 
                className="object-cover w-full h-full"
                style={{ width: '100%', height: '100%', borderRadius: '50%' }}
              />
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

          {/* Recipe Tools */}
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

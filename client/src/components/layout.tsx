{/* User Dropdown */}
<div 
  className="relative"
  onMouseLeave={() => setIsDropdownOpen(false)} 
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

      <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-gray-200 dark:border-gray-700 z-20 o

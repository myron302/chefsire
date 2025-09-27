import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, X, Filter, Star, Heart, Clock, TrendingUp,
  Zap, Leaf, Dumbbell, Droplets, Coffee, ArrowRight
} from 'lucide-react';
import { useDrinks } from '../contexts/DrinksContext';

interface UniversalSearchProps {
  onSelectDrink?: (drink: any) => void;
  placeholder?: string;
  showFilters?: boolean;
  className?: string;
}

export default function UniversalSearch({ 
  onSelectDrink, 
  placeholder = "Search all drinks...", 
  showFilters = true,
  className = ""
}: UniversalSearchProps) {
  const { 
    searchQuery, 
    setSearchQuery, 
    searchResults, 
    isSearching, 
    addToFavorites,
    isFavorite,
    getTrendingDrinks,
    addToRecentlyViewed,
    userProgress
  } = useDrinks();

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  const trendingDrinks = getTrendingDrinks();

  const categoryIcons = {
    'smoothies': Leaf,
    'protein-shakes': Dumbbell,
    'detoxes': Droplets,
    'potent-potables': Coffee
  };

  const categoryColors = {
    'smoothies': 'bg-green-100 text-green-800',
    'protein-shakes': 'bg-blue-100 text-blue-800',
    'detoxes': 'bg-purple-100 text-purple-800',
    'potent-potables': 'bg-orange-100 text-orange-800'
  };

  const filterOptions = [
    { id: 'featured', label: 'Featured', icon: Star },
    { id: 'trending', label: 'Trending', icon: TrendingUp },
    { id: 'quick', label: 'Quick (< 5 min)', icon: Clock },
    { id: 'high-protein', label: 'High Protein', icon: Zap },
  ];

  useEffect(() => {
    setShowResults(searchQuery.length > 0 || isExpanded);
  }, [searchQuery, isExpanded]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 0) {
      setIsExpanded(true);
    }
  };

  const handleSelectDrink = (drink: any) => {
    addToRecentlyViewed(drink);
    if (onSelectDrink) {
      onSelectDrink(drink);
    }
    setIsExpanded(false);
    setSearchQuery('');
  };

  const handleToggleFilter = (filterId: string) => {
    setActiveFilters(prev => 
      prev.includes(filterId) 
        ? prev.filter(id => id !== filterId)
        : [...prev, filterId]
    );
  };

  const getFilteredResults = () => {
    let results = searchResults;

    if (activeFilters.includes('featured')) {
      results = results.filter(drink => drink.featured);
    }
    if (activeFilters.includes('trending')) {
      results = results.filter(drink => drink.trending);
    }
    if (activeFilters.includes('quick')) {
      results = results.filter(drink => (drink.prepTime || 0) < 5);
    }
    if (activeFilters.includes('high-protein')) {
      results = results.filter(drink => (drink.nutrition?.protein || 0) > 20);
    }

    return results;
  };

  const filteredResults = getFilteredResults();
  const displayResults = searchQuery.length > 0 ? filteredResults : trendingDrinks.slice(0, 6);

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          className="pl-10 pr-10 bg-white border-2 border-gray-200 focus:border-blue-500 transition-colors"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setIsExpanded(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search Results Overlay */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {/* Quick Stats */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-600">
                  {searchQuery ? `${filteredResults.length} results` : 'Trending now'}
                </span>
                <div className="flex items-center gap-1 text-blue-600">
                  <Star className="h-3 w-3" />
                  <span>Level {userProgress.level}</span>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <Zap className="h-3 w-3" />
                  <span>{userProgress.totalPoints} pts</span>
                </div>
              </div>
              {showFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-gray-500"
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Filters
                </Button>
              )}
            </div>

            {/* Filter Pills */}
            {showFilters && isExpanded && (
              <div className="flex flex-wrap gap-2 mt-3">
                {filterOptions.map(filter => {
                  const Icon = filter.icon;
                  const isActive = activeFilters.includes(filter.id);
                  return (
                    <Button
                      key={filter.id}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleFilter(filter.id)}
                      className={`h-7 text-xs ${isActive ? 'bg-blue-600 text-white' : ''}`}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {filter.label}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Results */}
          <div className="p-2">
            {isSearching ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                Searching all drinks...
              </div>
            ) : displayResults.length > 0 ? (
              <div className="space-y-2">
                {displayResults.map(drink => {
                  const CategoryIcon = categoryIcons[drink.category as keyof typeof categoryIcons];
                  return (
                    <Card 
                      key={drink.id} 
                      className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500"
                      onClick={() => handleSelectDrink(drink)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CategoryIcon className="h-4 w-4 text-gray-500" />
                              <span className="font-medium text-gray-900">{drink.name}</span>
                              {drink.featured && (
                                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                              )}
                              {drink.trending && (
                                <TrendingUp className="h-3 w-3 text-red-500" />
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2 line-clamp-1">
                              {drink.description}
                            </p>
                            
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={categoryColors[drink.category as keyof typeof categoryColors]}>
                                {drink.category.replace('-', ' ')}
                              </Badge>
                              {drink.nutrition && (
                                <Badge variant="outline" className="text-xs">
                                  {drink.nutrition.calories} cal
                                </Badge>
                              )}
                              {drink.prepTime && (
                                <Badge variant="outline" className="text-xs">
                                  {drink.prepTime} min
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                {drink.rating && (
                                  <span className="flex items-center gap-1">
                                    <Star className="h-3 w-3 text-yellow-400 fill-current" />
                                    {drink.rating}
                                  </span>
                                )}
                                {drink.reviews && (
                                  <span>{drink.reviews} reviews</span>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToFavorites(drink);
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <Heart 
                                    className={`h-3 w-3 ${isFavorite(drink.id) ? 'text-red-500 fill-current' : 'text-gray-400'}`} 
                                  />
                                </Button>
                                <ArrowRight className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No drinks found matching your search.</p>
                <p className="text-sm mt-1">Try different keywords or clear filters.</p>
              </div>
            )}
          </div>

          {/* Quick Actions Footer */}
          <div className="border-t bg-gray-50 p-3">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Press Enter to search • ESC to close</span>
              <span>{userProgress.totalDrinksMade} drinks made</span>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {showResults && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setIsExpanded(false);
            setSearchQuery('');
          }}
        />
      )}
    </div>
  );
}

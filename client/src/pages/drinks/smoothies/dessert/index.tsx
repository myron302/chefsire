{activeTab === 'browse' && (
          <div>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search dessert smoothies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedDessertType}
                  onChange={(e) => setSelectedDessertType(e.target.value)}
                >
                  <option value="">All Dessert Types</option>
                  <option value="Chocolate">Chocolate</option>
                  <option value="Cheesecake">Cheesecake</option>
                  <option value="Ice Cream">Ice Cream</option>
                  <option value="Cake">Cake</option>
                  <option value="Coffee">Coffee</option>
                </select>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="Chocolate">Chocolate</option>
                  <option value="Fruity">Fruity</option>
                  <option value="Classic">Classic</option>
                  <option value="Cool">Cool Treats</option>
                </select>
                
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white min-w-[120px]">
                  <span>Max Cal:</span>
                  <Slider
                    value={maxCalories}
                    onValueChange={setMaxCalories}
                    max={450}
                    min={200}
                    step={25}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-500">{maxCalories[0]}</span>
                </div>
                
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                  <input
                    type="checkbox"
                    checked={onlyNaturalSweetener}
                    onChange={(e) => setOnlyNaturalSweetener(e.target.checked)}
                    className="rounded"
                  />
                  Natural Only
                </label>
                
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="rating">Sort by Rating</option>
                  <option value="protein">Sort by Protein</option>
                  <option value="cost">Sort by Cost</option>
                  <option value="calories">Sort by Calories</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSmoothies.map(smoothie => (
                <Card key={smoothie.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{smoothie.name}</CardTitle>
                        <p className="text-sm text-gray-600 mb-2">{smoothie.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addToFavorites({
                          id: smoothie.id,
                          name: smoothie.name,
                          category: 'smoothies',
                          description: smoothie.description,
                          ingredients: smoothie.ingredients,
                          nutrition: smoothie.nutrition,
                          difficulty: smoothie.difficulty,
                          prepTime: smoothie.prepTime,
                          rating: smoothie.rating,
                          bestTime: smoothie.bestTime
                        })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Heart className={`h-4 w-4 ${isFavorite(smoothie.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-pink-100 text-pink-800">{smoothie.dessertType}</Badge>
                      <Badge variant="outline">{smoothie.flavorProfile}</Badge>
                      <Badge className="bg-green-100 text-green-800">{smoothie.guiltFactor} Guilt</Badge>
                      {smoothie.trending && <Badge className="bg-red-100 text-red-800">Trending</Badge>}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                      <div>
                        <div className="text-xl font-bold text-pink-600">{smoothie.nutrition.calories}</div>
                        <div className="text-gray-500">Cal</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-600">{smoothie.nutrition.protein}g</div>
                        <div className="text-gray-500">Protein</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-green-600">{smoothie.nutrition.fiber}g</div>
                        <div className="text-gray-500">Fiber</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-amber-600">${smoothie.estimatedCost}</div>
                        <div className="text-gray-500">Cost</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Healthy Swaps:</h4>
                      <div className="flex flex-wrap gap-1">
                        {smoothie.healthySwaps.slice(0, 3).map((swap, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {swap}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Time:</span>
                        <span className="font-medium">{smoothie.bestTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Added Sugar:</span>
                        <span className="font-medium text-green-600">{smoothie.nutrition.added_sugar}g</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{smoothie.rating}</span>
                        <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {smoothie.difficulty}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-pink-600 hover:bg-pink-700"
                        onClick={() => handleMakeSmoothie(smoothie)}
                      >
                        <ChefHat className="h-4 w-4 mr-2" />
                        Make Dessert
                      </Button>
                      <Button variant="outline" size="sm">
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Dessert Types Tab */}
        {activeTab === 'dessert-types' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dessertTypes.map(type => {
              const Icon = type.icon;
              const typeSmoothies = dessertSmoothies.filter(smoothie => 
                smoothie.category.toLowerCase().includes(type.name.toLowerCase()) ||
                smoothie.dessertType.toLowerCase().includes(type.name.toLowerCase())
              );
              
              return (
                <Card key={type.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${type.color}`} />
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="text-center bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Key Benefit</div>
                        <div className="text-lg font-bold text-pink-600">{type.keyBenefit}</div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Healthy Ingredients:</h4>
                        <div className="flex flex-wrap gap-1">
                          {type.healthyIngredients.map((ingredient, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {ingredient}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Popular Flavors:</h4>
                        <div className="flex flex-wrap gap-1">
                          {type.popularFlavors.map((flavor, index) => (
                            <Badge key={index} className="bg-pink-100 text-pink-800 text-xs">
                              {flavor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-blue-50 p-2 rounded text-center">
                          <div className="text-xs text-gray-600">Avg Calories</div>
                          <div className="font-semibold text-blue-600">{type.avgCalories}</div>
                        </div>
                        <div className="bg-green-50 p-2 rounded text-center">
                          <div className="text-xs text-gray-600">Guilt Level</div>
                          <div className="font-semibold text-green-600">{type.guiltLevel}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${type.color} mb-1`}>
                        {typeSmoothies.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setSelectedDessertType(type.name.split(' ')[0]);
                          setActiveTab('browse');
                        }}
                      >
                        Explore {type.name}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
{/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dessertCategories.map(category => {
              const Icon = category.icon;
              const categorySmoothies = dessertSmoothies.filter(smoothie => {
                if (category.id === 'guilt-free') return smoothie.guiltFactor === 'None';
                if (category.id === 'protein-rich') return smoothie.nutrition.protein >= 15;
                if (category.id === 'comfort') return smoothie.category.includes('Classic') || smoothie.category.includes('Sweet');
                if (category.id === 'celebration') return smoothie.category.includes('Celebration') || smoothie.name.includes('Birthday');
                return false;
              });
              
              return (
                <Card key={category.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${category.color.replace('bg-', 'bg-').replace('-500', '-100')} rounded-lg`}>
                        <Icon className={`h-6 w-6 ${category.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        <p className="text-sm text-gray-600">{category.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Calorie Range:</div>
                        <div className="text-lg font-bold text-pink-600">{category.calorieRange}</div>
                      </div>
                      
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-1">Sweetener Type:</div>
                        <div className="text-sm text-green-800">{category.sweetenerType}</div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${category.color.replace('bg-', 'text-')} mb-1`}>
                        {categorySmoothies.length}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">Available Recipes</div>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          if (category.id === 'guilt-free') setSelectedCategory('');
                          else if (category.id === 'protein-rich') setSelectedCategory('Protein');
                          else if (category.id === 'comfort') setSelectedCategory('Classic');
                          else if (category.id === 'celebration') setSelectedCategory('Celebration');
                          setActiveTab('browse');
                        }}
                      >
                        View {category.name}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Featured Tab */}
        {activeTab === 'featured' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredSmoothies.map(smoothie => (
              <Card key={smoothie.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  <img 
                    src={smoothie.image} 
                    alt={smoothie.name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=400&h=300&fit=crop';
                    }}
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-pink-500 text-white">Featured Dessert</Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-pink-800">{smoothie.nutrition.calories} Cal</Badge>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{smoothie.name}</CardTitle>
                  <p className="text-gray-600">{smoothie.description}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-pink-100 text-pink-800">{smoothie.dessertType}</Badge>
                    <Badge variant="outline">{smoothie.flavorProfile}</Badge>
                    <Badge className="bg-green-100 text-green-800">{smoothie.guiltFactor} Guilt</Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{smoothie.rating}</span>
                      <span className="text-gray-500 text-sm">({smoothie.reviews})</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-pink-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-pink-600">{smoothie.nutrition.calories}</div>
                      <div className="text-xs text-gray-600">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{smoothie.nutrition.protein}g</div>
                      <div className="text-xs text-gray-600">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{smoothie.nutrition.added_sugar}g</div>
                      <div className="text-xs text-gray-600">Added Sugar</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-amber-600">${smoothie.estimatedCost}</div>
                      <div className="text-xs text-gray-600">Est. Cost</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Healthy Swaps:</h4>
                    <div className="flex flex-wrap gap-1">
                      {smoothie.healthySwaps.map((swap, index) => (
                        <Badge key={index} className="bg-green-100 text-green-800 text-xs">
                          {swap}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Key Benefits:</h4>
                    <div className="flex flex-wrap gap-1">
                      {smoothie.benefits.map((benefit, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Best Time:</div>
                        <div className="text-pink-600 font-semibold">{smoothie.bestTime}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Guilt Factor:</div>
                        <div className="text-green-600 font-semibold">{smoothie.guiltFactor}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Ingredients:</h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      {smoothie.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <ChefHat className="h-3 w-3 text-pink-500" />
                          {ingredient}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-pink-600 hover:bg-pink-700"
                      onClick={() => handleMakeSmoothie(smoothie)}
                    >
                      <ChefHat className="h-4 w-4 mr-2" />
                      Make This Dessert
                    </Button>
                    <Button variant="outline">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="rounded-full w-14 h-14 bg-pink-600 hover:bg-pink-700 shadow-lg"
          onClick={() => setActiveTab('browse')}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Bottom Stats Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-pink-600" />
              <span className="text-gray-600">Dessert Smoothies Found:</span>
              <span className="font-bold text-pink-600">{filteredSmoothies.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600">Your Level:</span>
              <span className="font-bold text-yellow-600">{userProgress.level}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-pink-500" />
              <span className="text-gray-600">XP:</span>
              <span className="font-bold text-pink-600">{userProgress.totalPoints}</span>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Back to Top
          </Button>
        </div>
      </div>
    </div>
  );
}

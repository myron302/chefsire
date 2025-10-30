# Caffeinated Drinks Pages - Update Guide

## ✅ Completed
- **Espresso** (`client/src/pages/drinks/caffeinated/espresso/index.tsx`) - Fully updated with RecipeKit, navigation, measurements, and matching breakfast smoothies pattern

## 🔄 Pattern Applied
The espresso page now includes:
1. ✅ Cross-hub navigation (to other top-level drink categories)
2. ✅ Sister pages navigation (to other caffeinated drink types)
3. ✅ RecipeKit integration with amber accent color
4. ✅ Proper measurements parsing
5. ✅ Rating & difficulty positioned correctly (above recipe card)
6. ✅ Tags matching section color (amber-100/amber-600)
7. ✅ Copy/Share/Metrics buttons
8. ✅ Modal popup with RecipeKit
9. ✅ Complete layout matching breakfast smoothies

## 📋 Remaining Pages to Update

### 1. Cold Brew (`/drinks/caffeinated/cold-brew`)
**Current State:** Has wrong data (espresso data copy)
**Accent Color:** `amber`
**Icon:** `Coffee`
**Sample Drinks:**
```typescript
{
  id: 'classic-cold-brew',
  name: 'Classic Cold Brew',
  description: 'Smooth, naturally sweet cold coffee',
  ingredients: ['1 cup coarse ground coffee', '4 cup cold water'],
  benefits: ['Low acidity', 'Smooth taste', 'Natural sweetness'],
  nutrition: { calories: 5, caffeine: 200, carbs: 0, sugar: 0 },
  difficulty: 'Easy',
  prepTime: 5,
  rating: 4.8,
  reviews: 2341,
  drinkType: 'Cold Brew',
  energyLevel: 'High',
  featured: true,
  trending: true,
  bestTime: 'Morning',
  estimatedCost: 1.50
}
```

### 2. Energy Drinks (`/drinks/caffeinated/energy`)
**Current State:** Placeholder "coming soon"
**Accent Color:** `red`
**Icon:** `Zap`
**Sample Drinks:**
- Green Tea Energy Boost
- Citrus Energy Blast
- Matcha Energy Drink

### 3. Iced Coffee (`/drinks/caffeinated/iced`)
**Current State:** Placeholder "coming soon"
**Accent Color:** `blue`
**Icon:** `Droplets`
**Sample Drinks:**
- Classic Iced Coffee
- Vanilla Iced Latte
- Caramel Iced Macchiato

### 4. Lattes (`/drinks/caffeinated/lattes`)
**Current State:** Placeholder "coming soon"
**Accent Color:** `amber`
**Icon:** `Coffee`
**Sample Drinks:**
- Classic Latte
- Vanilla Latte
- Caramel Latte
- Mocha Latte

### 5. Matcha (`/drinks/caffeinated/matcha`)
**Current State:** Placeholder "coming soon"
**Accent Color:** `green`
**Icon:** `Leaf`
**Sample Drinks:**
- Ceremonial Matcha
- Matcha Latte
- Iced Matcha

### 6. Tea (`/drinks/caffeinated/tea`)
**Current State:** Placeholder "coming soon"
**Accent Color:** `green`
**Icon:** `Leaf`
**Sample Drinks:**
- Black Tea
- Green Tea
- Oolong Tea
- White Tea

### 7. Specialty (`/drinks/caffeinated/specialty`)
**Current State:** Placeholder "coming soon"
**Accent Color:** `purple`
**Icon:** `Star`
**Sample Drinks:**
- Bulletproof Coffee
- Vietnamese Coffee
- Turkish Coffee
- Irish Coffee

## 🔧 How to Update Each Page

### Step-by-Step Process:

1. **Copy the espresso template**
   ```bash
   cp client/src/pages/drinks/caffeinated/espresso/index.tsx client/src/pages/drinks/caffeinated/{PAGE_NAME}/index.tsx
   ```

2. **Update the key elements:**
   - Change display name (e.g., "Espresso Drinks" → "Cold Brew Coffee")
   - Update accent color in RecipeKit (line 516: `accent="amber"` → appropriate color)
   - Update drinks data array with appropriate drinks for that category
   - Update drinkTypes array
   - Update benefits list
   - Update the icon imports and usage
   - Update background gradient colors
   - Update page title and badge text
   - Update the "allCaffeinatedSubcategories" array to exclude current page

3. **Key sections to customize:**
   - Line 84-262: `espressoDrinks` array → Update with category-specific drinks
   - Line 264-301: `espressoTypes` → Update with category-specific types
   - Line 303-308: `espressoBenefitsList` → Update benefits
   - Line 320-328: `allCaffeinatedSubcategories` → Remove current page from list
   - Line 516: RecipeKit `accent` prop → Set appropriate color
   - Line 544-546: Icon, title, and badge → Update display name
   - Line 628: Section title → Update (e.g., "Why Espresso?" → "Why Cold Brew?")

4. **Test the page:**
   - Navigate to the page
   - Verify navigation links work
   - Test RecipeKit modal opens
   - Verify color scheme matches
   - Check Copy/Share/Metrics buttons work

## 🎨 Color Scheme by Category

| Category | Accent Color | Tailwind Classes |
|----------|-------------|------------------|
| Espresso | amber | bg-amber-400, text-amber-600, border-amber-200 |
| Cold Brew | amber | bg-amber-400, text-amber-600, border-amber-200 |
| Energy | red | bg-red-400, text-red-600, border-red-200 |
| Iced | blue | bg-blue-400, text-blue-600, border-blue-200 |
| Lattes | amber | bg-amber-400, text-amber-600, border-amber-200 |
| Matcha | green | bg-green-400, text-green-600, border-green-200 |
| Tea | green | bg-green-400, text-green-600, border-green-200 |
| Specialty | purple | bg-purple-400, text-purple-600, border-purple-200 |

## ✅ Verification Checklist

For each completed page, verify:
- [ ] Cross-hub navigation card displays correctly
- [ ] Sister pages navigation card displays correctly (without current page)
- [ ] RecipeKit modal opens with correct accent color
- [ ] Recipe measurements parse correctly
- [ ] Rating & difficulty display above recipe card
- [ ] Tags use correct color scheme
- [ ] Copy/Share/Metrics buttons function
- [ ] "Make Drink" button uses correct color
- [ ] All navigation links work
- [ ] Page matches breakfast smoothies layout

## 🚀 Quick Start Command

To update all remaining pages efficiently, you can:
1. Use the espresso page as your template
2. Update drinks data for each category
3. Change accent colors and display names
4. Test each page thoroughly

## 📝 Notes

- All caffeinated pages should use the amber/orange color scheme except:
  - Energy: red
  - Iced: blue
  - Matcha/Tea: green
  - Specialty: purple
- RecipeKit component automatically handles the accent color prop
- Ensure all ingredients have proper measurements for scaling
- Include 3-6 drinks per category minimum for good UX
- Mark at least 1-2 drinks as "featured" and "trending" for variety

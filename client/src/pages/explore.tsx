import { useState } from "react";

// Example filter options (replace with your full list from the filter library)
const CUISINES = ["Italian", "French", "Japanese", "American", "Mexican"];
const DIETS = ["Vegetarian", "Vegan", "Gluten-Free", "Lactose-Free", "Keto", "Paleo"];
const COURSES = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const ALLERGENS = ["Gluten", "Dairy", "Eggs", "Peanuts", "Soy", "Shellfish"];

export default function Explore() {
  // Basic search and preferences
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("");
  const [selectedDiets, setSelectedDiets] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedAllergens, setSelectedAllergens] = useState([]);
  const [includeIngredients, setIncludeIngredients] = useState([]);
  const [excludeIngredients, setExcludeIngredients] = useState([]);
  const [prepTimeRange, setPrepTimeRange] = useState([0, 60]);   // minutes
  const [cookTimeRange, setCookTimeRange] = useState([0, 120]);  // minutes
  const [maxCalories, setMaxCalories] = useState("");
  const [onlySaved, setOnlySaved] = useState(false);
  const [onlyVerifiedChef, setOnlyVerifiedChef] = useState(false);

  // Render the explorer and filters
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1>Explore Recipes</h1>
      
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search recipes, chefs, or ingredients"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: 250, marginBottom: 10 }}
        />
      </div>

      {/* Cuisine Filter */}
      <div>
        <label>Cuisine:</label>
        <select
          value={selectedCuisine}
          onChange={e => setSelectedCuisine(e.target.value)}
        >
          <option value="">All Cuisines</option>
          {CUISINES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Diets Filter (multi-select checkboxes) */}
      <div>
        <label>Diets:</label>
        {DIETS.map(d => (
          <label key={d} style={{ marginRight: 8 }}>
            <input
              type="checkbox"
              checked={selectedDiets.includes(d)}
              onChange={e =>
                setSelectedDiets(
                  e.target.checked 
                    ? [...selectedDiets, d]
                    : selectedDiets.filter(x => x !== d)
                )
              }
            /> {d}
          </label>
        ))}
      </div>

      {/* Courses Filter (multi-select checkboxes) */}
      <div>
        <label>Course:</label>
        {COURSES.map(c => (
          <label key={c} style={{ marginRight: 8 }}>
            <input
              type="checkbox"
              checked={selectedCourses.includes(c)}
              onChange={e =>
                setSelectedCourses(
                  e.target.checked
                    ? [...selectedCourses, c]
                    : selectedCourses.filter(x => x !== c)
                )
              }
            /> {c}
          </label>
        ))}
      </div>

      {/* Difficulty Filter */}
      <div>
        <label>Difficulty:</label>
        <select
          value={selectedDifficulty}
          onChange={e => setSelectedDifficulty(e.target.value)}
        >
          <option value="">Any</option>
          {DIFFICULTIES.map(level => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
      </div>

      {/* Allergen Filter (multi-select checkboxes) */}
      <div>
        <label>Exclude Allergens:</label>
        {ALLERGENS.map(a => (
          <label key={a} style={{ marginRight: 8 }}>
            <input
              type="checkbox"
              checked={selectedAllergens.includes(a)}
              onChange={e =>
                setSelectedAllergens(
                  e.target.checked 
                    ? [...selectedAllergens, a]
                    : selectedAllergens.filter(x => x !== a)
                )
              }
            /> {a}
          </label>
        ))}
      </div>

      {/* Prep Time Filter */}
      <div>
        <label>Prep Time: {prepTimeRange}–{prepTimeRange[1]} min</label>
        <input
          type="range"
          min={0}
          max={120}
          step={5}
          value={prepTimeRange}
          onChange={e => setPrepTimeRange([Number(e.target.value), prepTimeRange[1]])}
        />
        <input
          type="range"
          min={0}
          max={120}
          step={5}
          value={prepTimeRange[1]}
          onChange={e => setPrepTimeRange([prepTimeRange, Number(e.target.value)])}
        />
      </div>

      {/* Cook Time Filter */}
      <div>
        <label>Cook Time: {cookTimeRange}–{cookTimeRange[1]} min</label>
        <input
          type="range"
          min={0}
          max={180}
          step={5}
          value={cookTimeRange}
          onChange={e => setCookTimeRange([Number(e.target.value), cookTimeRange[1]])}
        />
        <input
          type="range"
          min={0}
          max={180}
          step={5}
          value={cookTimeRange[1]}
          onChange={e => setCookTimeRange([cookTimeRange, Number(e.target.value)])}
        />
      </div>

      {/* Max Calories Filter */}
      <div>
        <label>Max Calories:</label>
        <input
          type="number"
          value={maxCalories}
          placeholder="e.g., 500"
          onChange={e => setMaxCalories(e.target.value)}
          style={{ width: 80 }}
        />
        {maxCalories && <button onClick={() => setMaxCalories("")}>Clear</button>}
      </div>

      {/* Ingredient Include / Exclude */}
      <div>
        <label>Include ingredients (comma separated):</label>
        <input
          type="text"
          value={includeIngredients.join(", ")}
          placeholder="e.g. chicken, basil"
          onChange={e => setIncludeIngredients(e.target.value.split(",").map(s => s.trim()))}
          style={{ width: 200 }}
        />
      </div>
      <div>
        <label>Exclude ingredients (comma separated):</label>
        <input
          type="text"
          value={excludeIngredients.join(", ")}
          placeholder="e.g. peanuts, cilantro"
          onChange={e => setExcludeIngredients(e.target.value.split(",").map(s => s.trim()))}
          style={{ width: 200 }}
        />
      </div>

      {/* Toggles */}
      <div>
        <label>
          <input type="checkbox" checked={onlySaved} onChange={e => setOnlySaved(e.target.checked)} />
          Only show recipes I've saved
        </label>
        <label>
          <input type="checkbox" checked={onlyVerifiedChef} onChange={e => setOnlyVerifiedChef(e.target.checked)} />
          Only show verified chefs
        </label>
      </div>

      {/* Results - Placeholder, add your rendering logic here */}
      <div style={{ marginTop: 20 }}>
        {/* Render your search results here, filtered by all the above criteria */}
        <p>[Your recipe results go here]</p>
      </div>
    </div>
  );
}

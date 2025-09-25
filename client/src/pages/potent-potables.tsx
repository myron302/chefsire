// client/src/pages/potentpotables.tsx
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Drink {
  id: number;
  name: string;
  type: string;
  ingredients: string;
  image: string;
}

export default function PotentPotables() {
  const [drinks, setDrinks] = useState<Drink[]>([
    {
      id: 1,
      name: "Mojito",
      type: "cocktail",
      ingredients: "Rum, Mint, Lime, Sugar, Soda",
      image: "https://picsum.photos/300/200?random=1",
    },
    {
      id: 2,
      name: "Virgin Piña Colada",
      type: "mocktail",
      ingredients: "Pineapple, Coconut Cream, Ice",
      image: "https://picsum.photos/300/200?random=2",
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [newDrink, setNewDrink] = useState({
    name: "",
    type: "",
    ingredients: "",
    image: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const drink = { id: drinks.length + 1, ...newDrink };
    setDrinks([...drinks, drink]);
    setShowForm(false);
    setNewDrink({ name: "", type: "", ingredients: "", image: "" });
  };

  useEffect(() => {
    // Placeholder for future API call
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-red-700 mb-4">Potent Potables</h1>
      <div className="grid gap-4">
        {drinks.map((drink) => (
          <div key={drink.id} className="bg-white p-4 rounded shadow border">
            <img
              src={drink.image}
              alt={drink.name}
              className="w-full h-48 object-cover rounded-t"
              onError={(e) =>
                (e.currentTarget.src = "https://picsum.photos/300/200?grayscale")
              }
            />
            <h3 className="text-lg font-semibold mt-2">{drink.name}</h3>
            <p className="text-sm text-gray-600">{drink.type}</p>
            <p className="text-sm">{drink.ingredients}</p>
            <div className="flex space-x-2 mt-2">
              <Button
                variant="default"
                size="sm"
                className="bg-green-500 hover:bg-green-600"
              >
                Like
              </Button>
              <Button
                variant="default"
                size="sm"
                className="bg-blue-500 hover:bg-blue-600"
              >
                Comment
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button
        onClick={() => setShowForm(true)}
        className="mt-4 bg-blue-700 text-white hover:bg-opacity-90"
      >
        Add New Drink
      </Button>

      {showForm && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg w-1/3">
            <h2 className="text-2xl font-bold text-blue-700 mb-4">Add a Drink</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-700">
                  Drink Name
                </label>
                <Input
                  type="text"
                  value={newDrink.name}
                  onChange={(e) =>
                    setNewDrink({ ...newDrink, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700">
                  Type
                </label>
                <select
                  value={newDrink.type}
                  onChange={(e) =>
                    setNewDrink({ ...newDrink, type: e.target.value })
                  }
                  className="w-full p-2 border rounded"
                  required
                >
                  <option value="cocktail">Cocktail</option>
                  <option value="mocktail">Mocktail</option>
                  <option value="smoothie">Smoothie</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700">
                  Ingredients
                </label>
                <Input
                  type="text"
                  value={newDrink.ingredients}
                  onChange={(e) =>
                    setNewDrink({ ...newDrink, ingredients: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700">
                  Image URL
                </label>
                <Input
                  type="url"
                  value={newDrink.image}
                  onChange={(e) =>
                    setNewDrink({ ...newDrink, image: e.target.value })
                  }
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-700 text-white hover:bg-opacity-90"
                >
                  Submit
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

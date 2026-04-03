import { CheckCircle, ShoppingBag, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface GroceryItem {
  id: string;
  ingredientName: string;
  quantity?: string;
  category?: string;
  estimatedPrice?: string;
  purchased: boolean;
  isPantryItem: boolean;
  aisle?: string;
  priority: string;
}

interface BudgetSummary {
  estimated: number;
  actual: number;
  difference: number;
}

interface GroceryTabSectionProps {
  budgetSummary: BudgetSummary;
  groceryItems: GroceryItem[];
  onCheckPantry: () => void;
  onOptimizeList: () => void;
}

export const GroceryTabSection = ({ budgetSummary, groceryItems, onCheckPantry, onOptimizeList }: GroceryTabSectionProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-orange-500" />Smart Grocery List</CardTitle>
      <CardDescription>Optimized shopping with budget tracking and pantry integration</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[['Estimated', budgetSummary.estimated, ''], ['Actual', budgetSummary.actual, ''], ['Difference', budgetSummary.difference, budgetSummary.difference > 0 ? 'text-red-500' : 'text-green-500']].map(([label, val, cls]) => (
          <Card key={label as string}><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">{label}</p><p className={`text-2xl font-bold ${cls}`}>${Math.abs(Number(val)).toFixed(2)}</p></CardContent></Card>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={onCheckPantry} variant="outline" className="flex-1"><CheckCircle className="w-4 h-4 mr-2" />Check Pantry</Button>
        <Button onClick={onOptimizeList} variant="outline" className="flex-1"><TrendingUp className="w-4 h-4 mr-2" />Optimize List</Button>
      </div>
      {groceryItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No items in your grocery list yet.</p>
        </div>
      ) : groceryItems.map((item) => (
        <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3 flex-1">
            <input type="checkbox" checked={item.purchased} readOnly className="w-5 h-5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={item.purchased ? 'line-through text-muted-foreground' : ''}>{item.ingredientName}</span>
                {item.isPantryItem && <Badge variant="secondary">In Pantry</Badge>}
                {item.priority === 'high' && <Badge variant="destructive">Priority</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{item.quantity}{item.category && ` • ${item.category}`}{item.aisle && ` • Aisle ${item.aisle}`}</p>
            </div>
            {item.estimatedPrice && <p className="text-sm">${Number(item.estimatedPrice).toFixed(2)}</p>}
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default GroceryTabSection;

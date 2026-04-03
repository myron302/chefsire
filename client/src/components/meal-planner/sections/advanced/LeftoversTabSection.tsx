import { AlertCircle, CheckCircle, Plus, Refrigerator, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Leftover {
  id: string;
  recipeName: string;
  quantity: string;
  storedDate: string;
  expiryDate?: string;
  storageLocation: string;
}

interface LeftoverFormValues {
  recipeName: string;
  quantity: string;
  storageLocation: string;
  expiryDate: string;
}

interface LeftoversTabSectionProps {
  leftovers: Leftover[];
  showLeftoverForm: boolean;
  leftoverForm: LeftoverFormValues;
  onShowLeftoverForm: () => void;
  onHideLeftoverForm: () => void;
  onLeftoverFormChange: (nextValues: LeftoverFormValues) => void;
  onSubmitLeftover: () => void;
  onMarkLeftoverConsumed: (id: string, wasted?: boolean) => void;
  getDaysUntilExpiry: (expiryDate: string) => number;
}

export const LeftoversTabSection = ({
  leftovers,
  showLeftoverForm,
  leftoverForm,
  onShowLeftoverForm,
  onHideLeftoverForm,
  onLeftoverFormChange,
  onSubmitLeftover,
  onMarkLeftoverConsumed,
  getDaysUntilExpiry,
}: LeftoversTabSectionProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Refrigerator className="w-5 h-5 text-green-500" />Leftover Tracking</CardTitle>
      <CardDescription>Reduce waste and get repurposing suggestions</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <Button className="w-full" onClick={onShowLeftoverForm}><Plus className="w-4 h-4 mr-2" />Track New Leftover</Button>

      {showLeftoverForm && (
        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">New Leftover</h4>
              <button onClick={onHideLeftoverForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Dish name (e.g. Roasted Chicken)" value={leftoverForm.recipeName} onChange={(e) => onLeftoverFormChange({ ...leftoverForm, recipeName: e.target.value })} />
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Quantity (e.g. 2 portions)" value={leftoverForm.quantity} onChange={(e) => onLeftoverFormChange({ ...leftoverForm, quantity: e.target.value })} />
            <select className="w-full border rounded px-3 py-2 text-sm" value={leftoverForm.storageLocation} onChange={(e) => onLeftoverFormChange({ ...leftoverForm, storageLocation: e.target.value })}>
              <option value="fridge">Fridge</option>
              <option value="freezer">Freezer</option>
              <option value="pantry">Pantry</option>
            </select>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Expiry date (optional)</label>
              <input type="date" className="w-full border rounded px-3 py-2 text-sm" value={leftoverForm.expiryDate} onChange={(e) => onLeftoverFormChange({ ...leftoverForm, expiryDate: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onHideLeftoverForm}>Cancel</Button>
              <Button className="flex-1" onClick={onSubmitLeftover}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {leftovers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Refrigerator className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No leftovers tracked. Add them to reduce food waste!</p>
        </div>
      ) : leftovers.map((leftover) => {
        const daysLeft = leftover.expiryDate ? getDaysUntilExpiry(leftover.expiryDate) : null;
        const isExpiring = daysLeft !== null && daysLeft <= 2;
        return (
          <Card key={leftover.id} className={isExpiring ? 'border-l-4 border-l-red-500' : ''}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold">{leftover.recipeName}</h4>
                    {isExpiring && <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />{daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}</Badge>}
                    <Badge variant="outline">{leftover.storageLocation}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Qty: {leftover.quantity}</p>
                  <p className="text-xs text-muted-foreground">Stored: {new Date(leftover.storedDate).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 ml-2">
                  <Button size="sm" onClick={() => onMarkLeftoverConsumed(leftover.id)}><CheckCircle className="w-4 h-4 mr-1" />Ate it</Button>
                  <Button size="sm" variant="outline" onClick={() => onMarkLeftoverConsumed(leftover.id, true)}>Wasted</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </CardContent>
  </Card>
);

export default LeftoversTabSection;

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type CalcForm = {
  age: number;
  gender: string;
  heightUnit: string;
  feet: number;
  inches: number;
  cm: number;
  weightUnit: string;
  weight: number;
  activity: string;
  goal: string;
};

type CalcResult = {
  dailyCalorieGoal: number;
  macroGoals: {
    protein: number;
    carbs: number;
    fat: number;
  };
};

type GoalCalculatorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calcForm: CalcForm;
  setCalcForm: React.Dispatch<React.SetStateAction<CalcForm>>;
  calcResult: CalcResult | null;
  onCalculate: () => void;
  onSave: () => void;
};

const GoalCalculatorDialog = ({
  open,
  onOpenChange,
  calcForm,
  setCalcForm,
  calcResult,
  onCalculate,
  onSave,
}: GoalCalculatorDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Calculate My Goals</DialogTitle>
        <DialogDescription>Use Mifflin-St Jeor to estimate calories and macros.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <input type="number" className="border rounded px-3 py-2" placeholder="Age" value={calcForm.age} onChange={(e) => setCalcForm((p) => ({ ...p, age: Number(e.target.value) }))} />
        <select className="border rounded px-3 py-2" value={calcForm.gender} onChange={(e) => setCalcForm((p) => ({ ...p, gender: e.target.value }))}><option value="male">Male</option><option value="female">Female</option></select>
        <select className="border rounded px-3 py-2" value={calcForm.heightUnit} onChange={(e) => setCalcForm((p) => ({ ...p, heightUnit: e.target.value }))}><option value="ft">ft/in</option><option value="cm">cm</option></select>
        {calcForm.heightUnit === 'cm' ? (
          <input type="number" className="border rounded px-3 py-2" placeholder="Height (cm)" value={calcForm.cm} onChange={(e) => setCalcForm((p) => ({ ...p, cm: Number(e.target.value) }))} />
        ) : (
          <div className="flex gap-2"><input type="number" className="border rounded px-2 py-2 w-1/2" placeholder="ft" value={calcForm.feet} onChange={(e) => setCalcForm((p) => ({ ...p, feet: Number(e.target.value) }))} /><input type="number" className="border rounded px-2 py-2 w-1/2" placeholder="in" value={calcForm.inches} onChange={(e) => setCalcForm((p) => ({ ...p, inches: Number(e.target.value) }))} /></div>
        )}
        <select className="border rounded px-3 py-2" value={calcForm.weightUnit} onChange={(e) => setCalcForm((p) => ({ ...p, weightUnit: e.target.value }))}><option value="lbs">lbs</option><option value="kg">kg</option></select>
        <input type="number" className="border rounded px-3 py-2" placeholder="Weight" value={calcForm.weight} onChange={(e) => setCalcForm((p) => ({ ...p, weight: Number(e.target.value) }))} />
        <select className="border rounded px-3 py-2 col-span-2" value={calcForm.activity} onChange={(e) => setCalcForm((p) => ({ ...p, activity: e.target.value }))}><option>sedentary</option><option>lightly active</option><option>moderately active</option><option>very active</option><option>extra active</option></select>
        <select className="border rounded px-3 py-2 col-span-2" value={calcForm.goal} onChange={(e) => setCalcForm((p) => ({ ...p, goal: e.target.value }))}><option>lose weight</option><option>maintain</option><option>gain muscle</option></select>
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="outline" className="flex-1" onClick={onCalculate}>Calculate</Button>
        <Button className="flex-1" onClick={onSave} disabled={!calcResult}>Save These Goals</Button>
      </div>
      {calcResult && <div className="text-sm bg-gray-50 rounded p-3">{calcResult.dailyCalorieGoal} kcal · P {calcResult.macroGoals.protein}g · C {calcResult.macroGoals.carbs}g · F {calcResult.macroGoals.fat}g</div>}
    </DialogContent>
  </Dialog>
);

export default GoalCalculatorDialog;

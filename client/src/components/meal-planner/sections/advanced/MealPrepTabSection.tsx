import { Calendar, CheckCircle, Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface MealPrepSchedule {
  id: string;
  prepDay: string;
  prepTime?: string;
  shoppingDay?: string;
  batchRecipes: any[];
  completed: boolean;
}

interface MealPrepTabSectionProps {
  mealPrepSchedules: MealPrepSchedule[];
  onCreateSchedule: () => void;
  onMarkComplete: (id: string) => void;
}

export const MealPrepTabSection = ({ mealPrepSchedules, onCreateSchedule, onMarkComplete }: MealPrepTabSectionProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" />Meal Prep Scheduling</CardTitle>
      <CardDescription>Plan your batch cooking sessions and save time</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <Button className="w-full" onClick={onCreateSchedule}><Plus className="w-4 h-4 mr-2" />Create Prep Schedule</Button>
      {mealPrepSchedules.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No meal prep schedules yet. Create one to get organized!</p>
        </div>
      ) : mealPrepSchedules.map((schedule) => (
        <Card key={schedule.id} className={schedule.completed ? 'opacity-60' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold capitalize">{schedule.prepDay}</h4>
                  {schedule.completed && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <p className="text-sm text-muted-foreground">Prep: {schedule.prepTime || 'Not set'}{schedule.shoppingDay && ` • Shop: ${schedule.shoppingDay}`}</p>
                <p className="text-xs text-muted-foreground mt-1">{schedule.batchRecipes.length} recipes planned</p>
              </div>
              {!schedule.completed && <Button size="sm" onClick={() => onMarkComplete(schedule.id)}>Mark Complete</Button>}
            </div>
          </CardContent>
        </Card>
      ))}
    </CardContent>
  </Card>
);

export default MealPrepTabSection;

import { CheckCircle, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  unlocked: boolean;
  progress: number;
}

interface AchievementsTabSectionProps {
  totalPoints: number;
  achievements: Achievement[];
  onCheckAchievements: () => void;
}

export const AchievementsTabSection = ({ totalPoints, achievements, onCheckAchievements }: AchievementsTabSectionProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" />Achievements & Progress</CardTitle>
      <CardDescription>Track your ChefSire journey and earn XP</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div><h3 className="text-3xl font-bold">{totalPoints}</h3><p className="text-sm opacity-90">Total XP Earned</p></div>
            <Trophy className="w-12 h-12 opacity-80" />
          </div>
        </CardContent>
      </Card>
      <Button className="w-full" variant="outline" onClick={onCheckAchievements}>Check for New Achievements</Button>
      {achievements.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Loading achievements…</p>
        </div>
      ) : achievements.map((ach) => (
        <Card key={ach.id} className={ach.unlocked ? 'border-2 border-yellow-400' : 'opacity-70'}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`text-2xl ${ach.unlocked ? '' : 'grayscale'}`}>{ach.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{ach.name}</h4>
                  <Badge variant="outline" className="capitalize">{ach.category}</Badge>
                  {ach.unlocked && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <p className="text-sm text-muted-foreground mb-2">{ach.description}</p>
                {!ach.unlocked && <Progress value={ach.progress} className="h-2" />}
              </div>
              <div className="text-right"><p className="text-lg font-bold text-yellow-600">+{ach.xpReward}</p><p className="text-xs text-muted-foreground">XP</p></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </CardContent>
  </Card>
);

export default AchievementsTabSection;

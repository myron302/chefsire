import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const generatePlannerMomentumCard = (values: { macroConsistency: number; prepReadiness: number; groceryReadiness: number; hydrationStreak: number; aiCoachHighlights: string[]; }) => ({
  momentumScore: Math.round((values.macroConsistency + values.prepReadiness + values.groceryReadiness + Math.min(values.hydrationStreak * 5, 100)) / 4),
  ...values,
});

const PlannerShareCards = ({ card }: { card: ReturnType<typeof generatePlannerMomentumCard> }) => (
  <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
    <CardHeader>
      <CardTitle className="text-base flex items-center justify-between">
        Weekly Momentum
        <Badge>{card.momentumScore}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className="grid grid-cols-2 gap-2 text-sm">
      <div>Macro Summary: {card.macroConsistency}%</div>
      <div>Grocery Ready: {card.groceryReadiness}%</div>
      <div>Prep Ready: {card.prepReadiness}%</div>
      <div>Hydration Streak: {card.hydrationStreak}d</div>
      <div className="col-span-2 text-xs text-muted-foreground">AI Coach: {card.aiCoachHighlights.join(' • ') || 'No highlights yet'}</div>
    </CardContent>
  </Card>
);

export default PlannerShareCards;

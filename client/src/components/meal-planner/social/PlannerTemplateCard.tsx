import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PlannerTemplate } from './plannerTemplateUtils';

const PlannerTemplateCard = ({ template, onUse, onApplyMonday, onCopyBreakfasts }: { template: PlannerTemplate; onUse: () => void; onApplyMonday: () => void; onCopyBreakfasts: () => void; }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{template.title}</CardTitle>
      <div className="flex gap-2 flex-wrap">
        <Badge variant="secondary">{template.nutritionFocus}</Badge>
        <Badge variant="outline">{template.prepStyle}</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <p className="text-xs text-muted-foreground">By {template.creator} • {template.theme}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onUse}>Use This Week</Button>
        <Button size="sm" variant="outline" onClick={onApplyMonday}>Apply Monday Only</Button>
        <Button size="sm" variant="ghost" onClick={onCopyBreakfasts}>Copy Breakfasts</Button>
      </div>
    </CardContent>
  </Card>
);

export default PlannerTemplateCard;

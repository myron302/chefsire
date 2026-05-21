import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PlannerFeedItem } from './plannerFeedUtils';

const PlannerSocialFeed = ({ items }: { items: PlannerFeedItem[] }) => (
  <Card>
    <CardHeader><CardTitle className="text-base">Social Planner Feed</CardTitle></CardHeader>
    <CardContent className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-md border p-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">{item.title}</div>
            <div className="text-xs text-muted-foreground">{item.subtitle}</div>
          </div>
          <Badge variant="outline">{item.cta}</Badge>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default PlannerSocialFeed;

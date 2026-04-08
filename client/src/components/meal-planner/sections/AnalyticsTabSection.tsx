import React from 'react';
import { AlertCircle, PieChart, Star, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AnalyticsTabSection = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Weekly Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center text-gray-500">
              <PieChart className="w-12 h-12 mx-auto mb-2" />
              <p>Macro distribution chart</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Progress Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center text-gray-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-2" />
              <p>Progress trend chart</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Insights & Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InsightCard
              icon={<Star className="w-6 h-6 text-yellow-500" />}
              title="Great Week!"
              description="You hit your protein goal 6 out of 7 days"
              trend="positive"
            />
            <InsightCard
              icon={<TrendingUp className="w-6 h-6 text-green-500" />}
              title="Consistent Progress"
              description="Your meal prep adherence is up 15%"
              trend="positive"
            />
            <InsightCard
              icon={<AlertCircle className="w-6 h-6 text-orange-500" />}
              title="Room for Improvement"
              description="Try adding more vegetables at dinner"
              trend="neutral"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const InsightCard = ({ icon, title, description, trend }: { icon: React.ReactNode; title: string; description: string; trend: 'positive' | 'neutral' }) => {
  const borderColor = trend === 'positive' ? 'border-green-200' : 'border-gray-200';

  return (
    <div className={`p-4 border-2 ${borderColor} rounded-lg`}>
      <div className="mb-2">{icon}</div>
      <h4 className="font-medium mb-1">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
};

export default AnalyticsTabSection;

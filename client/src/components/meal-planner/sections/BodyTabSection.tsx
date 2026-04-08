import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type BodyTabSectionProps = {
  bodyMetricsLog: any[];
  bodyForm: { date: string; weight: string; bodyFatPct: string; waistIn: string; hipIn: string; unit: 'lbs' | 'kg' };
  setBodyForm: React.Dispatch<React.SetStateAction<{ date: string; weight: string; bodyFatPct: string; waistIn: string; hipIn: string; unit: 'lbs' | 'kg' }>>;
  saveBodyMetric: () => void;
};

const BodyTabSection = ({ bodyMetricsLog, bodyForm, setBodyForm, saveBodyMetric }: BodyTabSectionProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Weight Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {bodyMetricsLog.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bodyMetricsLog.map((m: any) => ({ date: m.date, weight: Number(m.weightLbs) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="weight" stroke="#f97316" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">No body metrics yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Log Body Metrics</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <input type="date" className="w-full border rounded px-3 py-2 text-sm" value={bodyForm.date} onChange={(e) => setBodyForm((p) => ({ ...p, date: e.target.value }))} />
            <div className="flex gap-2">
              <input type="number" className="flex-1 border rounded px-3 py-2 text-sm" placeholder={`Weight (${bodyForm.unit})`} value={bodyForm.weight} onChange={(e) => setBodyForm((p) => ({ ...p, weight: e.target.value }))} />
              <Button variant="outline" size="sm" onClick={() => setBodyForm((p) => ({ ...p, unit: p.unit === 'lbs' ? 'kg' : 'lbs' }))}>{bodyForm.unit.toUpperCase()}</Button>
            </div>
            <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="Body fat %" value={bodyForm.bodyFatPct} onChange={(e) => setBodyForm((p) => ({ ...p, bodyFatPct: e.target.value }))} />
            <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="Waist (in)" value={bodyForm.waistIn} onChange={(e) => setBodyForm((p) => ({ ...p, waistIn: e.target.value }))} />
            <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="Hips (in)" value={bodyForm.hipIn} onChange={(e) => setBodyForm((p) => ({ ...p, hipIn: e.target.value }))} />
            <Button className="w-full" onClick={saveBodyMetric}>Save Metric</Button>
          </CardContent>
        </Card>
        {bodyMetricsLog.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Latest Entry</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm">Weight: <span className="font-semibold">{Number(bodyMetricsLog[bodyMetricsLog.length - 1]?.weightLbs).toFixed(1)} lbs</span></p>
              <p className="text-sm">Body Fat: <span className="font-semibold">{bodyMetricsLog[bodyMetricsLog.length - 1]?.bodyFatPct || '-'}%</span></p>
              <p className="text-sm">Waist: <span className="font-semibold">{bodyMetricsLog[bodyMetricsLog.length - 1]?.waistIn || '-'} in</span></p>
              <p className="text-sm">Hips: <span className="font-semibold">{bodyMetricsLog[bodyMetricsLog.length - 1]?.hipIn || '-'} in</span></p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BodyTabSection;

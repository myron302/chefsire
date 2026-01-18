import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Crown, Zap } from 'lucide-react';
import { couplePlans } from '@/config/wedding-pricing';
import { cn } from '@/lib/utils';

interface WeddingTrialSelectorProps {
  open: boolean;
  onSelect: (tier: 'free' | 'premium' | 'elite') => void;
}

export default function WeddingTrialSelector({ open, onSelect }: WeddingTrialSelectorProps) {
  const [selectedTier, setSelectedTier] = useState<'free' | 'premium' | 'elite'>('premium');

  const handleStartTrial = () => {
    onSelect(selectedTier);
  };

  const tiers = [
    {
      key: 'free' as const,
      icon: Sparkles,
      color: 'gray',
      borderColor: 'border-gray-300'
    },
    {
      key: 'premium' as const,
      icon: Zap,
      color: 'purple',
      borderColor: 'border-purple-500'
    },
    {
      key: 'elite' as const,
      icon: Crown,
      color: 'amber',
      borderColor: 'border-amber-500'
    }
  ];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl md:text-3xl text-center bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Choose Your Wedding Planning Experience
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Select a tier to start your journey. Premium & Elite include a 14-day free trial!
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {tiers.map(({ key, icon: Icon, color, borderColor }) => {
            const plan = couplePlans[key];
            const isSelected = selectedTier === key;

            return (
              <Card
                key={key}
                className={cn(
                  'p-6 cursor-pointer transition-all relative',
                  isSelected ? `border-2 ${borderColor} shadow-lg scale-105` : 'border-2 border-transparent hover:border-gray-200',
                  plan.popular && 'ring-2 ring-purple-500 ring-offset-2'
                )}
                onClick={() => setSelectedTier(key)}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600">
                    Most Popular
                  </Badge>
                )}

                <div className="text-center mb-4">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-${color}-100 dark:bg-${color}-950 mb-3`}>
                    <Icon className={`w-8 h-8 text-${color}-600`} />
                  </div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  <div className="mt-3">
                    {plan.price === 0 ? (
                      <span className="text-3xl font-bold">Free</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold">${plan.price}</span>
                        <span className="text-muted-foreground">/month</span>
                      </>
                    )}
                  </div>
                  {plan.trialDays && (
                    <Badge variant="secondary" className="mt-2">
                      {plan.trialDays}-day free trial
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  {plan.highlights.map((highlight, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>

                <Button
                  className={cn(
                    'w-full',
                    isSelected
                      ? key === 'premium'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                        : key === 'elite'
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600'
                        : 'bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  )}
                  onClick={() => setSelectedTier(key)}
                >
                  {isSelected ? 'Selected' : 'Select'}
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-8"
            onClick={handleStartTrial}
          >
            {selectedTier === 'free' ? 'Continue with Free Plan' : `Start ${couplePlans[selectedTier].trialDays}-Day Free Trial`}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-4">
          {selectedTier !== 'free' && 'No credit card required for trial. '}
          Cancel anytime during trial with no charges.
        </p>
      </DialogContent>
    </Dialog>
  );
}

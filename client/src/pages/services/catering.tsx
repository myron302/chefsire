// client/src/pages/services/catering.tsx
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'wouter';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { 
  MapPin, 
  Users, 
  Filter,
  Search,
  ChefHat,
  Calendar as CalendarIcon,
  Heart,
  ArrowRight,
  Loader2,
} from 'lucide-react';

// Spoon Rating Component
const SpoonRating = ({ rating, size = 'w-4 h-4' }: { rating: number; size?: string }) => {
  const spoons = [];
  const fullSpoons = Math.floor(rating);
  const hasHalfSpoon = rating % 1 !== 0;

  for (let i = 0; i < 5; i++) {
    if (i < fullSpoons) {
      spoons.push(
        <svg key={i} className={`${size} text-orange-400 fill-current`} viewBox="0 0 24 24">
          <path d="M12.5 2c-1.9 0-3.5 1.6-3.5 3.5 0 1.3.7 2.4 1.8 3l-.8 13.5c0 .6.4 1 1 1h3c.6 0 1-.4 1-1L14.2 8.5c1.1-.6 1.8-1.7 1.8-3C16 3.6 14.4 2 12.5 2z"/>
        </svg>
      );
    } else if (i === fullSpoons && hasHalfSpoon) {
      spoons.push(
        <div key={i} className="relative">
          <svg className={`${size} text-gray-300`} viewBox="0 0 24 24">
            <path d="M12.5 2c-1.9 0-3.5 1.6-3.5 3.5 0 1.3.7 2.4 1.8 3l-.8 13.5c0 .6.4 1 1 1h3c.6 0 1-.4 1-1L14.2 8.5c1.1-.6 1.8-1.7 1.8-3C16 3.6 14.4 2 12.5 2z"/>
          </svg>
          <svg className={`${size} text-orange-400 fill-current absolute top-0 left-0`} viewBox="0 0 24 24" style={{clipPath: 'inset(0 50% 0 0)'}}>
            <path d="M12.5 2c-1.9 0-3.5 1.6-3.5 3.5 0 1.3.7 2.4 1.8 3l-.8 13.5c0 .6.4 1 1 1h3c.6 0 1-.4 1-1L14.2 8.5c1.1-.6 1.8-1.7 1.8-3C16 3.6 14.4 2 12.5 2z"/>
          </svg>
        </div>
      );
    } else {
      spoons.push(
        <svg key={i} className={`${size} text-gray-300`} viewBox="0 0 24 24">
          <path d="M12.5 2c-1.9 0-3.5 1.6-3.5 3.5 0 1.3.7 2.4 1.8 3l-.8 13.5c0 .6.4 1 1 1h3c.6 0 1-.4 1-1L14.2 8.5c1.1-.6 1.8-1.7 1.8-3C16 3.6 14.4 2 12.5 2z"/>
        </svg>
      );
    }
  }

  return <div className="flex items-center space-x-1">{spoons}</div>;
};

interface Chef {
  id: string;
  displayName: string;
  avatar: string | null;
  specialty: string | null;
  bio: string | null;
  cateringBio: string | null;
  cateringLocation: string | null;
  cateringRadius: number;
  cateringAvailable: boolean;
  distance?: number;
}

interface CateringBookingForm {
  eventDate: Date | undefined;
  eventType: string;
  guestCount: string;
  eventLocation: string;
  additionalNotes: string;
  contactEmail: string;
  contactPhone: string;
}

const defaultBookingForm: CateringBookingForm = {
  eventDate: undefined,
  eventType: '',
  guestCount: '',
  eventLocation: '',
  additionalNotes: '',
  contactEmail: '',
  contactPhone: '',
};

export function CateringMarketplace() {
  const { user } = useUser();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState('all');
  const [userZipCode, setUserZipCode] = useState('');
  const [submittedZip, setSubmittedZip] = useState('');
  const [bookingForms, setBookingForms] = useState<Record<string, CateringBookingForm>>({});
  const [openDialogs, setOpenDialogs] = useState<Record<string, boolean>>({});

  // Fetch chefs from real API
  const { data, isLoading, isError } = useQuery({
    queryKey: ['/api/catering/chefs/search', submittedZip],
    queryFn: async () => {
      const params = new URLSearchParams({ radius: '50', limit: '20' });
      if (submittedZip) params.set('location', submittedZip);
      const res = await fetch(`/api/catering/chefs/search?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load catering chefs');
      return res.json() as Promise<{ chefs: Chef[]; total: number }>;
    },
  });

  const chefs: Chef[] = data?.chefs ?? [];

  // Book catering mutation
  const bookMutation = useMutation({
    mutationFn: async ({ chefId, form }: { chefId: string; form: CateringBookingForm }) => {
      if (!user) throw new Error('You must be logged in to book catering');
      const res = await fetch('/api/catering/inquiries', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user.id,
          chefId,
          eventDate: form.eventDate?.toISOString(),
          guestCount: form.guestCount ? parseInt(form.guestCount) : undefined,
          eventType: form.eventType || undefined,
          message: [
            form.additionalNotes,
            form.contactEmail ? `Email: ${form.contactEmail}` : '',
            form.contactPhone ? `Phone: ${form.contactPhone}` : '',
          ].filter(Boolean).join('\n') || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to submit catering request');
      }
      return res.json();
    },
    onSuccess: (_data, { chefId }) => {
      toast({ title: 'Request sent!', description: 'The chef will contact you soon.' });
      setOpenDialogs((prev) => ({ ...prev, [chefId]: false }));
      setBookingForms((prev) => ({ ...prev, [chefId]: defaultBookingForm }));
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to send request', description: err.message, variant: 'destructive' });
    },
  });

  const getForm = (chefId: string): CateringBookingForm => bookingForms[chefId] ?? defaultBookingForm;
  const updateForm = (chefId: string, patch: Partial<CateringBookingForm>) =>
    setBookingForms((prev) => ({ ...prev, [chefId]: { ...(prev[chefId] ?? defaultBookingForm), ...patch } }));

  const filteredChefs = chefs.filter((chef) => {
    const matchesSearch =
      chef.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chef.specialty ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialty =
      selectedSpecialty === 'all' ||
      (chef.specialty ?? '').toLowerCase().includes(selectedSpecialty.toLowerCase());
    // priceRange/minOrder are not in the live schema yet — price filter kept in UI for future use
    return matchesSearch && matchesSpecialty && chef.cateringAvailable;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Catering Services</h1>
        <p className="text-gray-600">Book professional chefs for your events and special occasions</p>
      </div>

      {/* Wedding Planning Hub Card */}
      <Link href="/catering/wedding-planning">
        <Card className="mb-6 hover:shadow-xl transition-all duration-300 cursor-pointer bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 border-2 border-pink-200 dark:border-pink-800 overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-r from-pink-600 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Heart className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Wedding Planning Hub
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    Complete vendor marketplace, gift registry & planning tools
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300">
                      New Feature
                    </Badge>
                    <Badge variant="secondary">
                      Free 14-Day Trial
                    </Badge>
                  </div>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-muted-foreground group-hover:text-pink-600 group-hover:translate-x-1 transition-all" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search chefs or cuisine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
            <SelectTrigger>
              <SelectValue placeholder="Cuisine Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cuisines</SelectItem>
              <SelectItem value="italian">Italian</SelectItem>
              <SelectItem value="seafood">Seafood</SelectItem>
              <SelectItem value="plant-based">Plant-Based</SelectItem>
              <SelectItem value="desserts">Desserts</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPriceRange} onValueChange={setSelectedPriceRange}>
            <SelectTrigger>
              <SelectValue placeholder="Price Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Prices</SelectItem>
              <SelectItem value="$$">$$ - Affordable</SelectItem>
              <SelectItem value="$$$">$$$ - Moderate</SelectItem>
              <SelectItem value="$$$$">$$$$ - Premium</SelectItem>
            </SelectContent>
          </Select>

          <div>
            <Input
              type="text"
              placeholder="Enter your zip code (e.g., 06360)"
              value={userZipCode}
              onChange={(e) => setUserZipCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSubmittedZip(userZipCode); }}
              maxLength={5}
            />
          </div>

          <Button className="w-full" onClick={() => setSubmittedZip(userZipCode)}>
            <Filter className="w-4 h-4 mr-2" />
            Apply Filters
          </Button>
        </div>
      </div>

      {/* Chef Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Finding chefs near you...</span>
        </div>
      ) : isError ? (
        <div className="text-center py-12">
          <ChefHat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Couldn't load chefs</h3>
          <p className="text-gray-600">Please try again in a moment.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredChefs.map((chef) => {
              const form = getForm(chef.id);
              const isOpen = openDialogs[chef.id] ?? false;
              const isSubmitting = bookMutation.isPending && bookMutation.variables?.chefId === chef.id;

              return (
                <Card key={chef.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start space-x-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={chef.avatar ?? undefined} alt={chef.displayName} />
                        <AvatarFallback>{chef.displayName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{chef.displayName}</CardTitle>
                        {chef.specialty && (
                          <p className="text-sm text-gray-600 mb-2">{chef.specialty}</p>
                        )}
                        <div className="flex items-center space-x-2">
                          <SpoonRating rating={4.5} />
                          {chef.distance !== undefined && (
                            <span className="text-sm text-gray-500">{chef.distance} mi away</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {chef.cateringBio && (
                      <p className="text-sm text-gray-600">{chef.cateringBio}</p>
                    )}

                    <div className="space-y-2">
                      {chef.cateringLocation && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-2" />
                          <span>Services within {chef.cateringRadius} miles of {chef.cateringLocation}</span>
                        </div>
                      )}
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="w-4 h-4 mr-2" />
                        <span>Available for events</span>
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-4">
                      <Dialog
                        open={isOpen}
                        onOpenChange={(v) => setOpenDialogs((prev) => ({ ...prev, [chef.id]: v }))}
                      >
                        <DialogTrigger asChild>
                          <Button className="flex-1">
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            Book Catering
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Book {chef.displayName} for Catering</DialogTitle>
                          </DialogHeader>

                          <div className="grid gap-4 py-4">
                            {!user && (
                              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                                You need to be signed in to send a booking request.
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Event Type</Label>
                                <Select
                                  value={form.eventType}
                                  onValueChange={(value) => updateForm(chef.id, { eventType: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select event type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="wedding">Wedding</SelectItem>
                                    <SelectItem value="corporate">Corporate Event</SelectItem>
                                    <SelectItem value="birthday">Birthday Party</SelectItem>
                                    <SelectItem value="anniversary">Anniversary</SelectItem>
                                    <SelectItem value="private">Private Dining</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Number of Guests</Label>
                                <Input
                                  type="number"
                                  placeholder="e.g. 25"
                                  value={form.guestCount}
                                  onChange={(e) => updateForm(chef.id, { guestCount: e.target.value })}
                                  min={1}
                                />
                              </div>
                            </div>

                            <div>
                              <Label>Event Location</Label>
                              <Input
                                placeholder="Event address or venue"
                                value={form.eventLocation}
                                onChange={(e) => updateForm(chef.id, { eventLocation: e.target.value })}
                              />
                              {chef.cateringLocation && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Must be within {chef.cateringRadius} miles of {chef.cateringLocation}
                                </p>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Contact Email</Label>
                                <Input
                                  type="email"
                                  placeholder="your@email.com"
                                  value={form.contactEmail}
                                  onChange={(e) => updateForm(chef.id, { contactEmail: e.target.value })}
                                />
                              </div>

                              <div>
                                <Label>Contact Phone</Label>
                                <Input
                                  type="tel"
                                  placeholder="(555) 123-4567"
                                  value={form.contactPhone}
                                  onChange={(e) => updateForm(chef.id, { contactPhone: e.target.value })}
                                />
                              </div>
                            </div>

                            <div>
                              <Label>Event Date</Label>
                              <div className="mt-2">
                                <Calendar
                                  mode="single"
                                  selected={form.eventDate}
                                  onSelect={(date) => updateForm(chef.id, { eventDate: date ?? undefined })}
                                  disabled={(date) => date < new Date()}
                                  className="rounded-md border"
                                />
                              </div>
                            </div>

                            <div>
                              <Label>Additional Notes</Label>
                              <Textarea
                                placeholder="Dietary restrictions, menu preferences, special requests..."
                                value={form.additionalNotes}
                                onChange={(e) => updateForm(chef.id, { additionalNotes: e.target.value })}
                                rows={4}
                              />
                            </div>

                            <Button
                              onClick={() => bookMutation.mutate({ chefId: chef.id, form })}
                              className="w-full"
                              disabled={
                                isSubmitting ||
                                !user ||
                                !form.eventDate ||
                                !form.eventType ||
                                !form.guestCount ||
                                !form.contactEmail
                              }
                            >
                              {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                              ) : (
                                'Submit Catering Request'
                              )}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button variant="outline" size="sm">
                        View Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredChefs.length === 0 && (
            <div className="text-center py-12">
              <ChefHat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No chefs found</h3>
              <p className="text-gray-600">
                {submittedZip
                  ? 'No catering chefs are available in this area yet. Try a different zip code or adjust your filters.'
                  : 'Enter your zip code above to find catering chefs near you.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CateringMarketplace;

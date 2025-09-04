import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { 
  MapPin, 
  Users, 
  Clock, 
  Filter,
  Search,
  ChefHat,
  Phone,
  Mail,
  Calendar as CalendarIcon
} from 'lucide-react';

// Spoon Rating Component
const SpoonRating = ({ rating, size = 'w-4 h-4' }: { rating: number; size?: string }) => {
  const spoons = [];
  const fullSpoons = Math.floor(rating);
  const hasHalfSpoon = rating % 1 !== 0;

  for (let i = 0; i < 5; i++) {
    if (i < fullSpoons) {
      // Full spoon
      spoons.push(
        <svg key={i} className={`${size} text-orange-400 fill-current`} viewBox="0 0 24 24">
          <path d="M12.5 2c-1.9 0-3.5 1.6-3.5 3.5 0 1.3.7 2.4 1.8 3l-.8 13.5c0 .6.4 1 1 1h3c.6 0 1-.4 1-1L14.2 8.5c1.1-.6 1.8-1.7 1.8-3C16 3.6 14.4 2 12.5 2z"/>
        </svg>
      );
    } else if (i === fullSpoons && hasHalfSpoon) {
      // Half spoon
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
      // Empty spoon
      spoons.push(
        <svg key={i} className={`${size} text-gray-300`} viewBox="0 0 24 24">
          <path d="M12.5 2c-1.9 0-3.5 1.6-3.5 3.5 0 1.3.7 2.4 1.8 3l-.8 13.5c0 .6.4 1 1 1h3c.6 0 1-.4 1-1L14.2 8.5c1.1-.6 1.8-1.7 1.8-3C16 3.6 14.4 2 12.5 2z"/>
        </svg>
      );
    }
  }

  return <div className="flex items-center space-x-1">{spoons}</div>;
};

interface CateringChef {
  id: string;
  displayName: string;
  avatar: string;
  specialty: string;
  bio: string;
  cateringBio: string;
  cateringLocation: string;
  cateringRadius: number;
  cateringAvailable: boolean;
  rating: number;
  reviewCount: number;
  priceRange: string;
  minOrder: number;
  specialties: string[];
  sampleMenus: string[];
}

// Mock catering data - would come from your API
const mockCateringChefs: CateringChef[] = [
  {
    id: 'user-1',
    displayName: 'Chef Alexandra',
    avatar: 'https://picsum.photos/seed/chef-alexandra/100/100',
    specialty: 'Italian Cuisine',
    bio: 'Passionate about Italian cuisine and fresh ingredients',
    cateringBio: 'Specializing in authentic Italian cuisine for weddings and special events',
    cateringLocation: '06360',
    cateringRadius: 50,
    cateringAvailable: true,
    rating: 4.8,
    reviewCount: 47,
    priceRange: '$$$',
    minOrder: 10,
    specialties: ['Wedding Catering', 'Corporate Events', 'Private Dining'],
    sampleMenus: ['Italian Wedding Menu', 'Corporate Lunch Package', 'Romantic Dinner for Two']
  },
  {
    id: 'user-2',
    displayName: 'Chef Marcus',
    avatar: 'https://picsum.photos/seed/chef-marcus/100/100',
    specialty: 'Seafood',
    bio: 'Seafood specialist | Sustainable cooking advocate',
    cateringBio: 'Fresh seafood and sustainable cooking for corporate events',
    cateringLocation: '06360',
    cateringRadius: 25,
    cateringAvailable: true,
    rating: 4.6,
    reviewCount: 32,
    priceRange: '$$$$',
    minOrder: 15,
    specialties: ['Corporate Catering', 'Sustainable Cuisine', 'Seafood Specialties'],
    sampleMenus: ['Executive Lunch Menu', 'Sustainable Seafood Platter', 'Corporate Meeting Package']
  },
  {
    id: 'user-4',
    displayName: 'Chef Maria',
    avatar: 'https://picsum.photos/seed/chefmaria/100/100',
    specialty: 'Italian Pasta',
    bio: 'Fresh pasta and authentic Italian recipes',
    cateringBio: 'Handmade pasta catering for intimate gatherings',
    cateringLocation: '06360',
    cateringRadius: 30,
    cateringAvailable: true,
    rating: 4.9,
    reviewCount: 28,
    priceRange: '$$',
    minOrder: 8,
    specialties: ['Intimate Gatherings', 'Pasta Bar', 'Italian Classics'],
    sampleMenus: ['Fresh Pasta Bar', 'Italian Family Style', 'Date Night Package']
  },
  {
    id: 'user-6',
    displayName: 'Veggie Vibes',
    avatar: 'https://picsum.photos/seed/veggievibes/100/100',
    specialty: 'Plant-Based',
    bio: 'Plant-based nutrition and colorful meals',
    cateringBio: 'Healthy plant-based catering for events',
    cateringLocation: '06360',
    cateringRadius: 40,
    cateringAvailable: true,
    rating: 4.7,
    reviewCount: 35,
    priceRange: '$$$',
    minOrder: 12,
    specialties: ['Healthy Catering', 'Vegan Events', 'Corporate Wellness'],
    sampleMenus: ['Rainbow Buddha Bowl Bar', 'Vegan Corporate Package', 'Wellness Retreat Menu']
  },
  {
    id: 'user-7',
    displayName: 'Dessert Queen',
    avatar: 'https://picsum.photos/seed/dessertqueen/100/100',
    specialty: 'Desserts & Sweets',
    bio: 'Decadent desserts and sweet creations',
    cateringBio: 'Custom dessert catering and wedding cakes',
    cateringLocation: '06360',
    cateringRadius: 35,
    cateringAvailable: true,
    rating: 4.9,
    reviewCount: 42,
    priceRange: '$$',
    minOrder: 6,
    specialties: ['Wedding Desserts', 'Custom Cakes', 'Dessert Bars'],
    sampleMenus: ['Wedding Dessert Table', 'Birthday Cake Package', 'Corporate Sweet Treats']
  }
];

interface CateringBookingForm {
  eventDate: Date | undefined;
  eventType: string;
  guestCount: string;
  eventLocation: string;
  additionalNotes: string;
  contactEmail: string;
  contactPhone: string;
}

export function CateringMarketplace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState('all');
  const [userZipCode, setUserZipCode] = useState(''); // New state for user zip code
  const [bookingForm, setBookingForm] = useState<CateringBookingForm>({
    eventDate: undefined,
    eventType: '',
    guestCount: '',
    eventLocation: '',
    additionalNotes: '',
    contactEmail: '',
    contactPhone: ''
  });

  // Simplified distance check: assumes chefs are available if zip codes match or are within a "range"
  const isWithinRadius = (chefZip: string, userZip: string, radius: number) => {
    if (!userZip) return true; // Show all if no zip entered
    return chefZip === userZip || Math.abs(parseInt(chefZip) - parseInt(userZip)) <= radius / 10; // Rough approximation
  };

  const filteredChefs = mockCateringChefs.filter(chef => {
    const matchesSearch = chef.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         chef.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialty = selectedSpecialty === 'all' || chef.specialty.toLowerCase().includes(selectedSpecialty.toLowerCase());
    const matchesPriceRange = selectedPriceRange === 'all' || chef.priceRange === selectedPriceRange;
    const matchesRadius = isWithinRadius(chef.cateringLocation, userZipCode, chef.cateringRadius);
    
    return matchesSearch && matchesSpecialty && matchesPriceRange && matchesRadius && chef.cateringAvailable;
  });

  const handleBookingSubmit = (chefId: string) => {
    console.log('Booking submitted for chef:', chefId, bookingForm);
    alert('Catering request submitted! The chef will contact you soon.');
    
    setBookingForm({
      eventDate: undefined,
      eventType: '',
      guestCount: '',
      eventLocation: '',
      additionalNotes: '',
      contactEmail: '',
      contactPhone: ''
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Catering Services</h1>
        <p className="text-gray-600">Book professional chefs for your events and special occasions</p>
      </div>

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
              maxLength={5}
            />
          </div>

          <Button className="w-full">
            <Filter className="w-4 h-4 mr-2" />
            Apply Filters
          </Button>
        </div>
      </div>

      {/* Chef Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredChefs.map((chef) => (
          <Card key={chef.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start space-x-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={chef.avatar} alt={chef.displayName} />
                  <AvatarFallback>{chef.displayName[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-lg">{chef.displayName}</CardTitle>
                  <p className="text-sm text-gray-600 mb-2">{chef.specialty}</p>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                      <SpoonRating rating={chef.rating} />
                      <span className="text-sm">{chef.rating}</span>
                      <span className="text-sm text-gray-500">({chef.reviewCount} reviews)</span>
                    </div>
                    <Badge variant="outline">{chef.priceRange}</Badge>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">{chef.cateringBio}</p>
              
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mr-2" />
                  <span>Services within {chef.cateringRadius} miles of {chef.cateringLocation}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="w-4 h-4 mr-2" />
                  <span>Minimum {chef.minOrder} guests</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Specialties:</Label>
                <div className="flex flex-wrap gap-1">
                  {chef.specialties.map((specialty) => (
                    <Badge key={specialty} variant="secondary" className="text-xs">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Sample Menus:</Label>
                <ul className="text-sm text-gray-600 space-y-1">
                  {chef.sampleMenus.slice(0, 2).map((menu) => (
                    <li key={menu} className="flex items-center">
                      <ChefHat className="w-3 h-3 mr-2 text-gray-400" />
                      {menu}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex space-x-2 pt-4">
                <Dialog>
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
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Event Type</Label>
                          <Select value={bookingForm.eventType} onValueChange={(value) => 
                            setBookingForm({...bookingForm, eventType: value})
                          }>
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
                            value={bookingForm.guestCount}
                            onChange={(e) => setBookingForm({...bookingForm, guestCount: e.target.value})}
                            min={chef.minOrder}
                          />
                          <p className="text-xs text-gray-500 mt-1">Minimum {chef.minOrder} guests</p>
                        </div>
                      </div>

                      <div>
                        <Label>Event Location</Label>
                        <Input
                          placeholder="Event address or venue"
                          value={bookingForm.eventLocation}
                          onChange={(e) => setBookingForm({...bookingForm, eventLocation: e.target.value})}
                        />
                        <p className="text-xs text-gray-500 mt-1">Must be within {chef.cateringRadius} miles of {chef.cateringLocation}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Contact Email</Label>
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            value={bookingForm.contactEmail}
                            onChange={(e) => setBookingForm({...bookingForm, contactEmail: e.target.value})}
                          />
                        </div>
                        
                        <div>
                          <Label>Contact Phone</Label>
                          <Input
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={bookingForm.contactPhone}
                            onChange={(e) => setBookingForm({...bookingForm, contactPhone: e.target.value})}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Event Date</Label>
                        <div className="mt-2">
                          <Calendar
                            mode="single"
                            selected={bookingForm.eventDate}
                            onSelect={(date) => setBookingForm({...bookingForm, eventDate: date})}
                            disabled={(date) => date < new Date()}
                            className="rounded-md border"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Additional Notes</Label>
                        <Textarea
                          placeholder="Dietary restrictions, menu preferences, special requests..."
                          value={bookingForm.additionalNotes}
                          onChange={(e) => setBookingForm({...bookingForm, additionalNotes: e.target.value})}
                          rows={4}
                        />
                      </div>

                      <Button 
                        onClick={() => handleBookingSubmit(chef.id)}
                        className="w-full"
                        disabled={!bookingForm.eventDate || !bookingForm.eventType || !bookingForm.guestCount || !bookingForm.contactEmail}
                      >
                        Submit Catering Request
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
        ))}
      </div>

      {filteredChefs.length === 0 && (
        <div className="text-center py-12">
          <ChefHat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No chefs found</h3>
          <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
        </div>
      )}
    </div>
  );
}

export default CateringMarketplace;

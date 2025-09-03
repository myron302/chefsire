import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share, Eye, Clock, ChevronLeft, ChevronRight, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface Bite {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: {
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
  };
  caption: string;
  timestamp: Date;
  duration: number; // in seconds for auto-advance
  views: number;
  likes: number;
  isLiked: boolean;
  tags: string[];
}

interface Story {
  userId: string;
  username: string;
  avatar: string;
  bites: Bite[];
  hasNewBites: boolean;
  isViewed: boolean;
}

// Mock data - replace with real API calls
const mockStories: Story[] = [
  {
    userId: '1',
    username: 'chefmaria',
    avatar: '/api/placeholder/40/40',
    hasNewBites: true,
    isViewed: false,
    bites: [
      {
        id: '1',
        userId: '1',
        username: 'chefmaria',
        avatar: '/api/placeholder/40/40',
        content: {
          type: 'image',
          url: '/api/placeholder/400/600'
        },
        caption: '🍝 Fresh pasta making process! Swipe to see the magic happen',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        duration: 5,
        views: 127,
        likes: 23,
        isLiked: false,
        tags: ['pasta', 'homemade', 'italian']
      },
      {
        id: '2',
        userId: '1',
        username: 'chefmaria',
        avatar: '/api/placeholder/40/40',
        content: {
          type: 'image',
          url: '/api/placeholder/400/600'
        },
        caption: 'The final result! Nothing beats fresh pasta 😋',
        timestamp: new Date('2024-01-15T10:35:00Z'),
        duration: 5,
        views: 98,
        likes: 31,
        isLiked: true,
        tags: ['pasta', 'delicious', 'foodie']
      }
    ]
  },
  {
    userId: '2',
    username: 'bakerben',
    avatar: '/api/placeholder/40/40',
    hasNewBites: false,
    isViewed: true,
    bites: [
      {
        id: '3',
        userId: '2',
        username: 'bakerben',
        avatar: '/api/placeholder/40/40',
        content: {
          type: 'image',
          url: '/api/placeholder/400/600'
        },
        caption: '🥖 Early morning bread prep. The smell is incredible!',
        timestamp: new Date('2024-01-15T06:00:00Z'),
        duration: 4,
        views: 234,
        likes: 67,
        isLiked: false,
        tags: ['bread', 'baking', 'morning']
      }
    ]
  },
  {
    userId: '3',
    username: 'veggievibes',
    avatar: '/api/placeholder/40/40',
    hasNewBites: true,
    isViewed: false,
    bites: [
      {
        id: '4',
        userId: '3',
        username: 'veggievibes',
        avatar: '/api/placeholder/40/40',
        content: {
          type: 'image',
          url: '/api/placeholder/400/600'
        },
        caption: 'Rainbow veggie prep for the week! 🌈 Meal prep Sunday done right',
        timestamp: new Date('2024-01-14T15:20:00Z'),
        duration: 6,
        views: 89,
        likes: 42,
        isLiked: true,
        tags: ['mealprep', 'vegetables', 'healthy']
      }
    ]
  }
];

function Bites() {
  const [stories, setStories] = useState<Story[]>(mockStories);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [currentBiteIndex, setCurrentBiteIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-advance bites
  useEffect(() => {
    if (!selectedStory || isPaused) return;

    const currentBite = selectedStory.bites[currentBiteIndex];
    const interval = setInterval(() => {
      setProgress((prev) => {
        const increment = 100 / (currentBite.duration * 10);
        const newProgress = prev + increment;
        
        if (newProgress >= 100) {
          handleNextBite();
          return 0;
        }
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [selectedStory, currentBiteIndex, isPaused]);

  const openStory = (story: Story) => {
    setSelectedStory(story);
    setCurrentBiteIndex(0);
    setProgress(0);
    
    // Mark story as viewed
    setStories(prev => prev.map(s => 
      s.userId === story.userId ? { ...s, isViewed: true, hasNewBites: false } : s
    ));
  };

  const closeStory = () => {
    setSelectedStory(null);
    setCurrentBiteIndex(0);
    setProgress(0);
  };

  const handleNextBite = () => {
    if (!selectedStory) return;
    
    if (currentBiteIndex < selectedStory.bites.length - 1) {
      setCurrentBiteIndex(prev => prev + 1);
      setProgress(0);
    } else {
      closeStory();
    }
  };

  const handlePrevBite = () => {
    if (currentBiteIndex > 0) {
      setCurrentBiteIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  const handleLike = (biteId: string) => {
    if (!selectedStory) return;
    
    const updatedBites = selectedStory.bites.map(bite =>
      bite.id === biteId 
        ? { ...bite, isLiked: !bite.isLiked, likes: bite.isLiked ? bite.likes - 1 : bite.likes + 1 }
        : bite
    );
    
    setSelectedStory({ ...selectedStory, bites: updatedBites });
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Stories Grid */}
      {!selectedStory && (
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Bites</h1>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Bite
            </Button>
          </div>
          
          {/* Stories Row */}
          <div className="flex space-x-4 mb-8 overflow-x-auto pb-4">
            {stories.map((story) => (
              <div
                key={story.userId}
                className="flex-shrink-0 cursor-pointer group"
                onClick={() => openStory(story)}
              >
                <div className={`relative p-1 rounded-full ${
                  story.hasNewBites ? 'bg-gradient-to-tr from-orange-400 to-pink-600' : 'bg-gray-300'
                }`}>
                  <Avatar className="w-16 h-16 border-2 border-white">
                    <AvatarImage src={story.avatar} />
                    <AvatarFallback>{story.username[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {story.hasNewBites && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{story.bites.length}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-center mt-2 max-w-[70px] truncate">
                  {story.username}
                </p>
              </div>
            ))}
          </div>

          {/* Recent Bites Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {stories.flatMap(story => story.bites).map((bite) => (
              <div key={bite.id} className="relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer group">
                <img 
                  src={bite.content.url} 
                  alt={bite.caption}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={bite.avatar} />
                      <AvatarFallback>{bite.username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-white text-sm font-medium">{bite.username}</span>
                  </div>
                  <p className="text-white text-xs line-clamp-2">{bite.caption}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-3 text-white text-xs">
                      <div className="flex items-center space-x-1">
                        <Eye className="w-3 h-3" />
                        <span>{bite.views}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Heart className="w-3 h-3" />
                        <span>{bite.likes}</span>
                      </div>
                    </div>
                    <span className="text-white text-xs">{formatTimeAgo(bite.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Story Viewer */}
      {selectedStory && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          {/* Progress bars */}
          <div className="absolute top-4 left-4 right-4 flex space-x-1 z-10">
            {selectedStory.bites.map((_, index) => (
              <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{
                    width: index === currentBiteIndex ? `${progress}%` : index < currentBiteIndex ? '100%' : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 left-4 right-4 flex items-center justify-between z-10 mt-6">
            <div className="flex items-center space-x-3">
              <Avatar className="w-10 h-10 border-2 border-white">
                <AvatarImage src={selectedStory.avatar} />
                <AvatarFallback>{selectedStory.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white font-medium">{selectedStory.username}</p>
                <p className="text-white/70 text-sm">
                  {formatTimeAgo(selectedStory.bites[currentBiteIndex].timestamp)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={closeStory}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation areas */}
          <div className="absolute inset-0 flex">
            <div className="flex-1 cursor-pointer" onClick={handlePrevBite} />
            <div 
              className="flex-1 cursor-pointer" 
              onClick={handleNextBite}
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onMouseLeave={() => setIsPaused(false)}
            />
          </div>

          {/* Content */}
          <div className="relative w-full max-w-md mx-auto aspect-[9/16]">
            <img 
              src={selectedStory.bites[currentBiteIndex].content.url}
              alt={selectedStory.bites[currentBiteIndex].caption}
              className="w-full h-full object-cover rounded-lg"
            />
            
            {/* Caption and actions */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-start justify-between mb-2">
                <p className="text-white text-sm flex-1 mr-4">
                  {selectedStory.bites[currentBiteIndex].caption}
                </p>
                <div className="flex flex-col items-center space-y-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => handleLike(selectedStory.bites[currentBiteIndex].id)}
                  >
                    <Heart 
                      className={`w-6 h-6 ${
                        selectedStory.bites[currentBiteIndex].isLiked 
                          ? 'fill-red-500 text-red-500' 
                          : 'text-white'
                      }`} 
                    />
                  </Button>
                  <span className="text-white text-xs">
                    {selectedStory.bites[currentBiteIndex].likes}
                  </span>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                  >
                    <MessageCircle className="w-6 h-6" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                  >
                    <Share className="w-6 h-6" />
                  </Button>
                </div>
              </div>
              
              {/* Tags */}
              {selectedStory.bites[currentBiteIndex].tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedStory.bites[currentBiteIndex].tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs bg-white/20 text-white border-none">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Navigation arrows (desktop) */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex"
            onClick={handlePrevBite}
            disabled={currentBiteIndex === 0}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex"
            onClick={handleNextBite}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default Bites;

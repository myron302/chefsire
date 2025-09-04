import { useState, useEffect } from "react";
import { Heart, MessageCircle, Share, Eye, Clock, ChevronLeft, ChevronRight, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Bite {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: {
    type: "image" | "video";
    url: string;
    thumbnail?: string;
  };
  caption: string;
  timestamp: Date;
  duration: number;
  views: number;
  likes: number;
  isLiked: boolean;
  tags: string[];
}

interface UserBites {
  userId: string;
  username: string;
  avatar: string;
  bites: Bite[];
  hasNewBites: boolean;
  isViewed: boolean;
}

// Updated mock data with seed-aligned URLs
const mockUserBites: UserBites[] = [
  {
    userId: "1",
    username: "chefmaria",
    avatar: "https://images.unsplash.com/photo-1505576399279-568717e7e7f0?crop=faces&fit=crop&w=60&h=60",
    hasNewBites: true,
    isViewed: false,
    bites: [
      {
        id: "1",
        userId: "1",
        username: "chefmaria",
        avatar: "https://images.unsplash.com/photo-1505576399279-568717e7e7f0?crop=faces&fit=crop&w=40&h=40",
        content: { type: "image", url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=400&h=600" },
        caption: "🍝 Fresh pasta making process!",
        timestamp: new Date("2024-01-15T10:30:00Z"),
        duration: 5,
        views: 127,
        likes: 23,
        isLiked: false,
        tags: ["pasta", "homemade", "italian"],
      },
      {
        id: "2",
        userId: "1",
        username: "chefmaria",
        avatar: "https://images.unsplash.com/photo-1505576399279-568717e7e7f0?crop=faces&fit=crop&w=40&h=40",
        content: { type: "image", url: "https://images.unsplash.com/photo-1547592166-23ac421f4e1b?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=400&h=600" },
        caption: "The final result! Nothing beats fresh pasta 😋",
        timestamp: new Date("2024-01-15T10:35:00Z"),
        duration: 5,
        views: 98,
        likes: 31,
        isLiked: true,
        tags: ["pasta", "delicious", "foodie"],
      },
    ],
  },
  {
    userId: "2",
    username: "bakerben",
    avatar: "https://images.unsplash.com/photo-1505576399279-568717e7e7f0?crop=faces&fit=crop&w=60&h=60",
    hasNewBites: false,
    isViewed: true,
    bites: [
      {
        id: "3",
        userId: "2",
        username: "bakerben",
        avatar: "https://images.unsplash.com/photo-1505576399279-568717e7e7f0?crop=faces&fit=crop&w=40&h=40",
        content: { type: "image", url: "https://images.unsplash.com/photo-1546548970-717b2486a8aa?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=400&h=600" },
        caption: "🥖 Early morning bread prep",
        timestamp: new Date("2024-01-15T06:00:00Z"),
        duration: 4,
        views: 234,
        likes: 67,
        isLiked: false,
        tags: ["bread", "baking"],
      },
    ],
  },
  {
    userId: "3",
    username: "veggievibes",
    avatar: "https://images.unsplash.com/photo-1505576399279-568717e7e7f0?crop=faces&fit=crop&w=60&h=60",
    hasNewBites: true,
    isViewed: false,
    bites: [
      {
        id: "4",
        userId: "3",
        username: "veggievibes",
        avatar: "https://images.unsplash.com/photo-1505576399279-568717e7e7f0?crop=faces&fit=crop&w=40&h=40",
        content: { type: "image", url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=400&h=600" },
        caption: "Rainbow veggie prep! 🌈",
        timestamp: new Date("2024-01-14T15:20:00Z"),
        duration: 6,
        views: 89,
        likes: 42,
        isLiked: true,
        tags: ["mealprep", "vegetables"],
      },
    ],
  },
  {
    userId: "4",
    username: "dessertqueen",
    avatar: "https://images.unsplash.com/photo-1505576399279-568717e7e7f0?crop=faces&fit=crop&w=60&h=60",
    hasNewBites: true,
    isViewed: false,
    bites: [
      {
        id: "5",
        userId: "4",
        username: "dessertqueen",
        avatar: "https://images.unsplash.com/photo-1505576399279-568717e7e7f0?crop=faces&fit=crop&w=40&h=40",
        content: { type: "image", url: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=400&h=600" },
        caption: "Chocolate soufflé perfection ✨",
        timestamp: new Date("2024-01-15T14:20:00Z"),
        duration: 4,
        views: 156,
        likes: 78,
        isLiked: false,
        tags: ["dessert", "chocolate"],
      },
    ],
  },
];

interface BitesRowProps {
  className?: string;
}

export function BitesRow({ className = "" }: BitesRowProps) {
  const [userBites, setUserBites] = useState<UserBites[]>(mockUserBites);
  const [isViewing, setIsViewing] = useState(false);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [currentBiteIndex, setCurrentBiteIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentUser = userBites[currentUserIndex];
  const currentBite = currentUser?.bites[currentBiteIndex];

  // Auto-advance bites
  useEffect(() => {
    if (!isViewing || isPaused || !currentBite) return;

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
  }, [isViewing, currentUserIndex, currentBiteIndex, isPaused, currentBite]);

  const openUserBites = (userBite: UserBites) => {
    const userIndex = userBites.findIndex((ub) => ub.userId === userBite.userId);
    setCurrentUserIndex(userIndex);
    setCurrentBiteIndex(0);
    setIsViewing(true);
    setProgress(0);

    markUserAsViewed(userBite.userId);
  };

  const closeBites = () => {
    setIsViewing(false);
    setCurrentUserIndex(0);
    setCurrentBiteIndex(0);
    setProgress(0);
  };

  const handleNextBite = () => {
    if (!currentUser) return;

    if (currentBiteIndex < currentUser.bites.length - 1) {
      setCurrentBiteIndex((prev) => prev + 1);
      setProgress(0);
    } else if (currentUserIndex < userBites.length - 1) {
      const nextUserIndex = currentUserIndex + 1;
      setCurrentUserIndex(nextUserIndex);
      setCurrentBiteIndex(0);
      setProgress(0);

      markUserAsViewed(userBites[nextUserIndex].userId);
    } else {
      closeBites();
    }
  };

  const handlePrevBite = () => {
    if (currentBiteIndex > 0) {
      setCurrentBiteIndex((prev) => prev - 1);
      setProgress(0);
    } else if (currentUserIndex > 0) {
      const prevUserIndex = currentUserIndex - 1;
      const prevUser = userBites[prevUserIndex];
      setCurrentUserIndex(prevUserIndex);
      setCurrentBiteIndex(prevUser.bites.length - 1);
      setProgress(0);
    }
  };

  const markUserAsViewed = (userId: string) => {
    setUserBites((prev) =>
      prev.map((ub) =>
        ub.userId === userId ? { ...ub, isViewed: true, hasNewBites: false } : ub
      )
    );
  };

  const handleLike = (biteId: string) => {
    setUserBites((prev) =>
      prev.map((user) => ({
        ...user,
        bites: user.bites.map((bite) =>
          bite.id === biteId
            ? { ...bite, isLiked: !bite.isLiked, likes: bite.isLiked ? bite.likes - 1 : bite.likes + 1 }
            : bite
        ),
      }))
    );
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <>
      {/* Bites Row */}
      <div className={`bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 ${className}`}>
        <div className="container mx-auto px-4 py-4">
          <h2 className="text-orange-500 text-lg font-bold mb-4 flex items-center">
            {/* Replace crown with new logo */}
            <img src="https://example.com/new-logo.png" alt="Chefsire Logo" className="h-6 w-auto mr-2" />
            Chef's Corner - Quick Bites
          </h2>
          <div className="flex items-center space-x-4 overflow-x-auto pb-2 scrollbar-hide">
            {/* Your Bite (Create) */}
            <div className="flex-shrink-0 cursor-pointer group">
              <div className="relative">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center group-hover:border-primary transition-colors">
                  <Plus className="w-6 h-6 text-gray-400 group-hover:text-primary" />
                </div>
              </div>
              <p className="text-xs text-center mt-2 max-w-[70px] truncate text-gray-600 dark:text-gray-400">
                Your bite
              </p>
            </div>

            {/* Other User Bites */}
            {userBites.map((userBite) => (
              <div
                key={userBite.userId}
                className="flex-shrink-0 cursor-pointer group"
                onClick={() => openUserBites(userBite)}
              >
                <div className={`relative p-0.5 rounded-full ${
                  userBite.hasNewBites
                    ? "bg-gradient-to-tr from-orange-400 via-red-500 to-pink-600"
                    : userBite.isViewed
                    ? "bg-gray-300 dark:bg-gray-600"
                    : "bg-gradient-to-tr from-orange-400 via-red-500 to-pink-600"
                }`}>
                  <Avatar className="w-16 h-16 border-2 border-white dark:border-gray-900">
                    <AvatarImage src={userBite.avatar} alt={userBite.username} />
                    <AvatarFallback>{userBite.username[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {userBite.hasNewBites && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{userBite.bites.length}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-center mt-2 max-w-[70px] truncate text-gray-700 dark:text-gray-300">
                  {userBite.username}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bite Viewer Modal */}
      {isViewing && currentBite && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          {/* Progress bars - only for CURRENT user's bites */}
          <div className="absolute top-4 left-4 right-4 flex space-x-1 z-10">
            {currentUser.bites.map((_, index) => (
              <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{
                    width: index === currentBiteIndex ? `${progress}%` : index < currentBiteIndex ? "100%" : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 left-4 right-4 flex items-center justify-between z-10 mt-6">
            <div className="flex items-center space-x-3">
              <Avatar className="w-10 h-10 border-2 border-white">
                <AvatarImage src={currentBite.avatar} />
                <AvatarFallback>{currentBite.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white font-medium">{currentBite.username}</p>
                <p className="text-white/70 text-sm">{formatTimeAgo(currentBite.timestamp)}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={closeBites}
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

          {/* Navigation arrows (desktop) */}
          {(currentUserIndex > 0 || currentBiteIndex > 0) && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex z-20"
              onClick={handlePrevBite}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex z-20"
            onClick={handleNextBite}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
          <div className="relative w-full max-w-md mx-auto aspect-[9/16]">
            <img
              src={currentBite.content.url}
              alt={currentBite.caption}
              className="w-full h-full object-cover rounded-lg"
            />

            {/* Caption and actions */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-start justify-between mb-2">
                <p className="text-white text-sm flex-1 mr-4">{currentBite.caption}</p>
                <div className="flex flex-col items-center space-y-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => handleLike(currentBite.id)}
                  >
                    <Heart
                      className={`w-6 h-6 ${
                        currentBite.isLiked ? "fill-red-500 text-red-500" : "text-white"
                      }`}
                    />
                  </Button>
                  <span className="text-white text-xs">{currentBite.likes}</span>

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
              {currentBite.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {currentBite.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs bg-white/20 text-white border-none"
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BitesRow;

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Search, ChefHat } from "lucide-react";

interface User {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  specialty?: string;
  isChef: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
}

export default function UserSearchResults() {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setUsers([]);
        setHasSearched(false);
        return;
      }

      setIsLoading(true);
      setHasSearched(true);
      try {
        const response = await fetch(
          `/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`
        );
        const data = await response.json();
        setUsers(data.users || []);
      } catch (error) {
        console.error("User search error:", error);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder="Search for chefs and users..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Searching for users...
        </div>
      ) : hasSearched && users.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No users found for "{searchQuery}"
        </div>
      ) : users.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <Link key={user.id} href={`/profile/${user.username}`}>
              <div className="border rounded-lg p-4 hover:bg-muted transition-colors cursor-pointer">
                <div className="flex items-start space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.avatar} alt={user.displayName} />
                    <AvatarFallback>
                      {user.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">
                        {user.displayName}
                      </h3>
                      {user.isChef && (
                        <ChefHat className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      @{user.username}
                    </p>
                    {user.specialty && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {user.specialty}
                      </p>
                    )}
                    {user.bio && (
                      <p className="text-sm mt-2 line-clamp-2">{user.bio}</p>
                    )}
                    <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                      <span>{user.followersCount} followers</span>
                      <span>{user.postsCount} posts</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Start typing to search for chefs and users
        </div>
      )}
    </div>
  );
}

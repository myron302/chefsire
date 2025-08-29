import { 
  type User, 
  type InsertUser, 
  type Post, 
  type InsertPost,
  type Recipe,
  type InsertRecipe,
  type Story,
  type InsertStory,
  type Like,
  type InsertLike,
  type Comment,
  type InsertComment,
  type Follow,
  type InsertFollow,
  type PostWithUser,
  type StoryWithUser,
  type CommentWithUser
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getSuggestedUsers(userId: string, limit?: number): Promise<User[]>;

  // Posts
  getPost(id: string): Promise<Post | undefined>;
  getPostWithUser(id: string): Promise<PostWithUser | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: string, updates: Partial<Post>): Promise<Post | undefined>;
  deletePost(id: string): Promise<boolean>;
  getFeedPosts(userId: string, offset?: number, limit?: number): Promise<PostWithUser[]>;
  getUserPosts(userId: string, offset?: number, limit?: number): Promise<PostWithUser[]>;
  getExplorePosts(offset?: number, limit?: number): Promise<PostWithUser[]>;

  // Recipes
  getRecipe(id: string): Promise<Recipe | undefined>;
  getRecipeByPostId(postId: string): Promise<Recipe | undefined>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe | undefined>;
  getTrendingRecipes(limit?: number): Promise<(Recipe & { post: PostWithUser })[]>;

  // Stories
  getStory(id: string): Promise<Story | undefined>;
  createStory(story: InsertStory): Promise<Story>;
  getActiveStories(userId: string): Promise<StoryWithUser[]>;
  getUserStories(userId: string): Promise<Story[]>;

  // Likes
  likePost(userId: string, postId: string): Promise<Like>;
  unlikePost(userId: string, postId: string): Promise<boolean>;
  isPostLiked(userId: string, postId: string): Promise<boolean>;
  getPostLikes(postId: string): Promise<Like[]>;

  // Comments
  getComment(id: string): Promise<Comment | undefined>;
  createComment(comment: InsertComment): Promise<Comment>;
  deleteComment(id: string): Promise<boolean>;
  getPostComments(postId: string): Promise<CommentWithUser[]>;

  // Follows
  followUser(followerId: string, followingId: string): Promise<Follow>;
  unfollowUser(followerId: string, followingId: string): Promise<boolean>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  getFollowers(userId: string): Promise<User[]>;
  getFollowing(userId: string): Promise<User[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private posts: Map<string, Post> = new Map();
  private recipes: Map<string, Recipe> = new Map();
  private stories: Map<string, Story> = new Map();
  private likes: Map<string, Like> = new Map();
  private comments: Map<string, Comment> = new Map();
  private follows: Map<string, Follow> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Create sample users
    const users = [
      {
        id: "user-1",
        username: "chef_alexandra",
        email: "alexandra@chefsire.com",
        password: "password123",
        displayName: "Chef Alexandra",
        bio: "Passionate about Italian cuisine and fresh ingredients",
        avatar: "https://images.unsplash.com/photo-1566554273541-37a9ca77b91f?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100",
        specialty: "Italian Cuisine",
        isChef: true,
        followersCount: 1200,
        followingCount: 150,
        postsCount: 45,
        createdAt: new Date("2024-01-15"),
      },
      {
        id: "user-2",
        username: "chef_marcus",
        email: "marcus@chefsire.com",
        password: "password123",
        displayName: "Chef Marcus",
        bio: "Seafood specialist | Sustainable cooking advocate",
        avatar: "https://images.unsplash.com/photo-1607631568010-a87245c0daf8?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100",
        specialty: "Seafood",
        isChef: true,
        followersCount: 890,
        followingCount: 200,
        postsCount: 38,
        createdAt: new Date("2024-02-01"),
      },
      {
        id: "user-3",
        username: "chef_isabella",
        email: "isabella@chefsire.com",
        password: "password123",
        displayName: "Chef Isabella",
        bio: "Dessert artisan creating sweet masterpieces",
        avatar: "https://pixabay.com/get/g18bcc24b4afeb9ecd5ba41b4339e33a82f5c269e32677d538c9bb32f66c3b5c5833b9d2bb9b080eacd53235b9d96f2c98e8f4fcb68022763f76cb0256e37be94_1280.jpg",
        specialty: "Pastry & Desserts",
        isChef: true,
        followersCount: 2100,
        followingCount: 95,
        postsCount: 52,
        createdAt: new Date("2024-01-20"),
      }
    ];

    users.forEach(user => this.users.set(user.id, user));

    // Create sample posts
    const posts = [
      {
        id: "post-1",
        userId: "user-1",
        caption: "Just perfected my grandmother's pasta recipe! 🍝 The secret is in the fresh basil and aged parmesan. Who wants the recipe?",
        imageUrl: "https://pixabay.com/get/gd43e0221aa0f6832a6c714b1f547d335bddb76ac2cd0a11d2c79c9ea20fd6b6525dd69b8727e1b2d9720166664b5df9dab650a8e7a9bdd9386cc6d056afcfb87_1280.jpg",
        tags: ["pasta", "italian", "homemade"],
        likesCount: 234,
        commentsCount: 12,
        isRecipe: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      {
        id: "post-2",
        userId: "user-2",
        caption: "Honey Glazed Salmon with Roasted Vegetables - perfect balance of flavors and nutrients!",
        imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
        tags: ["salmon", "healthy", "seafood"],
        likesCount: 156,
        commentsCount: 23,
        isRecipe: true,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      },
      {
        id: "post-3",
        userId: "user-3",
        caption: "Watch me create this decadent chocolate mousse! 🍫 The technique is everything - patience pays off! ✨",
        imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
        tags: ["dessert", "chocolate", "technique"],
        likesCount: 89,
        commentsCount: 7,
        isRecipe: false,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      }
    ];

    posts.forEach(post => this.posts.set(post.id, post));

    // Create sample recipe for post-2
    const recipe = {
      id: "recipe-1",
      postId: "post-2",
      title: "Honey Glazed Salmon with Roasted Vegetables",
      ingredients: [
        "4 salmon fillets",
        "2 tbsp honey",
        "1 tbsp soy sauce",
        "2 cloves garlic, minced",
        "Mixed vegetables (broccoli, carrots, bell peppers)",
        "Olive oil",
        "Salt and pepper to taste"
      ],
      instructions: [
        "Preheat oven to 400°F (200°C)",
        "Mix honey, soy sauce, and garlic for glaze",
        "Season salmon with salt and pepper",
        "Brush salmon with glaze",
        "Roast vegetables with olive oil for 15 minutes",
        "Add salmon to pan and bake for 12-15 minutes",
        "Serve immediately"
      ],
      cookTime: 30,
      servings: 4,
      difficulty: "Easy",
      nutrition: {
        calories: 350,
        protein: "28g",
        carbs: "15g",
        fat: "18g"
      }
    };

    this.recipes.set(recipe.id, recipe);

    // Create sample stories
    const stories = [
      {
        id: "story-1",
        userId: "user-1",
        imageUrl: "https://images.unsplash.com/photo-1595257841889-eca2678454e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&h=200",
        caption: "Making fresh pasta from scratch!",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      {
        id: "story-2",
        userId: "user-2",
        imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&h=200",
        caption: "Fresh bread cooling down",
        expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      }
    ];

    stories.forEach(story => this.stories.set(story.id, story));
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getSuggestedUsers(userId: string, limit = 5): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(user => user.id !== userId)
      .slice(0, limit);
  }

  // Post methods
  async getPost(id: string): Promise<Post | undefined> {
    return this.posts.get(id);
  }

  async getPostWithUser(id: string): Promise<PostWithUser | undefined> {
    const post = this.posts.get(id);
    if (!post) return undefined;
    
    const user = this.users.get(post.userId);
    if (!user) return undefined;

    const recipe = Array.from(this.recipes.values()).find(r => r.postId === post.id);
    
    return { ...post, user, recipe };
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const id = randomUUID();
    const post: Post = {
      ...insertPost,
      id,
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date(),
    };
    this.posts.set(id, post);
    
    // Update user's post count
    const user = this.users.get(insertPost.userId);
    if (user) {
      await this.updateUser(user.id, { postsCount: user.postsCount + 1 });
    }
    
    return post;
  }

  async updatePost(id: string, updates: Partial<Post>): Promise<Post | undefined> {
    const post = this.posts.get(id);
    if (!post) return undefined;
    
    const updatedPost = { ...post, ...updates };
    this.posts.set(id, updatedPost);
    return updatedPost;
  }

  async deletePost(id: string): Promise<boolean> {
    const post = this.posts.get(id);
    if (!post) return false;
    
    this.posts.delete(id);
    
    // Update user's post count
    const user = this.users.get(post.userId);
    if (user && user.postsCount > 0) {
      await this.updateUser(user.id, { postsCount: user.postsCount - 1 });
    }
    
    return true;
  }

  async getFeedPosts(userId: string, offset = 0, limit = 10): Promise<PostWithUser[]> {
    const allPosts = Array.from(this.posts.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(offset, offset + limit);
    
    const postsWithUsers: PostWithUser[] = [];
    
    for (const post of allPosts) {
      const user = this.users.get(post.userId);
      if (user) {
        const recipe = Array.from(this.recipes.values()).find(r => r.postId === post.id);
        postsWithUsers.push({ ...post, user, recipe });
      }
    }
    
    return postsWithUsers;
  }

  async getUserPosts(userId: string, offset = 0, limit = 10): Promise<PostWithUser[]> {
    const userPosts = Array.from(this.posts.values())
      .filter(post => post.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(offset, offset + limit);
    
    const user = this.users.get(userId);
    if (!user) return [];
    
    return userPosts.map(post => {
      const recipe = Array.from(this.recipes.values()).find(r => r.postId === post.id);
      return { ...post, user, recipe };
    });
  }

  async getExplorePosts(offset = 0, limit = 10): Promise<PostWithUser[]> {
    return this.getFeedPosts("", offset, limit); // For now, same as feed
  }

  // Recipe methods
  async getRecipe(id: string): Promise<Recipe | undefined> {
    return this.recipes.get(id);
  }

  async getRecipeByPostId(postId: string): Promise<Recipe | undefined> {
    return Array.from(this.recipes.values()).find(recipe => recipe.postId === postId);
  }

  async createRecipe(insertRecipe: InsertRecipe): Promise<Recipe> {
    const id = randomUUID();
    const recipe: Recipe = { ...insertRecipe, id };
    this.recipes.set(id, recipe);
    return recipe;
  }

  async updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe | undefined> {
    const recipe = this.recipes.get(id);
    if (!recipe) return undefined;
    
    const updatedRecipe = { ...recipe, ...updates };
    this.recipes.set(id, updatedRecipe);
    return updatedRecipe;
  }

  async getTrendingRecipes(limit = 5): Promise<(Recipe & { post: PostWithUser })[]> {
    const recipes = Array.from(this.recipes.values()).slice(0, limit);
    const trending: (Recipe & { post: PostWithUser })[] = [];
    
    for (const recipe of recipes) {
      const postWithUser = await this.getPostWithUser(recipe.postId);
      if (postWithUser) {
        trending.push({ ...recipe, post: postWithUser });
      }
    }
    
    return trending;
  }

  // Story methods
  async getStory(id: string): Promise<Story | undefined> {
    return this.stories.get(id);
  }

  async createStory(insertStory: InsertStory): Promise<Story> {
    const id = randomUUID();
    const story: Story = {
      ...insertStory,
      id,
      createdAt: new Date(),
    };
    this.stories.set(id, story);
    return story;
  }

  async getActiveStories(userId: string): Promise<StoryWithUser[]> {
    const now = new Date();
    const activeStories = Array.from(this.stories.values())
      .filter(story => new Date(story.expiresAt) > now)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const storiesWithUsers: StoryWithUser[] = [];
    
    for (const story of activeStories) {
      const user = this.users.get(story.userId);
      if (user) {
        storiesWithUsers.push({ ...story, user });
      }
    }
    
    return storiesWithUsers;
  }

  async getUserStories(userId: string): Promise<Story[]> {
    return Array.from(this.stories.values())
      .filter(story => story.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Like methods
  async likePost(userId: string, postId: string): Promise<Like> {
    const id = randomUUID();
    const like: Like = {
      id,
      userId,
      postId,
      createdAt: new Date(),
    };
    this.likes.set(id, like);
    
    // Update post like count
    const post = this.posts.get(postId);
    if (post) {
      await this.updatePost(postId, { likesCount: post.likesCount + 1 });
    }
    
    return like;
  }

  async unlikePost(userId: string, postId: string): Promise<boolean> {
    const like = Array.from(this.likes.values())
      .find(l => l.userId === userId && l.postId === postId);
    
    if (!like) return false;
    
    this.likes.delete(like.id);
    
    // Update post like count
    const post = this.posts.get(postId);
    if (post && post.likesCount > 0) {
      await this.updatePost(postId, { likesCount: post.likesCount - 1 });
    }
    
    return true;
  }

  async isPostLiked(userId: string, postId: string): Promise<boolean> {
    return Array.from(this.likes.values())
      .some(like => like.userId === userId && like.postId === postId);
  }

  async getPostLikes(postId: string): Promise<Like[]> {
    return Array.from(this.likes.values())
      .filter(like => like.postId === postId);
  }

  // Comment methods
  async getComment(id: string): Promise<Comment | undefined> {
    return this.comments.get(id);
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = randomUUID();
    const comment: Comment = {
      ...insertComment,
      id,
      createdAt: new Date(),
    };
    this.comments.set(id, comment);
    
    // Update post comment count
    const post = this.posts.get(insertComment.postId);
    if (post) {
      await this.updatePost(insertComment.postId, { commentsCount: post.commentsCount + 1 });
    }
    
    return comment;
  }

  async deleteComment(id: string): Promise<boolean> {
    const comment = this.comments.get(id);
    if (!comment) return false;
    
    this.comments.delete(id);
    
    // Update post comment count
    const post = this.posts.get(comment.postId);
    if (post && post.commentsCount > 0) {
      await this.updatePost(comment.postId, { commentsCount: post.commentsCount - 1 });
    }
    
    return true;
  }

  async getPostComments(postId: string): Promise<CommentWithUser[]> {
    const postComments = Array.from(this.comments.values())
      .filter(comment => comment.postId === postId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    const commentsWithUsers: CommentWithUser[] = [];
    
    for (const comment of postComments) {
      const user = this.users.get(comment.userId);
      if (user) {
        commentsWithUsers.push({ ...comment, user });
      }
    }
    
    return commentsWithUsers;
  }

  // Follow methods
  async followUser(followerId: string, followingId: string): Promise<Follow> {
    const id = randomUUID();
    const follow: Follow = {
      id,
      followerId,
      followingId,
      createdAt: new Date(),
    };
    this.follows.set(id, follow);
    
    // Update follower and following counts
    const follower = this.users.get(followerId);
    const following = this.users.get(followingId);
    
    if (follower) {
      await this.updateUser(followerId, { followingCount: follower.followingCount + 1 });
    }
    if (following) {
      await this.updateUser(followingId, { followersCount: following.followersCount + 1 });
    }
    
    return follow;
  }

  async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    const follow = Array.from(this.follows.values())
      .find(f => f.followerId === followerId && f.followingId === followingId);
    
    if (!follow) return false;
    
    this.follows.delete(follow.id);
    
    // Update follower and following counts
    const follower = this.users.get(followerId);
    const following = this.users.get(followingId);
    
    if (follower && follower.followingCount > 0) {
      await this.updateUser(followerId, { followingCount: follower.followingCount - 1 });
    }
    if (following && following.followersCount > 0) {
      await this.updateUser(followingId, { followersCount: following.followersCount - 1 });
    }
    
    return true;
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    return Array.from(this.follows.values())
      .some(follow => follow.followerId === followerId && follow.followingId === followingId);
  }

  async getFollowers(userId: string): Promise<User[]> {
    const followers = Array.from(this.follows.values())
      .filter(follow => follow.followingId === userId)
      .map(follow => this.users.get(follow.followerId))
      .filter((user): user is User => user !== undefined);
    
    return followers;
  }

  async getFollowing(userId: string): Promise<User[]> {
    const following = Array.from(this.follows.values())
      .filter(follow => follow.followerId === userId)
      .map(follow => this.users.get(follow.followingId))
      .filter((user): user is User => user !== undefined);
    
    return following;
  }
}

export const storage = new MemStorage();

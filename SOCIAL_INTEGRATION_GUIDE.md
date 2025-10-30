# Social Media Integration Implementation Guide

This document outlines the implementation plan for social login, post pulling, and cross-posting features.

## 1. Social Login Implementation

### 1.1 Required OAuth Providers
- **Facebook Login**: Use Facebook OAuth 2.0
- **Google Login**: Use Google OAuth 2.0
- **TikTok Login**: Use TikTok OAuth 2.0
- **Instagram Login**: Use Instagram Basic Display API

### 1.2 Database Schema Updates

Add to `shared/schema.ts`:

```typescript
export const socialAccounts = pgTable("social_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  provider: text("provider").notNull(), // 'facebook', 'google', 'tiktok', 'instagram'
  providerUserId: text("provider_user_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  profile: jsonb("profile").$type<{
    displayName?: string;
    email?: string;
    avatar?: string;
    username?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const importedPosts = pgTable("imported_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  socialAccountId: varchar("social_account_id").references(() => socialAccounts.id).notNull(),
  provider: text("provider").notNull(),
  providerPostId: text("provider_post_id").notNull(),
  postId: varchar("post_id").references(() => posts.id),
  importedAt: timestamp("imported_at").defaultNow(),
});
```

### 1.3 Environment Variables

Add to `.env`:

```bash
# Facebook OAuth
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_REDIRECT_URI=http://localhost:5000/api/auth/facebook/callback

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# TikTok OAuth
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
TIKTOK_REDIRECT_URI=http://localhost:5000/api/auth/tiktok/callback

# Instagram OAuth
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
INSTAGRAM_REDIRECT_URI=http://localhost:5000/api/auth/instagram/callback
```

### 1.4 Backend Routes

Create `server/routes/social-auth.ts`:

```typescript
import { Router } from "express";
import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
// Additional strategy imports...

const router = Router();

// Facebook OAuth
router.get("/auth/facebook", passport.authenticate("facebook", {
  scope: ["email", "public_profile", "user_posts"]
}));

router.get("/auth/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  (req, res) => {
    // Save social account connection
    res.redirect("/profile");
  }
);

// Google OAuth
router.get("/auth/google", passport.authenticate("google", {
  scope: ["email", "profile"]
}));

router.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/profile");
  }
);

// Similar routes for TikTok and Instagram...

export default router;
```

### 1.5 Frontend UI Component

Create `client/src/components/SocialLoginButtons.tsx`:

```typescript
import { Facebook, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SocialLoginButtons() {
  const handleSocialLogin = (provider: string) => {
    window.location.href = `/api/auth/${provider}`;
  };

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => handleSocialLogin("facebook")}
      >
        <Facebook className="w-4 h-4 mr-2" />
        Continue with Facebook
      </Button>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => handleSocialLogin("google")}
      >
        <Mail className="w-4 h-4 mr-2" />
        Continue with Google
      </Button>

      {/* Add TikTok and Instagram buttons */}
    </div>
  );
}
```

## 2. Pulling Posts from Social Media

### 2.1 Facebook Posts Import

```typescript
// server/services/facebook.service.ts
export class FacebookService {
  static async getPosts(userId: string, accessToken: string) {
    const url = `https://graph.facebook.com/v18.0/${userId}/posts`;
    const response = await fetch(`${url}?access_token=${accessToken}&fields=id,message,created_time,full_picture`);
    const data = await response.json();
    return data.data;
  }

  static async importPosts(userId: string, socialAccountId: string, posts: any[]) {
    // Transform and save posts to chefsire database
    for (const post of posts) {
      // Create post in posts table
      // Link in imported_posts table
    }
  }
}
```

### 2.2 Instagram Posts Import

```typescript
// server/services/instagram.service.ts
export class InstagramService {
  static async getMedia(userId: string, accessToken: string) {
    const url = `https://graph.instagram.com/me/media`;
    const response = await fetch(`${url}?access_token=${accessToken}&fields=id,caption,media_type,media_url,thumbnail_url,timestamp`);
    const data = await response.json();
    return data.data;
  }
}
```

### 2.3 TikTok Videos Import

```typescript
// server/services/tiktok.service.ts
export class TikTokService {
  static async getVideos(accessToken: string) {
    const url = "https://open-api.tiktok.com/video/list/";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: ["id", "title", "video_description", "cover_image_url", "share_url"]
      })
    });
    const data = await response.json();
    return data.data.videos;
  }
}
```

### 2.4 Import UI Component

Create `client/src/components/ImportSocialPosts.tsx`:

```typescript
export function ImportSocialPosts() {
  const [importing, setImporting] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);

  const handleImport = async (provider: string) => {
    setImporting(true);
    try {
      const response = await fetch(`/api/social/${provider}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: selectedPosts })
      });
      if (response.ok) {
        // Success notification
      }
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Your Posts</CardTitle>
        <CardDescription>
          Select posts from your social media accounts to import
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Display posts from connected accounts */}
        {/* Checkbox selection */}
        <Button onClick={() => handleImport("facebook")} disabled={importing}>
          {importing ? "Importing..." : "Import Selected Posts"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

## 3. Cross-Posting to Social Media

### 3.1 Facebook Cross-Post

```typescript
// server/services/facebook.service.ts
export class FacebookService {
  static async createPost(userId: string, accessToken: string, data: {
    message: string;
    imageUrl?: string;
    videoUrl?: string;
  }) {
    const url = `https://graph.facebook.com/v18.0/${userId}/photos`;

    const formData = new FormData();
    formData.append("message", data.message);
    formData.append("access_token", accessToken);

    if (data.imageUrl) {
      formData.append("url", data.imageUrl);
    }

    const response = await fetch(url, {
      method: "POST",
      body: formData
    });

    return await response.json();
  }
}
```

### 3.2 Instagram Cross-Post

```typescript
// server/services/instagram.service.ts
export class InstagramService {
  static async createPost(userId: string, accessToken: string, data: {
    imageUrl: string;
    caption: string;
  }) {
    // Step 1: Create media container
    const containerUrl = `https://graph.facebook.com/v18.0/${userId}/media`;
    const containerResponse = await fetch(containerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: data.imageUrl,
        caption: data.caption,
        access_token: accessToken
      })
    });
    const containerData = await containerResponse.json();

    // Step 2: Publish container
    const publishUrl = `https://graph.facebook.com/v18.0/${userId}/media_publish`;
    const publishResponse = await fetch(publishUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: accessToken
      })
    });

    return await publishResponse.json();
  }
}
```

### 3.3 TikTok Cross-Post

```typescript
// server/services/tiktok.service.ts
export class TikTokService {
  static async uploadVideo(accessToken: string, data: {
    videoUrl: string;
    title: string;
    description: string;
  }) {
    // TikTok requires chunked upload
    const initUrl = "https://open-api.tiktok.com/share/video/upload/";

    const response = await fetch(initUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        video: {
          video_url: data.videoUrl
        },
        post_info: {
          title: data.title,
          description: data.description,
          privacy_level: "PUBLIC_TO_EVERYONE"
        }
      })
    });

    return await response.json();
  }
}
```

### 3.4 Cross-Post UI Component

Create `client/src/components/CrossPostSelector.tsx`:

```typescript
export function CrossPostSelector({ postId }: { postId: string }) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  const handleCrossPost = async () => {
    setPosting(true);
    try {
      const response = await fetch("/api/social/cross-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          platforms: selectedPlatforms
        })
      });

      if (response.ok) {
        // Success notification
      }
    } catch (error) {
      console.error("Cross-post failed:", error);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Share to:</h3>
      <div className="space-y-2">
        <Checkbox
          id="facebook"
          checked={selectedPlatforms.includes("facebook")}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedPlatforms([...selectedPlatforms, "facebook"]);
            } else {
              setSelectedPlatforms(selectedPlatforms.filter(p => p !== "facebook"));
            }
          }}
        />
        <label htmlFor="facebook">Facebook</label>
        {/* Repeat for Instagram, TikTok */}
      </div>
      <Button onClick={handleCrossPost} disabled={posting || selectedPlatforms.length === 0}>
        {posting ? "Posting..." : "Share Now"}
      </Button>
    </div>
  );
}
```

### 3.5 Backend Cross-Post Route

```typescript
// server/routes/social-cross-post.ts
router.post("/social/cross-post", async (req, res) => {
  const { postId, platforms } = req.body;
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Get post data
  const post = await storage.getPost(postId);
  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }

  // Get social accounts
  const socialAccounts = await storage.getSocialAccounts(userId);

  const results = await Promise.all(
    platforms.map(async (platform: string) => {
      const account = socialAccounts.find(a => a.provider === platform);
      if (!account) {
        return { platform, success: false, error: "Account not connected" };
      }

      try {
        let result;
        switch (platform) {
          case "facebook":
            result = await FacebookService.createPost(
              account.providerUserId,
              account.accessToken,
              {
                message: post.caption || "",
                imageUrl: post.imageUrl
              }
            );
            break;
          case "instagram":
            result = await InstagramService.createPost(
              account.providerUserId,
              account.accessToken,
              {
                imageUrl: post.imageUrl,
                caption: post.caption || ""
              }
            );
            break;
          case "tiktok":
            if (post.imageUrl.includes(".mp4")) {
              result = await TikTokService.uploadVideo(
                account.accessToken,
                {
                  videoUrl: post.imageUrl,
                  title: post.caption || "",
                  description: post.caption || ""
                }
              );
            }
            break;
        }

        return { platform, success: true, result };
      } catch (error) {
        return { platform, success: false, error: error.message };
      }
    })
  );

  res.json({ success: true, results });
});
```

## 4. Store Sitebuilder Improvements

### 4.1 Enhanced Store Builder Component

The existing store builder uses Craft.js. Improvements needed:

1. **Add more components**: Headers, footers, image galleries, testimonials
2. **Implement drag-and-drop properly**: Fix the draggable components
3. **Save functionality**: Properly serialize and save the layout
4. **Load functionality**: Load saved layouts on store page

### 4.2 Additional Builder Components

```typescript
// client/src/components/store/builder/
const Header = ({ title, logo }) => (
  <div className="bg-gray-900 text-white p-6">
    {logo && <img src={logo} alt="Logo" className="h-12 mb-4" />}
    <h1 className="text-3xl font-bold">{title}</h1>
  </div>
);

const ProductGrid = ({ products }) => (
  <div className="grid grid-cols-3 gap-4 p-4">
    {products.map(p => (
      <ProductCard key={p.id} product={p} />
    ))}
  </div>
);

const Testimonial = ({ text, author }) => (
  <div className="bg-gray-50 p-6 rounded-lg">
    <p className="italic">"{text}"</p>
    <p className="mt-2 font-semibold">- {author}</p>
  </div>
);

const ImageGallery = ({ images }) => (
  <div className="grid grid-cols-4 gap-2">
    {images.map((img, i) => (
      <img key={i} src={img} alt="" className="w-full h-40 object-cover rounded" />
    ))}
  </div>
);
```

## 5. Implementation Priority

1. **Phase 1 (Immediate)**:
   - Add social login buttons to login/signup pages
   - Create database migrations for social_accounts table
   - Set up OAuth routes (stubs)

2. **Phase 2 (Short-term)**:
   - Implement Facebook and Google OAuth flows
   - Add basic post import UI
   - Improve store builder with save/load

3. **Phase 3 (Medium-term)**:
   - Add Instagram and TikTok OAuth
   - Implement post pulling from all platforms
   - Add cross-posting UI

4. **Phase 4 (Long-term)**:
   - Full cross-posting implementation
   - Advanced store builder features
   - Analytics for imported/cross-posted content

## 6. Required API Keys and Setup

### Facebook Developer Account
1. Go to https://developers.facebook.com
2. Create a new app
3. Add Facebook Login product
4. Configure OAuth redirect URIs
5. Get App ID and App Secret

### Google Cloud Console
1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Configure authorized redirect URIs

### TikTok for Developers
1. Go to https://developers.tiktok.com
2. Create an app
3. Request access to relevant scopes
4. Get Client Key and Client Secret

### Instagram Basic Display
1. Go to https://developers.facebook.com
2. Create app and add Instagram Basic Display
3. Configure OAuth redirect URI
4. Get Instagram App ID and App Secret

## 7. Security Considerations

1. **Token Storage**: Encrypt access tokens in database
2. **Token Refresh**: Implement automatic token refresh before expiry
3. **Scope Management**: Request minimal necessary permissions
4. **Rate Limiting**: Implement rate limiting for API calls
5. **Error Handling**: Handle OAuth errors gracefully
6. **User Consent**: Clear UI for permission requests
7. **Account Unlinking**: Allow users to disconnect accounts
8. **Audit Log**: Track when posts are imported/cross-posted

## 8. Testing Strategy

1. **OAuth Flow Testing**: Test login/callback for each provider
2. **Post Import Testing**: Test with various content types
3. **Cross-Post Testing**: Test simultaneous posting to multiple platforms
4. **Error Scenarios**: Test expired tokens, rate limits, network failures
5. **Load Testing**: Test with large numbers of imported posts

## Conclusion

This implementation requires significant third-party API integration and careful handling of OAuth flows and tokens. The phased approach allows for incremental development and testing. Start with Facebook and Google as they have the most mature APIs and documentation.

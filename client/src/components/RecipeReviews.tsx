// client/src/components/RecipeReviews.tsx
import React, { useState, useEffect } from "react";
import { SpoonRating } from "./SpoonRating";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { ThumbsUp, Camera, X, Loader2 } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

interface ReviewPhoto {
  id: string;
  photoUrl: string;
  caption: string | null;
}

interface ReviewUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  royalTitle: string | null;
}

interface Review {
  id: string;
  recipeId: string;
  userId: string;
  rating: number;
  reviewText: string | null;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
  user: ReviewUser;
  photos: ReviewPhoto[];
  isHelpful?: boolean;
}

interface RecipeReviewsProps {
  recipeId: string;
  averageRating?: number;
  reviewCount?: number;
  recipeData?: {
    title?: string;
    image?: string;
    imageUrl?: string;
    thumbnail?: string;
    ingredients?: any;
    instructions?: any;
    cookTime?: number;
    servings?: number;
    difficulty?: string;
    nutrition?: any;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  };
}

export function RecipeReviews({ recipeId, averageRating, reviewCount, recipeData }: RecipeReviewsProps) {
  const { user } = useUser();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [recipeId]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reviews/recipe/${recipeId}`, {
        credentials: "include",
      });

      // Check if response is actually JSON before parsing
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data = await response.json();
        setReviews(data);
      } else {
        // API returned non-JSON (HTML error page) or failed - use empty array
        console.warn("Reviews API returned non-JSON response:", response.status);
        setReviews([]);
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
      setReviews([]); // Fail gracefully with empty reviews
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async () => {
    if (!user) return;

    try {
      setSubmitting(true);
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          recipeId,
          rating: newRating,
          reviewText: newReviewText.trim() || null,
          recipeData: recipeData || null, // Include recipe data for external recipes
        }),
      });

      if (response.ok) {
        const newReview = await response.json();
        setReviews([newReview, ...reviews]);
        setNewRating(5);
        setNewReviewText("");
        setShowReviewForm(false);
        // Trigger a page refresh or emit event to update recipe rating
        window.location.reload();
      } else {
        const error = await response.json();

        // Handle session expiration
        if (response.status === 401) {
          alert("Your session has expired. Please log in again to submit a review.");
          // Clear local storage and redirect to login
          localStorage.removeItem("user");
          window.location.href = "/";
          return;
        }

        alert(error.error || "Failed to submit review");
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      alert("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleHelpful = async (reviewId: string, isCurrentlyHelpful: boolean) => {
    if (!user) return;

    try {
      const method = isCurrentlyHelpful ? "DELETE" : "POST";
      const response = await fetch(`/api/reviews/${reviewId}/helpful`, {
        method,
        credentials: "include",
      });

      if (response.ok) {
        // Update local state
        setReviews(
          reviews.map((r) =>
            r.id === reviewId
              ? {
                  ...r,
                  helpfulCount: r.helpfulCount + (isCurrentlyHelpful ? -1 : 1),
                  isHelpful: !isCurrentlyHelpful,
                }
              : r
          )
        );
      }
    } catch (error) {
      console.error("Error toggling helpful:", error);
    }
  };

  const uploadPhoto = async (reviewId: string, file: File) => {
    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch(`/api/reviews/${reviewId}/photos`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const newPhoto = await response.json();
        // Update review with new photo
        setReviews(
          reviews.map((r) =>
            r.id === reviewId ? { ...r, photos: [...r.photos, newPhoto] } : r
          )
        );
      } else {
        alert("Failed to upload photo");
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const userHasReviewed = user && reviews.some((r) => r.userId === user.id);

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Reviews & Ratings</span>
            {user && !userHasReviewed && (
              <Button onClick={() => setShowReviewForm(!showReviewForm)} size="sm">
                Write a Review
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900">
                {averageRating ? Number(averageRating).toFixed(1) : "0.0"}
              </div>
              <SpoonRating value={averageRating || 0} size="lg" className="justify-center mt-2" />
              <div className="text-sm text-gray-600 mt-1">
                {reviewCount || 0} review{reviewCount !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = reviews.filter((r) => r.rating === stars).length;
                const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-2">
                    <span className="text-sm w-12">{stars} 🥄</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-8">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Form */}
      {showReviewForm && user && (
        <Card>
          <CardHeader>
            <CardTitle>Write Your Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Your Rating</label>
              <SpoonRating
                value={newRating}
                interactive
                onChange={setNewRating}
                size="xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Your Review (Optional)
              </label>
              <Textarea
                value={newReviewText}
                onChange={(e) => setNewReviewText(e.target.value)}
                placeholder="Share your experience with this recipe..."
                rows={4}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={submitReview} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Review"
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowReviewForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : reviews.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No reviews yet. Be the first to review this recipe!
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <Avatar>
                    <AvatarImage src={review.user.avatar || undefined} />
                    <AvatarFallback>
                      {review.user.displayName?.charAt(0) || review.user.username.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">
                          {review.user.displayName || review.user.username}
                          {review.user.royalTitle && (
                            <Badge variant="secondary" className="ml-2">
                              {review.user.royalTitle}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <SpoonRating value={review.rating} size="sm" />
                          <span className="text-xs text-gray-500">
                            {review.createdAt
                              ? new Date(review.createdAt).toLocaleDateString()
                              : "Recently"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {review.reviewText && (
                      <p className="text-gray-700 leading-relaxed">{review.reviewText}</p>
                    )}

                    {/* Review Photos */}
                    {review.photos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-3">
                        {review.photos.map((photo) => (
                          <div key={photo.id} className="relative aspect-square">
                            <img
                              src={photo.photoUrl}
                              alt={photo.caption || "Review photo"}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Photo upload for own review */}
                    {user && review.userId === user.id && (
                      <div className="mt-3">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadPhoto(review.id, file);
                            }}
                            disabled={uploadingPhoto}
                          />
                          <Button variant="outline" size="sm" disabled={uploadingPhoto}>
                            <Camera className="w-4 h-4 mr-2" />
                            {uploadingPhoto ? "Uploading..." : "Add Photo"}
                          </Button>
                        </label>
                      </div>
                    )}

                    {/* Helpful button */}
                    {user && review.userId !== user.id && (
                      <div className="mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleHelpful(review.id, review.isHelpful || false)}
                          className={review.isHelpful ? "text-blue-600" : ""}
                        >
                          <ThumbsUp className={`w-4 h-4 mr-2 ${review.isHelpful ? "fill-current" : ""}`} />
                          Helpful ({review.helpfulCount})
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

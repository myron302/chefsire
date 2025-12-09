# Post and Media Deletion Implementation

This document provides an overview of the post and media deletion functionality implemented in this PR.

## Overview

This implementation adds secure server and client-side functionality to allow users to delete their posts and attached media (images and videos) from their profiles. Only the post owner can delete their posts/media, with proper authentication and authorization checks.

## Server-Side Implementation

### 1. Media File Deletion Endpoint

**Route:** `DELETE /api/upload/:filename`

**File:** `server/routes/upload.ts`

**Features:**
- Requires authentication via `requireAuth` middleware
- Validates filename to prevent path traversal attacks
- Ensures file operations are constrained to the uploads directory
- Uses async file operations to prevent blocking the event loop
- Returns proper HTTP status codes (200, 400, 401, 404, 500)

**Security Measures:**
```javascript
// Path traversal prevention
if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
  return res.status(400).json({ ok: false, error: "Invalid filename" });
}

// Directory boundary validation
const normalizedPath = path.normalize(filePath);
if (!normalizedPath.startsWith(uploadDir)) {
  return res.status(400).json({ ok: false, error: "Invalid file path" });
}
```

### 2. Enhanced Post Deletion

**Route:** `DELETE /api/posts/:id`

**File:** `server/routes/posts.ts`

**Features:**
- Requires authentication
- Verifies user is the post owner
- Deletes associated local media files from disk
- Deletes post from database (cascade deletes comments/likes via storage layer)
- Returns appropriate HTTP status codes (200, 401, 403, 404, 500)

**Process:**
1. Authenticate user
2. Fetch post to verify ownership
3. Check if user is post owner
4. Delete local media file if it exists
5. Delete post from database
6. Return success response

### 3. Post Update Endpoint

**Route:** `PATCH /api/posts/:id`

**File:** `server/routes/posts.ts`

**Features:**
- Allows updating post fields (caption, tags, imageUrl)
- Requires authentication and ownership
- Deletes old media file when imageUrl is set to null
- Validates update data with Zod schema

**Use Cases:**
- Update post caption or tags
- Remove media from a post (set imageUrl to null)
- Replace media with a new image

### Helper Functions

Two helper functions were extracted to reduce code duplication:

#### `extractLocalUploadFilename(imageUrl, protocol, host)`
- Detects if an image URL is a local upload
- Extracts the filename with security checks
- Prevents path traversal attacks

#### `deleteMediaFile(filename)`
- Safely deletes media files from uploads directory
- Validates file path boundaries
- Handles race conditions (ENOENT errors)
- Uses async operations

## Client-Side Implementation

### PostCard Component Updates

**File:** `client/src/components/post-card.tsx`

**Features:**
1. **Authentication Integration**
   - Uses `useUser()` hook to get authenticated user
   - Determines if current user is the post owner
   - Shows/hides delete options based on ownership

2. **Delete Post Functionality**
   - Dropdown menu with "Delete Post" option
   - Confirmation dialog before deletion
   - Mutation that calls `DELETE /api/posts/:id`
   - Invalidates post queries on success
   - Shows toast notification

3. **Remove Media Functionality**
   - "Remove Media" option in dropdown menu
   - Confirmation dialog
   - Calls `PATCH /api/posts/:id` with `imageUrl: null`
   - Invalidates queries and shows toast

**UI/UX:**
- Dropdown menu attached to three-dot icon (MoreHorizontal)
- Options only visible to post owner
- Confirmation dialogs prevent accidental deletions
- Toast notifications provide feedback
- Automatic query invalidation keeps UI in sync

## Testing

### Test Suite

**File:** `the __tests__/post-deletion.test.ts`

**Coverage:**
- Authentication requirements for all endpoints
- Ownership validation
- Path traversal attack prevention
- File deletion operations
- HTTP status code validation
- Edge cases (non-existent files, invalid filenames, etc.)

**Test Categories:**
1. **Upload Deletion Tests**
   - Unauthorized requests
   - Path traversal attempts
   - Non-existent files
   - Successful deletions

2. **Post Deletion Tests**
   - Unauthorized requests
   - Non-owner attempts
   - Non-existent posts
   - Successful deletions with media cleanup

3. **Post Update Tests**
   - Unauthorized requests
   - Non-owner attempts
   - Field updates
   - Media removal

4. **Security Tests**
   - Multiple path traversal attack patterns
   - Directory boundary validation

## Security Analysis

### CodeQL Findings

**New Code - No Critical Issues Found:**
- ✅ Path traversal protection verified
- ✅ Ownership validation enforced
- ✅ Authentication required
- ✅ Safe file operations
- ✅ Async operations prevent blocking

**Pre-existing Issues (Not Introduced):**
- Missing rate limiting (affects entire app)
- CSRF protection not implemented (affects entire app)

### Security Best Practices Implemented

1. **Defense in Depth**
   - Multiple layers of path validation
   - Filename sanitization
   - Directory boundary checks

2. **Principle of Least Privilege**
   - Only post owners can delete/update
   - Authentication required for all destructive operations

3. **Safe Error Handling**
   - Graceful handling of missing files
   - No sensitive information in error messages
   - Proper logging for debugging

4. **Async Operations**
   - Non-blocking file operations
   - Prevents DoS via blocking I/O

## API Documentation

### DELETE /api/upload/:filename

Deletes an uploaded file from the uploads directory.

**Authentication:** Required

**Parameters:**
- `filename` (path parameter): Name of the file to delete

**Responses:**
- `200 OK`: File deleted successfully
  ```json
  { "ok": true, "message": "File deleted successfully" }
  ```
- `400 Bad Request`: Invalid filename or path traversal attempt
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: File not found
- `500 Internal Server Error`: Server error

### DELETE /api/posts/:id

Deletes a post and its associated media.

**Authentication:** Required

**Authorization:** Must be post owner

**Parameters:**
- `id` (path parameter): Post ID

**Responses:**
- `200 OK`: Post deleted successfully
  ```json
  { "message": "Post deleted" }
  ```
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not the post owner
- `404 Not Found`: Post not found
- `500 Internal Server Error`: Server error

### PATCH /api/posts/:id

Updates a post's fields.

**Authentication:** Required

**Authorization:** Must be post owner

**Parameters:**
- `id` (path parameter): Post ID

**Request Body:**
```json
{
  "caption": "string (optional)",
  "tags": ["string"] (optional),
  "imageUrl": "string | null (optional)"
}
```

**Responses:**
- `200 OK`: Post updated successfully (returns updated post)
- `400 Bad Request`: Invalid update data
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not the post owner
- `404 Not Found`: Post not found
- `500 Internal Server Error`: Server error

## Usage Examples

### Delete a Post (Client)

```typescript
const deletePostMutation = useMutation({
  mutationFn: async () => {
    await apiRequest("DELETE", `/api/posts/${post.id}`);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    toast({ description: "Post deleted successfully" });
  },
});

// In component
<Button onClick={() => deletePostMutation.mutate()}>
  Delete Post
</Button>
```

### Remove Media from Post (Client)

```typescript
const removeMediaMutation = useMutation({
  mutationFn: async () => {
    await apiRequest("PATCH", `/api/posts/${post.id}`, {
      imageUrl: null,
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    toast({ description: "Media removed successfully" });
  },
});
```

## Migration Notes

No database migrations are required. This implementation uses existing tables and fields.

## Future Enhancements

Potential improvements for future iterations:

1. **Soft Deletes**
   - Add `deletedAt` timestamp field
   - Allow post recovery within a time window

2. **Batch Operations**
   - Delete multiple posts at once
   - Bulk media cleanup

3. **Confirmation Dialog Component**
   - Replace `window.confirm()` with custom dialog
   - Better UX and styling consistency

4. **Media Archival**
   - Move deleted media to archive folder
   - Retention policy for compliance

5. **Rate Limiting**
   - Add rate limiting to deletion endpoints
   - Prevent abuse

6. **CSRF Protection**
   - Implement CSRF tokens
   - Enhance security for state-changing operations

## Conclusion

This implementation provides a secure, well-tested foundation for post and media deletion. All requirements from the problem statement have been met, with additional security hardening and code quality improvements.

/**
 * Share utility with Web Share API fallback to clipboard
 */

export interface ShareData {
  title?: string;
  text?: string;
  url: string;
}

/**
 * Share content using Web Share API if available, otherwise copy to clipboard
 * @param data - Data to share (title, text, url)
 * @returns Promise that resolves to true if shared/copied successfully
 */
export async function shareContent(data: ShareData): Promise<boolean> {
  // Check if Web Share API is available
  if (navigator.share) {
    try {
      await navigator.share({
        title: data.title,
        text: data.text,
        url: data.url,
      });
      return true;
    } catch (error) {
      // User cancelled or share failed
      if ((error as Error).name === "AbortError") {
        return false;
      }
      // Fall back to clipboard
      return copyToClipboard(data.url);
    }
  }

  // Fallback: Copy URL to clipboard
  return copyToClipboard(data.url);
}

/**
 * Copy text to clipboard
 * @param text - Text to copy
 * @returns Promise that resolves to true if copied successfully
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);

    return successful;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Generate shareable URL for a post
 * @param postId - Post ID
 * @returns Full URL to the post
 */
export function getPostShareUrl(postId: string): string {
  return `${window.location.origin}/posts/${postId}`;
}

/**
 * Generate shareable URL for a recipe
 * @param recipeId - Recipe ID
 * @returns Full URL to the recipe
 */
export function getRecipeShareUrl(recipeId: string): string {
  return `${window.location.origin}/recipes/${recipeId}`;
}

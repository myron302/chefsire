import React, { useState, ReactNode } from 'react';
import { X, PlayCircle } from 'lucide-react';
// Assuming you have a standard Button component in your UI library
import { Button } from '@/components/ui/button'; 

// 1. Data Structure Interface
interface MediaItem {
  id: string;
  type: 'image' | 'bite'; // 'bite' for video
  url: string; // The URL for the full-size image or video source
  thumbnailUrl: string; // The URL for the grid-view thumbnail
}

// 2. Simple Modal Component (The Lightbox/Popup)
interface SimpleModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

// This is a minimal, full-screen modal. You can replace this with your app's existing Dialog/Modal component
const SimpleModal: React.FC<SimpleModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm p-4"
      onClick={onClose} // Close on backdrop click
    >
      <div 
        className="relative max-w-full max-h-screen"
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
        {/* Content Container */}
        <div className="flex items-center justify-center max-h-[90vh]">
          {children}
        </div>
      </div>
    </div>
  );
};

// 3. Media Tile Component (The Clickable Grid Item)
const MediaTile: React.FC<{ item: MediaItem; onClick: () => void }> = ({ item, onClick }) => (
  // Use a button for accessibility (keyboard navigation)
  <button
    onClick={onClick}
    className="relative w-full aspect-square overflow-hidden rounded-lg group cursor-pointer focus:outline-none focus:ring-4 focus:ring-purple-500 transition-shadow"
  >
    {/* Thumbnail Image/Cover */}
    <img
      src={item.thumbnailUrl}
      alt={item.type === 'bite' ? 'Video Bite' : 'Gallery Photo'}
      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      loading="lazy"
    />
    
    {/* Overlay for Bites/Videos */}
    {item.type === 'bite' && (
      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-10 group-hover:bg-opacity-20 transition-colors">
        <PlayCircle className="w-10 h-10 text-white opacity-90 transition-opacity" fill="white" />
        <span className="sr-only">Play Bite</span>
      </div>
    )}
  </button>
);

// 4. Content inside the Modal
const MediaModalContent: React.FC<{ item: MediaItem }> = ({ item }) => {
  return (
    <div className="max-w-full max-h-[90vh] bg-black rounded-lg">
      {item.type === 'image' ? (
        // Image for 'pic'
        <img
          src={item.url}
          alt="Enlarged media"
          className="max-w-full max-h-[90vh] object-contain rounded-lg"
        />
      ) : (
        // Video for 'bite'
        <video
          controls
          autoPlay // Start playing immediately upon opening
          src={item.url}
          className="max-w-full max-h-[90vh] object-contain rounded-lg"
          // You may want to add a 'poster' property with a high-res cover image for faster loading
        >
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
};

// 5. Main Gallery Component
// Replace `mockMedia` with your actual media data array from your profile component.
const mockMedia: MediaItem[] = [
  { id: '1', type: 'image', url: 'https://placehold.co/800x600/png?text=Full+Size+Photo+1', thumbnailUrl: 'https://placehold.co/300x200/png?text=Photo+1' },
  { id: '2', type: 'bite', url: 'https://www.w3schools.com/html/mov_bbb.mp4', thumbnailUrl: 'https://placehold.co/300x200/png?text=Bite+2', },
  { id: '3', type: 'image', url: 'https://placehold.co/600x800/png?text=Full+Size+Photo+3', thumbnailUrl: 'https://placehold.co/300x200/png?text=Photo+3' },
  { id: '4', type: 'bite', url: 'https://media.w3.org/2010/05/sintel/trailer.mp4', thumbnailUrl: 'https://placehold.co/300x200/png?text=Bite+4' },
  { id: '5', type: 'image', url: 'https://placehold.co/1000x400/png?text=Full+Size+Photo+5', thumbnailUrl: 'https://placehold.co/300x200/png?text=Photo+5' },
];

export default function ProfileMediaGallery({ mediaItems = mockMedia }) {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const handleMediaClick = (media: MediaItem) => {
    setSelectedMedia(media);
  };

  const closeModal = () => {
    setSelectedMedia(null);
  };

  return (
    <div className="w-full">
      {/* Media Grid */}
      {/* Adjust the grid-cols-* to match your current layout (rows and columns) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1 md:gap-2">
        {mediaItems.map((item) => (
          <MediaTile
            key={item.id}
            item={item}
            onClick={() => handleMediaClick(item)}
          />
        ))}
      </div>

      {/* The Modal/Lightbox Component */}
      {selectedMedia && (
        <SimpleModal isOpen={!!selectedMedia} onClose={closeModal}>
          <MediaModalContent item={selectedMedia} />
        </SimpleModal>
      )}
    </div>
  );
}

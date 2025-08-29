# Overview

Chefsire is a full-stack social media platform focused on culinary content sharing. Built as a modern web application, it allows users to share food posts, recipes, and stories in an Instagram-like interface. The platform features user profiles, a social feed, recipe discovery, and interactive elements like likes and comments.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Styling**: Tailwind CSS with Shadcn UI components for consistent design system
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management and caching
- **Build Tool**: Vite for fast development and optimized production builds

## Backend Architecture
- **Server**: Express.js with TypeScript for RESTful API endpoints
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Storage Layer**: In-memory storage implementation with interface for easy database migration
- **API Structure**: RESTful endpoints for users, posts, recipes, stories, likes, comments, and follows

## Database Schema
- **Users**: Authentication, profiles, and social metrics (followers, following counts)
- **Posts**: Core content with image URLs, captions, tags, and engagement metrics
- **Recipes**: Linked to posts with ingredients, instructions, cooking metadata
- **Stories**: Temporary content similar to Instagram stories
- **Social Features**: Likes, comments, and follow relationships with proper foreign key constraints

## Development Environment
- **Monorepo Structure**: Client and server in single repository with shared schema
- **Path Aliases**: Configured for clean imports (@/ for client, @shared for common code)
- **Development Server**: Vite dev server with Express API proxy for seamless full-stack development
- **Hot Module Replacement**: Enabled for fast development iteration

## UI/UX Design
- **Design System**: Shadcn UI with customized color scheme (orange primary, teal secondary)
- **Responsive Design**: Mobile-first approach with dedicated mobile navigation
- **Component Architecture**: Reusable components for posts, recipes, user profiles, and modals
- **Accessibility**: Proper ARIA labels and keyboard navigation support

# External Dependencies

## Database & ORM
- **@neondatabase/serverless**: PostgreSQL database connection for serverless environments
- **drizzle-orm**: Type-safe ORM with PostgreSQL dialect
- **drizzle-kit**: Database migration and schema management tools

## Frontend Libraries
- **@tanstack/react-query**: Server state management, caching, and data synchronization
- **wouter**: Lightweight routing library for single-page application navigation
- **date-fns**: Date formatting and manipulation utilities
- **@radix-ui/***: Headless UI components for accessibility and consistent behavior
- **lucide-react**: Icon library for consistent iconography

## Development Tools
- **Vite**: Build tool and development server with React plugin
- **TypeScript**: Static type checking for enhanced developer experience
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **PostCSS**: CSS processing with Tailwind and Autoprefixer

## Authentication & Session Management
- **connect-pg-simple**: PostgreSQL session store for Express sessions
- **express-session**: Session middleware for user authentication state

## Form Management
- **react-hook-form**: Form state management and validation
- **@hookform/resolvers**: Form validation resolvers
- **zod**: Schema validation for runtime type checking
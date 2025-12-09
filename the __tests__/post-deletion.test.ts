import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import uploadRouter from '../server/routes/upload';
import postsRouter from '../server/routes/posts';
import { storage } from '../server/storage';

// Mock storage
jest.mock('../server/storage', () => ({
  storage: {
    getPost: jest.fn(),
    deletePost: jest.fn(),
    updatePost: jest.fn(),
  },
}));

// Create a test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Mock auth middleware - use verify in production tests
  app.use((req: any, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        // Using decode for simplicity in tests, but verify should be used in production
        const decoded = jwt.decode(token) as any;
        req.user = { id: decoded.id };
      } catch (e) {
        // Invalid token
      }
    }
    next();
  });
  
  app.use('/api/upload', uploadRouter);
  app.use('/api/posts', postsRouter);
  return app;
};

describe('Post and Media Deletion', () => {
  const JWT_SECRET = 'test-secret';
  let app: express.Application;
  let testToken: string;
  const testUserId = 'test-user-123';
  const testPostId = 'test-post-123';
  const uploadDir = path.join(process.cwd(), 'uploads');

  beforeAll(() => {
    app = createTestApp();
    // Create test JWT token
    testToken = jwt.sign({ id: testUserId }, JWT_SECRET);
    
    // Ensure uploads directory exists for tests
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DELETE /api/upload/:filename', () => {
    it('should reject request without authentication', async () => {
      const response = await request(app)
        .delete('/api/upload/test.jpg');

      expect(response.status).toBe(401);
    });

    it('should reject filename with path traversal attempt', async () => {
      const response = await request(app)
        .delete('/api/upload/../../../etc/passwd')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid filename');
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .delete('/api/upload/nonexistent-file.jpg')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
    });

    it('should delete existing file successfully', async () => {
      // Create a test file
      const testFilename = 'test-delete-file.txt';
      const testFilePath = path.join(uploadDir, testFilename);
      fs.writeFileSync(testFilePath, 'test content');

      const response = await request(app)
        .delete(`/api/upload/${testFilename}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(fs.existsSync(testFilePath)).toBe(false);
    });
  });

  describe('DELETE /api/posts/:id', () => {
    it('should reject request without authentication', async () => {
      const response = await request(app)
        .delete(`/api/posts/${testPostId}`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent post', async () => {
      (storage.getPost as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/posts/${testPostId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
    });

    it('should reject deletion by non-owner', async () => {
      (storage.getPost as jest.Mock).mockResolvedValue({
        id: testPostId,
        userId: 'different-user-id',
        imageUrl: 'https://example.com/image.jpg',
      });

      const response = await request(app)
        .delete(`/api/posts/${testPostId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Forbidden');
    });

    it('should delete post by owner successfully', async () => {
      (storage.getPost as jest.Mock).mockResolvedValue({
        id: testPostId,
        userId: testUserId,
        imageUrl: 'https://example.com/image.jpg',
      });
      (storage.deletePost as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/posts/${testPostId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(storage.deletePost).toHaveBeenCalledWith(testPostId);
    });

    it('should delete local media file when deleting post', async () => {
      // Create a test file
      const testFilename = 'test-post-media.jpg';
      const testFilePath = path.join(uploadDir, testFilename);
      fs.writeFileSync(testFilePath, 'test image content');

      (storage.getPost as jest.Mock).mockResolvedValue({
        id: testPostId,
        userId: testUserId,
        imageUrl: `http://localhost:3000/uploads/${testFilename}`,
      });
      (storage.deletePost as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/posts/${testPostId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(fs.existsSync(testFilePath)).toBe(false);
    });
  });

  describe('PATCH /api/posts/:id', () => {
    it('should reject request without authentication', async () => {
      const response = await request(app)
        .patch(`/api/posts/${testPostId}`)
        .send({ caption: 'Updated caption' });

      expect(response.status).toBe(401);
    });

    it('should reject update by non-owner', async () => {
      (storage.getPost as jest.Mock).mockResolvedValue({
        id: testPostId,
        userId: 'different-user-id',
        imageUrl: 'https://example.com/image.jpg',
      });

      const response = await request(app)
        .patch(`/api/posts/${testPostId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ caption: 'Updated caption' });

      expect(response.status).toBe(403);
    });

    it('should update post fields by owner', async () => {
      const updatedPost = {
        id: testPostId,
        userId: testUserId,
        caption: 'Updated caption',
        tags: ['tag1', 'tag2'],
        imageUrl: 'https://example.com/image.jpg',
      };

      (storage.getPost as jest.Mock).mockResolvedValue({
        id: testPostId,
        userId: testUserId,
        imageUrl: 'https://example.com/image.jpg',
      });
      (storage.updatePost as jest.Mock).mockResolvedValue(updatedPost);

      const response = await request(app)
        .patch(`/api/posts/${testPostId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ caption: 'Updated caption', tags: ['tag1', 'tag2'] });

      expect(response.status).toBe(200);
      expect(storage.updatePost).toHaveBeenCalled();
    });

    it('should delete old media when clearing imageUrl', async () => {
      // Create a test file
      const testFilename = 'test-media-remove.jpg';
      const testFilePath = path.join(uploadDir, testFilename);
      fs.writeFileSync(testFilePath, 'test image content');

      (storage.getPost as jest.Mock).mockResolvedValue({
        id: testPostId,
        userId: testUserId,
        imageUrl: `http://localhost:3000/uploads/${testFilename}`,
      });
      (storage.updatePost as jest.Mock).mockResolvedValue({
        id: testPostId,
        userId: testUserId,
        imageUrl: null,
      });

      const response = await request(app)
        .patch(`/api/posts/${testPostId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ imageUrl: null });

      expect(response.status).toBe(200);
      expect(fs.existsSync(testFilePath)).toBe(false);
    });
  });

  describe('Path Traversal Protection', () => {
    const maliciousFilenames = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      'test/../../../etc/passwd',
      './etc/passwd',
    ];

    maliciousFilenames.forEach((filename) => {
      it(`should reject path traversal attempt: ${filename}`, async () => {
        const response = await request(app)
          .delete(`/api/upload/${encodeURIComponent(filename)}`)
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid');
      });
    });
  });
});

import { storage } from '../src/storage'; // Adjust if storage.ts is not in src/
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { users, posts, recipes } from '@shared/schema';

// Setup test database connection
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const db = drizzle(pool);

describe('DrizzleStorage createRecipe', () => {
  let testUser: any;
  let testPost: any;

  beforeAll(async () => {
    // Clean up existing data
    await db.delete(recipes).execute();
    await db.delete(posts).execute();
    await db.delete(users).execute();

    // Create a test user
    testUser = await storage.createUser({
      username: 'testchef',
      email: 'testchef@example.com',
      passwordHash: 'hashedpassword',
      isChef: true,
    });

    // Create a test post
    testPost = await storage.createPost({
      userId: testUser.id,
      content: 'Test recipe post',
      mediaUrl: 'https://example.com/test.jpg',
    });
  });

  afterAll(async () => {
    await db.delete(recipes).execute();
    await db.delete(posts).execute();
    await db.delete(users).execute();
    await pool.end();
  });

  it('should create a recipe successfully', async () => {
    const recipeData = {
      postId: testPost.id,
      title: 'Test Pasta',
      ingredients: ['pasta', 'tomato', 'basil'],
      instructions: 'Cook pasta, add sauce, serve.',
    };

    const recipe = await storage.createRecipe(recipeData);

    expect(recipe).toBeDefined();
    expect(recipe.postId).toBe(testPost.id);
    expect(recipe.title).toBe(recipeData.title);
    expect(recipe.ingredients).toEqual(recipeData.ingredients);
    expect(recipe.instructions).toBe(recipeData.instructions);
  });
});

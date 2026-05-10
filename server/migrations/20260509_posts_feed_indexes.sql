-- Feed performance: index posts by created_at (ORDER BY) and user_id (JOIN)
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts (user_id);

-- Feed performance: index likes for the LEFT JOIN on (post_id, user_id)
CREATE INDEX IF NOT EXISTS likes_post_id_idx ON likes (post_id);
CREATE UNIQUE INDEX IF NOT EXISTS likes_user_post_idx ON likes (user_id, post_id);

-- Feed performance: index recipes.post_id for the LEFT JOIN
CREATE UNIQUE INDEX IF NOT EXISTS recipes_post_id_idx ON recipes (post_id);

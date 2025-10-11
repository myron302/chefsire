import { app } from "./app";

// Global uncaught exception handler (logs and exits gracefully)
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const PORT = Number(process.env.PORT) || 3001;

try {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server listening on ${PORT}`);
  });

  // Graceful shutdown on signals
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
      process.exit(0);
    });
  });
} catch (err) {
  console.error('Server failed to start:', err);
  process.exit(1);
}

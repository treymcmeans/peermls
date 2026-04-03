import { startVerificationService } from './service.js';

const port = parseInt(process.env.PORT || '4000', 10);
const keyDir = process.env.KEY_DIR || './data/verify-keys';

startVerificationService(port, keyDir).catch((err) => {
  console.error('Failed to start verification service:', err);
  process.exit(1);
});

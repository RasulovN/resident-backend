import type { FastifyInstance } from 'fastify';
import { authGuard } from '../../common/middleware/auth';
import { uploadFileHandler, uploadImageHandler } from './uploads.controller';

export async function uploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);
  // POST /api/uploads/image — multipart/form-data, field name: "file"
  app.post('/image', uploadImageHandler);
  // POST /api/uploads/file — generic attachment (image/audio/document), field name: "file"
  app.post('/file', uploadFileHandler);
}

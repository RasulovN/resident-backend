import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../common/errors/app-error';
import { env } from '../../config/env';
import { ok } from '../../common/utils/response';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// Generic attachments (chat): images, audio/voice, documents. Larger cap.
const ATTACHMENT_MAX_SIZE = 25 * 1024 * 1024; // 25 MB
const ATTACHMENT_BLOCKED = new Set(['application/x-msdownload', 'application/x-msdos-program', 'application/x-sh']);

export async function uploadImageHandler(request: FastifyRequest, reply: FastifyReply) {
  const data = await request.file();
  if (!data) throw AppError.badRequest('No file uploaded');

  if (!ALLOWED_TYPES.has(data.mimetype)) {
    await data.toBuffer(); // drain the stream
    throw AppError.badRequest('Only image files are allowed (jpeg, png, webp, gif, svg)');
  }

  const buffer = await data.toBuffer();
  if (buffer.length > MAX_SIZE) {
    throw AppError.badRequest('File too large. Maximum 5 MB allowed');
  }

  // Generate unique filename
  const ext = path.extname(data.filename || '.jpg') || '.jpg';
  const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  const uploadDir = path.resolve(env.UPLOAD_DIR);
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), buffer);

  const url = `${env.APP_URL}/uploads/${filename}`;
  return reply.send(ok({ url, filename, size: buffer.length, mimetype: data.mimetype }));
}

/** Generic attachment upload for chat: images, audio/voice notes, documents. */
export async function uploadFileHandler(request: FastifyRequest, reply: FastifyReply) {
  const data = await request.file();
  if (!data) throw AppError.badRequest('No file uploaded');

  if (ATTACHMENT_BLOCKED.has(data.mimetype)) {
    await data.toBuffer();
    throw AppError.badRequest('This file type is not allowed');
  }

  const buffer = await data.toBuffer();
  if (buffer.length > ATTACHMENT_MAX_SIZE) {
    throw AppError.badRequest('File too large. Maximum 25 MB allowed');
  }

  const ext = path.extname(data.filename || '') || '';
  const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  const uploadDir = path.resolve(env.UPLOAD_DIR);
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), buffer);

  const url = `${env.APP_URL}/uploads/${filename}`;
  return reply.send(ok({
    url,
    filename,
    originalName: data.filename ?? filename,
    size: buffer.length,
    mimetype: data.mimetype,
  }));
}

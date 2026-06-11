/** Minimal shape of a multer-parsed upload (memory storage). */
export interface UploadedImageFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

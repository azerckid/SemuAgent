import { z } from 'zod'

export const clientDocumentTypeSchema = z.string().trim().min(1).max(50)

export const clientDocumentUploadMetaSchema = z.object({
  documentId: z.string().uuid().optional(),
  documentType: clientDocumentTypeSchema,
  originalFilename: z.string().trim().min(1).max(255),
  memo: z.string().trim().max(2000).optional(),
})

export const clientDocumentBlobResultSchema = z.object({
  url: z.string().url(),
  pathname: z.string().min(1),
  contentType: z.string().min(1),
})

import { z } from 'zod'

export const inboundEmailActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set_label'), clientLabelId: z.string().min(1).nullable() }),
  z.object({ action: z.literal('hold') }),
  z.object({ action: z.literal('unhold') }),
])

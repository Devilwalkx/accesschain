import { z } from "zod";

/**
 * Private access requirements. Can reveal health information even without a diagnosis:
 * never sent to the server in plaintext, never logged, matched on-device.
 * There is deliberately no diagnosis field.
 */
export const RequirementsProfileSchema = z
  .object({
    avoidSteps: z.boolean(),
    /** Maximum continuous walking distance in metres, if the person has a limit. */
    maxWalkM: z.number().positive().max(100_000).optional(),
    /** Minimum clear width in mm (e.g. for a wheelchair), if relevant. */
    minClearWidthMm: z.number().int().positive().max(5_000).optional(),
    /** Longest acceptable gap between resting points, in metres. */
    maxRestGapM: z.number().positive().max(100_000).optional(),
    needsAccessibleToilet: z.boolean(),
    liftAcceptable: z.boolean(),
    assistanceAcceptable: z.boolean()
  })
  .strict();

export type RequirementsProfile = z.infer<typeof RequirementsProfileSchema>;

export function parseProfile(input: unknown): RequirementsProfile {
  return RequirementsProfileSchema.parse(input);
}

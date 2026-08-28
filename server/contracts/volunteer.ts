import { z } from "zod";

export const volunteerInterestSchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(320),
  skills: z.array(z.string().trim().min(1).max(100)).max(8).default([]),
  languages: z.string().trim().max(500).optional(),
  availability: z.string().trim().max(500).optional(),
});

export type VolunteerInterest = z.infer<typeof volunteerInterestSchema>;

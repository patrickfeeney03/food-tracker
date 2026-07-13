import z from "zod";
import type { GoogleIdentity } from "./google-user";

const googleUserInfoSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.literal(true),
  name: z.string().trim().min(1).optional()
});

export function parseGoogleUserInfo(
  input: unknown
): GoogleIdentity {
  const result = googleUserInfoSchema.parse(input);

  return {
    subject: result.sub,
    email: result.email,
    name: result.name ?? result.email
  };
}

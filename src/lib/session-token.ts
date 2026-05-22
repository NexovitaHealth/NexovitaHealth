import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "nexovita_session";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "nexovita-dev-secret-change-in-production",
);

export interface SessionJWTPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  [key: string]: string;
}

export async function signSessionToken(payload: SessionJWTPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionJWTPayload;
  } catch {
    return null;
  }
}

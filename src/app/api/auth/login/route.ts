import { NextResponse } from "next/server";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { verifyPassword, signJwt, createAuthCookieHeader } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await ensureDbInitialized();
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const db = getDb();

    const res = await db.execute({
      sql: "SELECT id, name, email, password_hash FROM users WHERE email = ?",
      args: [cleanEmail],
    });

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const user = res.rows[0];
    const passwordHash = String(user.password_hash || "");
    const isValid = verifyPassword(String(password), passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const userId = String(user.id);
    const token = await signJwt({ userId, email: cleanEmail });

    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        name: String(user.name),
        email: cleanEmail,
      },
    });

    response.headers.set("Set-Cookie", createAuthCookieHeader(token));
    return response;
  } catch (err: unknown) {
    console.error("[Login API Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sign in." },
      { status: 500 }
    );
  }
}


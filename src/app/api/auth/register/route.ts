import { NextResponse } from "next/server";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { hashPassword, signJwt, createAuthCookieHeader } from "@/lib/auth";
import crypto from "node:crypto";

export async function POST(request: Request) {
  try {
    await ensureDbInitialized();
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters long." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    const db = getDb();
    const existing = await db.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [cleanEmail],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in." },
        { status: 409 }
      );
    }

    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(password);

    await db.execute({
      sql: "INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)",
      args: [userId, cleanName, cleanEmail, passwordHash],
    });

    // Create empty profile row
    await db.execute({
      sql: `INSERT INTO profiles (user_id, full_name, email, skills_json, target_roles_json)
            VALUES (?, ?, ?, '[]', '["Software Engineer", "Full Stack Developer", "Frontend Developer", "Backend Developer"]')`,
      args: [userId, cleanName, cleanEmail],
    });

    // Create default runner state
    await db.execute({
      sql: `INSERT INTO runner_states (user_id, is_enabled, status) VALUES (?, 0, 'stopped')`,
      args: [userId],
    });

    const token = await signJwt({ userId, email: cleanEmail });

    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
      },
    });

    response.headers.set("Set-Cookie", createAuthCookieHeader(token));
    return response;
  } catch (err: unknown) {
    console.error("[Register API Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create account." },
      { status: 500 }
    );
  }
}


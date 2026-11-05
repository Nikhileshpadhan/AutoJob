import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";

export const dynamic = "force-dynamic";

export async function GET() {
  const profileDir = path.resolve(process.cwd(), "data", "browser_profile");
  const exists = fs.existsSync(profileDir);

  let hasCookies = false;
  if (exists) {
    const defaultDir = path.join(profileDir, "Default");
    const networkDir = path.join(defaultDir, "Network");
    const cookiesFile1 = path.join(networkDir, "Cookies");
    const cookiesFile2 = path.join(defaultDir, "Cookies");
    if (fs.existsSync(cookiesFile1) || fs.existsSync(cookiesFile2)) {
      hasCookies = true;
    }
  }

  return NextResponse.json({
    browserProfileExists: exists,
    hasSessionCookies: hasCookies,
    profilePath: profileDir,
    status: hasCookies ? "ready" : "needs_login",
  });
}

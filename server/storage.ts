import { db } from "./db";
import { users, visits, type User, type Visit } from "@shared/schema";
import { eq, desc, gte } from "drizzle-orm";

export interface IStorage {
  getUserById(id: number): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUserWithGoogle(data: {
    username: string;
    googleId: string;
    email: string | null;
    displayName: string | null;
  }): Promise<User>;
  updateUserGoogle(
    id: number,
    data: { googleId?: string; displayName?: string | null }
  ): Promise<User>;
  recordVisit(userId: number, email: string | null): Promise<void>;
  getVisits(limit: number): Promise<Visit[]>;
  getVisitTimestampsSince(since: Date | null): Promise<Date[]>;
}

export class DatabaseStorage implements IStorage {
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUserWithGoogle(data: {
    username: string;
    googleId: string;
    email: string | null;
    displayName: string | null;
  }): Promise<User> {
    // Ensure username uniqueness by appending a suffix if needed
    let username = data.username;
    let attempt = 0;
    while (true) {
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.username, username));
      if (!existing) break;
      attempt++;
      username = `${data.username}_${attempt}`;
    }

    const [user] = await db
      .insert(users)
      .values({
        username,
        googleId: data.googleId,
        email: data.email,
        displayName: data.displayName,
      })
      .returning();
    return user;
  }

  async updateUserGoogle(
    id: number,
    data: { googleId?: string; displayName?: string | null }
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async recordVisit(userId: number, email: string | null): Promise<void> {
    await db.insert(visits).values({ userId, email });
  }

  async getVisits(limit: number): Promise<Visit[]> {
    return db
      .select()
      .from(visits)
      .orderBy(desc(visits.visitedAt))
      .limit(limit);
  }

  async getVisitTimestampsSince(since: Date | null): Promise<Date[]> {
    const rows = since
      ? await db
          .select({ visitedAt: visits.visitedAt })
          .from(visits)
          .where(gte(visits.visitedAt, since))
      : await db.select({ visitedAt: visits.visitedAt }).from(visits);
    return rows.map((r) => r.visitedAt);
  }
}

export const storage = new DatabaseStorage();

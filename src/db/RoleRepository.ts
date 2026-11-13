import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "./database";
import { joinableRoles, roleCategories, type JoinableRole, type RoleCategory } from "./schema";

/**
 * The role selector's data: role categories and the roles members can pick. Both lists keep
 * insertion order (the import keeps the export's order, as the Firestore caches did).
 */
export class RoleRepository {
  constructor(private readonly db: Db) {}

  public categories(): RoleCategory[] {
    return this.db.select().from(roleCategories).orderBy(asc(sql`rowid`)).all();
  }

  public roles(): JoinableRole[] {
    return this.db.select().from(joinableRoles).orderBy(asc(sql`rowid`)).all();
  }

  public rolesInCategory(category: string): JoinableRole[] {
    return this.db
      .select()
      .from(joinableRoles)
      .where(eq(joinableRoles.category, category))
      .orderBy(asc(sql`rowid`))
      .all();
  }

  public addCategory(category: RoleCategory): void {
    this.db.insert(roleCategories).values(category).run();
  }

  public addRole(role: JoinableRole): void {
    this.db.insert(joinableRoles).values(role).run();
  }
}

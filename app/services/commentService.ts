import { eq, and, asc } from "drizzle-orm";
import { db } from "~/db";
import { lessonComments, users } from "~/db/schema";

export function createComment(
  lessonId: number,
  userId: number,
  content: string
) {
  return db
    .insert(lessonComments)
    .values({ lessonId, userId, content, parentId: null })
    .returning()
    .get();
}

export function createReply(
  lessonId: number,
  userId: number,
  parentId: number,
  content: string
) {
  const parent = db
    .select()
    .from(lessonComments)
    .where(eq(lessonComments.id, parentId))
    .get();

  if (!parent) {
    throw new Error("Parent comment not found");
  }

  if (parent.parentId !== null) {
    throw new Error("Cannot reply to a reply");
  }

  return db
    .insert(lessonComments)
    .values({ lessonId, userId, parentId, content })
    .returning()
    .get();
}

export function getCommentsForLesson(lessonId: number) {
  return db
    .select({
      id: lessonComments.id,
      lessonId: lessonComments.lessonId,
      userId: lessonComments.userId,
      parentId: lessonComments.parentId,
      content: lessonComments.content,
      createdAt: lessonComments.createdAt,
      deletedAt: lessonComments.deletedAt,
      updatedAt: lessonComments.updatedAt,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      authorRole: users.role,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .where(eq(lessonComments.lessonId, lessonId))
    .orderBy(asc(lessonComments.createdAt))
    .all();
}

export function getCommentById(id: number) {
  return db
    .select()
    .from(lessonComments)
    .where(eq(lessonComments.id, id))
    .get();
}

export function deleteComment(id: number) {
  return db
    .update(lessonComments)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, id))
    .returning()
    .get();
}

export function editComment(id: number, content: string) {
  return db
    .update(lessonComments)
    .set({ content, updatedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, id))
    .returning()
    .get();
}

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  createComment,
  createReply,
  getCommentsForLesson,
  getCommentById,
  deleteComment,
  editComment,
} from "./commentService";
import { createModule } from "./moduleService";
import { createLesson } from "./lessonService";

let lessonId: number;

describe("commentService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    const mod = createModule(base.course.id, "Test Module", 1);
    const lesson = createLesson(mod.id, "Test Lesson", null, null, 1, null);
    lessonId = lesson.id;
  });

  describe("createComment", () => {
    it("creates a top-level comment with parentId null", () => {
      const comment = createComment(lessonId, base.user.id, "Hello world");

      expect(comment).toBeDefined();
      expect(comment.lessonId).toBe(lessonId);
      expect(comment.userId).toBe(base.user.id);
      expect(comment.content).toBe("Hello world");
      expect(comment.parentId).toBeNull();
    });
  });

  describe("createReply", () => {
    it("creates a reply linked to a parent comment", () => {
      const parent = createComment(lessonId, base.user.id, "Top-level");
      const reply = createReply(
        lessonId,
        base.instructor.id,
        parent.id,
        "This is a reply"
      );

      expect(reply.parentId).toBe(parent.id);
      expect(reply.content).toBe("This is a reply");
    });

    it("throws if parent does not exist", () => {
      expect(() =>
        createReply(lessonId, base.user.id, 9999, "orphan reply")
      ).toThrow("Parent comment not found");
    });

    it("throws if parent is itself a reply", () => {
      const parent = createComment(lessonId, base.user.id, "Top-level");
      const reply = createReply(
        lessonId,
        base.instructor.id,
        parent.id,
        "Reply"
      );

      expect(() =>
        createReply(lessonId, base.user.id, reply.id, "Nested reply")
      ).toThrow("Cannot reply to a reply");
    });
  });

  describe("getCommentsForLesson", () => {
    it("returns comments with author info ordered by createdAt", () => {
      createComment(lessonId, base.user.id, "First comment");
      createComment(lessonId, base.instructor.id, "Second comment");

      const comments = getCommentsForLesson(lessonId);

      expect(comments).toHaveLength(2);
      expect(comments[0].content).toBe("First comment");
      expect(comments[0].authorName).toBe("Test User");
      expect(comments[0].authorRole).toBe(schema.UserRole.Student);
      expect(comments[1].content).toBe("Second comment");
      expect(comments[1].authorName).toBe("Test Instructor");
      expect(comments[1].authorRole).toBe(schema.UserRole.Instructor);
    });

    it("returns empty array for lesson with no comments", () => {
      expect(getCommentsForLesson(lessonId)).toHaveLength(0);
    });

    it("includes replies in the result", () => {
      const parent = createComment(lessonId, base.user.id, "Parent");
      createReply(lessonId, base.instructor.id, parent.id, "Reply");

      const comments = getCommentsForLesson(lessonId);
      expect(comments).toHaveLength(2);
      expect(comments[1].parentId).toBe(parent.id);
    });
  });

  describe("getCommentById", () => {
    it("returns a comment by id", () => {
      const created = createComment(lessonId, base.user.id, "Find me");

      const found = getCommentById(created.id);
      expect(found).toBeDefined();
      expect(found!.content).toBe("Find me");
    });

    it("returns undefined for non-existent id", () => {
      expect(getCommentById(9999)).toBeUndefined();
    });
  });

  describe("deleteComment", () => {
    it("soft-deletes a comment by setting deletedAt", () => {
      const comment = createComment(lessonId, base.user.id, "To be deleted");
      const deleted = deleteComment(comment.id);

      expect(deleted).toBeDefined();
      expect(deleted!.deletedAt).not.toBeNull();
      expect(deleted!.content).toBe("To be deleted");
    });

    it("returns undefined for non-existent id", () => {
      expect(deleteComment(9999)).toBeUndefined();
    });

    it("deleted comments still appear in getCommentsForLesson with deletedAt set", () => {
      const comment = createComment(lessonId, base.user.id, "Will delete");
      deleteComment(comment.id);

      const comments = getCommentsForLesson(lessonId);
      expect(comments).toHaveLength(1);
      expect(comments[0].deletedAt).not.toBeNull();
    });
  });

  describe("editComment", () => {
    it("edits comment content and sets updatedAt", () => {
      const comment = createComment(lessonId, base.user.id, "Original");
      const edited = editComment(comment.id, "Updated content");

      expect(edited).toBeDefined();
      expect(edited!.content).toBe("Updated content");
      expect(edited!.updatedAt).not.toBeNull();
    });

    it("returns undefined for non-existent id", () => {
      expect(editComment(9999, "New content")).toBeUndefined();
    });

    it("edited comments in getCommentsForLesson show updated content and updatedAt", () => {
      const comment = createComment(lessonId, base.user.id, "Original");
      editComment(comment.id, "Edited text");

      const comments = getCommentsForLesson(lessonId);
      expect(comments).toHaveLength(1);
      expect(comments[0].content).toBe("Edited text");
      expect(comments[0].updatedAt).not.toBeNull();
    });
  });
});

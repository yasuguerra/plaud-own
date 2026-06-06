import { describe, test, expect } from "vitest";
import { formatTime, getExtensionFromMimeType, FailSafeFirestore } from "./server";

describe("server.ts utility tests", () => {
  test("formatTime works correctly", () => {
    expect(formatTime(0)).toBe("[00:00:00]");
    expect(formatTime(10)).toBe("[00:00:10]");
    expect(formatTime(65)).toBe("[00:01:05]");
    expect(formatTime(3665)).toBe("[01:01:05]");
  });

  test("getExtensionFromMimeType works correctly", () => {
    expect(getExtensionFromMimeType("audio/webm")).toBe("webm");
    expect(getExtensionFromMimeType("audio/mp4")).toBe("mp4");
    expect(getExtensionFromMimeType("video/mp4")).toBe("mp4");
    expect(getExtensionFromMimeType("audio/wav")).toBe("wav");
    expect(getExtensionFromMimeType("audio/mpeg")).toBe("mp3");
    expect(getExtensionFromMimeType("application/pdf")).toBe("pdf");
    expect(getExtensionFromMimeType("text/plain")).toBe("txt");
    expect(getExtensionFromMimeType("text/markdown")).toBe("md");
    expect(getExtensionFromMimeType("text/csv")).toBe("csv");
    expect(getExtensionFromMimeType("unknown/mime", "fallback")).toBe("fallback");
  });
});

describe("FailSafeFirestore tests", () => {
  test("FailSafeFirestore works in memory mode", async () => {
    const db = new FailSafeFirestore();
    db.setMemoryMode(true);
    expect(db.isMemoryMode()).toBe(true);

    const testSession = { id: "test1", title: "Test Session", userId: "user1", folderId: "folder1" };

    // Test SET
    await db.collection("sessions").doc("test1").set(testSession);

    // Test GET single document
    const doc = await db.collection("sessions").doc("test1").get();
    expect(doc.exists).toBe(true);
    expect(doc.data()).toEqual(testSession);

    // Test UPDATE
    await db.collection("sessions").doc("test1").update({ title: "Updated Title" });
    const docUpdated = await db.collection("sessions").doc("test1").get();
    expect(docUpdated.data()?.title).toBe("Updated Title");

    // Test WHERE query
    const whereSnap = await db.collection("sessions").where("userId", "==", "user1").get();
    let count = 0;
    whereSnap.forEach(d => {
      expect(d.data().id).toBe("test1");
      count++;
    });
    expect(count).toBe(1);

    // Test Chained WHERE query
    const chainedSnap = await db.collection("sessions")
      .where("userId", "==", "user1")
      .where("folderId", "==", "folder1")
      .get();
    let chainedCount = 0;
    chainedSnap.forEach(d => {
      expect(d.data().id).toBe("test1");
      chainedCount++;
    });
    expect(chainedCount).toBe(1);

    // Test DELETE
    await db.collection("sessions").doc("test1").delete();
    const docDeleted = await db.collection("sessions").doc("test1").get();
    expect(docDeleted.exists).toBe(false);
  });

  test("FailSafeFirestore batch operations in memory mode", async () => {
    const db = new FailSafeFirestore();
    db.setMemoryMode(true);

    const docRef1 = db.collection("sessions").doc("doc1");
    const docRef2 = db.collection("sessions").doc("doc2");

    await docRef1.set({ id: "doc1", folderId: "f1" });
    await docRef2.set({ id: "doc2", folderId: "f1" });

    const batch = db.batch();
    batch.update(docRef1.ref, { folderId: "f2" });
    batch.update(docRef2.ref, { folderId: "f3" });
    await batch.commit();

    const d1 = await docRef1.get();
    const d2 = await docRef2.get();

    expect(d1.data()?.folderId).toBe("f2");
    expect(d2.data()?.folderId).toBe("f3");
  });

  test("FailSafeFirestore sessions can store logs and progress", async () => {
    const db = new FailSafeFirestore();
    db.setMemoryMode(true);

    const sessionId = "sess_log_test";
    const initialSession = {
      id: sessionId,
      status: "processing",
      logs: [] as any[],
      progress: 0
    };

    await db.collection("sessions").doc(sessionId).set(initialSession);

    const docRef = db.collection("sessions").doc(sessionId);
    const doc = await docRef.get();
    expect(doc.exists).toBe(true);

    const data = doc.data();
    const logs = data?.logs || [];
    logs.push({ timestamp: new Date().toISOString(), stage: "START", message: "Comenzando..." });
    await docRef.update({ logs, progress: 10 });

    const docUpdated = await docRef.get();
    expect(docUpdated.data()?.progress).toBe(10);
    expect(docUpdated.data()?.logs.length).toBe(1);
    expect(docUpdated.data()?.logs[0].stage).toBe("START");
  });
});

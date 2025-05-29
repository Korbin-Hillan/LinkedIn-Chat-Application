const request = require("supertest");
const mongoose = require("mongoose");
const { app, server } = require("../server");
const User = require("../src/models/User");
const Message = require("../src/models/Message");
const { generateToken } = require("../src/utils/jwt");

describe("Message Tests", () => {
  let user1, user2, token1, token2;

  beforeAll(async () => {
    // Create test users
    user1 = await User.create({
      linkedinId: "test-linkedin-id-1",
      firstName: "Test",
      lastName: "User1",
      email: "test1@example.com",
    });

    user2 = await User.create({
      linkedinId: "test-linkedin-id-2",
      firstName: "Test",
      lastName: "User2",
      email: "test2@example.com",
    });

    // Generate tokens
    token1 = generateToken({ userId: user1._id, linkedinId: user1.linkedinId });
    token2 = generateToken({ userId: user2._id, linkedinId: user2.linkedinId });
  });

  afterEach(async () => {
    await Message.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
    server.close();
  });

  describe("POST /api/messages", () => {
    it("should send a message successfully", async () => {
      const response = await request(app)
        .post("/api/messages")
        .set("Authorization", `Bearer ${token1}`)
        .send({
          receiverId: user2._id,
          content: "Hello, Test User 2!",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toHaveProperty("_id");
      expect(response.body.message.content).toBe("Hello, Test User 2!");
    });

    it("should return 400 if receiver ID is missing", async () => {
      const response = await request(app)
        .post("/api/messages")
        .set("Authorization", `Bearer ${token1}`)
        .send({
          content: "Hello!",
        })
        .expect(400);

      expect(response.body).toHaveProperty("errors");
    });
  });

  describe("GET /api/messages/:userId", () => {
    beforeEach(async () => {
      // Create test messages
      await Message.create([
        {
          sender: user1._id,
          receiver: user2._id,
          content: "Message 1",
          timestamp: new Date("2025-01-01"),
        },
        {
          sender: user2._id,
          receiver: user1._id,
          content: "Message 2",
          timestamp: new Date("2025-01-02"),
        },
      ]);
    });

    it("should retrieve chat history between two users", async () => {
      const response = await request(app)
        .get(`/api/messages/${user2._id}`)
        .set("Authorization", `Bearer ${token1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0].content).toBe("Message 1");
      expect(response.body.messages[1].content).toBe("Message 2");
    });
  });
});

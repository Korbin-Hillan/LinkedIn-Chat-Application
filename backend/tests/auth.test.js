const request = require("supertest");
const mongoose = require("mongoose");
const { app, server } = require("../server");
const User = require("../src/models/User");

describe("Authentication Tests", () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_URI + "-test", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    // Clean up and close connections
    await User.deleteMany({});
    await mongoose.connection.close();
    server.close();
  });

  describe("POST /api/auth/linkedin", () => {
    it("should return 400 if authorization code is missing", async () => {
      const response = await request(app)
        .post("/api/auth/linkedin")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Authorization code is required");
    });

    it("should return 400 if authorization code is invalid", async () => {
      const response = await request(app)
        .post("/api/auth/linkedin")
        .send({ code: "invalid-code" })
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/auth/profile", () => {
    it("should return 401 if no token is provided", async () => {
      const response = await request(app).get("/api/auth/profile").expect(401);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Access denied. No token provided.");
    });

    it("should return 401 if token is invalid", async () => {
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Invalid token.");
    });
  });
});

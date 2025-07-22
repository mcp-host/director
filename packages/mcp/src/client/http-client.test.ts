import { ErrorCode } from "@director.run/utilities/error";
import { expectToThrowAppError } from "@director.run/utilities/test";
import { describe, expect, test } from "vitest";
import { makeEchoServer } from "../test/fixtures";
import { serveOverSSE } from "../transport";
import { serveOverStreamable } from "../transport";
import { HTTPClient } from "./http-client";

describe("HTTPClient", () => {
  describe("createAndConnectToHTTP", () => {
    describe("when connecting to a streamable server", () => {
      test("should connect properly", async () => {
        const instance = await serveOverStreamable(makeEchoServer(), 2345);
        const client = await HTTPClient.createAndConnectToHTTP(
          "http://localhost:2345/mcp",
        );

        const tools = await client.listTools();
        expect(tools.tools).toHaveLength(1);
        expect(tools.tools[0].name).toBe("echo");
        await instance.close();
      });
    });
    describe("when connecting to a sse server", () => {
      test("should connect properly", async () => {
        const instance = await serveOverSSE(makeEchoServer(), 2345);
        const client = await HTTPClient.createAndConnectToHTTP(
          "http://localhost:2345/sse",
        );

        const tools = await client.listTools();
        expect(tools.tools).toHaveLength(1);
        expect(tools.tools[0].name).toBe("echo");
        await instance.close();
      });
    });
    test("should fail properly", async () => {
      await expectToThrowAppError(
        () => HTTPClient.createAndConnectToHTTP("http://localhost/mcp"),
        {
          code: ErrorCode.CONNECTION_REFUSED,
          props: {
            url: "http://localhost/mcp",
          },
        },
      );
    });
  });
});

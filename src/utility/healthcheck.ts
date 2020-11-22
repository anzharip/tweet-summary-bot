import { createServer, IncomingMessage, ServerResponse } from "http";

export const server = createServer(
  (request: IncomingMessage, response: ServerResponse) => {
    if (request.url === "/status") {
      if (request.method === "GET") {
        response.end(
          JSON.stringify({
            status: "up",
          })
        );
      }
    } else {
      response.statusCode = 404;
      response.end();
    }
  }
);

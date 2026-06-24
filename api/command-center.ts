export default async function handler(request: unknown, response: unknown) {
  const { handleCommandCenterHttp } = await import("../apps/api/src/http.js");
  await handleCommandCenterHttp(request as never, response as never);
}

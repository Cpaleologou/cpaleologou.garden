import type { APIRoute } from "astro";
import { getGraph } from "../lib/site";

export const GET: APIRoute = async () => {
  const { graph } = await getGraph();
  return new Response(JSON.stringify(graph), { headers: { "Content-Type": "application/json" } });
};

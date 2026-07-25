import { defineFunction } from "@uipath/coded-functions-js-sdk";
import { z } from "zod";

export default defineFunction({
  name: "hello",
  description: "Returns a greeting message.",
  method: "POST",
  path: "/hello",
  input: z.object({
    name: z.string().default("World"),
  }),
  output: z.object({
    message: z.string(),
  }),
  handler: async (input, ctx) => ({
    message: `Hello, ${input.name}!`,
  }),
});

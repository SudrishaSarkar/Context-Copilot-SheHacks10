import { z } from "zod";

/**
 * Shared PagePayload schema (used by all features)
 */
export const PagePayloadSchema = z.object({
  url: z.string(),
  title: z.string(),
  contentType: z.enum(["html", "pdf_text", "pdf_image"]),
  selectedText: z.string().optional(),
  mainText: z.string(),
  structure: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        startChar: z.number().optional(),
        endChar: z.number().optional(),
        page: z.number().optional(),
      })
    )
    .optional(),
  meta: z
    .object({
      siteHint: z.enum(["github", "stackoverflow", "generic"]).optional(),
      timestamp: z.number().optional(),
    })
    .optional(),
  imageBase64: z.string().optional(),
});

/**
 * Request schema for summarize endpoint
 */
export const SummarizeRequestSchema = z.object({
  page: PagePayloadSchema,
  detailLevel: z.enum(["brief", "detailed"]).default("brief"),
});

/**
 * Request schema for key-points endpoint
 */
export const KeyPointsRequestSchema = z.object({
  page: PagePayloadSchema,
});

/**
 * Request schema for explain-like-5 endpoint
 */
export const ExplainLike5RequestSchema = z.object({
  page: PagePayloadSchema,
});

/**
 * Request schema for action-items endpoint
 */
export const ActionItemsRequestSchema = z.object({
  page: PagePayloadSchema,
});

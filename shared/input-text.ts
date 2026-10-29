import { z } from "zod";

export const MAX_INPUT_TEXT_LENGTH = 2000;
export const MAX_TEXT_HISTORY = 20;
export const inputTextSchema = z
  .string()
  .min(1, "Enter some text to send.")
  .max(
    MAX_INPUT_TEXT_LENGTH,
    `Keep text to ${MAX_INPUT_TEXT_LENGTH} characters or fewer.`,
  )
  .regex(
    /^[\x20-\x7e]+$/,
    "Use a single line of English letters, numbers, spaces, and punctuation. ADB input text does not support Unicode or line breaks.",
  );

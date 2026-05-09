/**
 * GeminiDriver — port of the Google Gemini CLI agent.
 *
 * Built on JsonLineDriver. Default model is gemini-3-pro; the protocol
 * shape matches Codex (gemini's CLI was designed with parity in mind).
 */

import { asId } from "../contracts/ids.js";
import { registerDriver } from "./registry.js";
import {
  AbstractJsonLineDriver,
  defaultCodexShapedEmit,
  type JsonLineProtocolBinding,
} from "./json-line-driver.js";

export const GEMINI_HARNESS_ID = asId("HarnessId", "hns_gemini");

const BINDING: JsonLineProtocolBinding = {
  discriminatorField: "kind",
  defaultModel: "gemini-3-pro",
  processName: "gemini",
  emit: defaultCodexShapedEmit,
};

export class GeminiDriver extends AbstractJsonLineDriver {
  protected binding(): JsonLineProtocolBinding {
    return BINDING;
  }
}

registerDriver(GEMINI_HARNESS_ID, (config) => new GeminiDriver(config));

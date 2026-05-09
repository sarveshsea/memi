/**
 * OllamaDriver — port of the Ollama local-model CLI.
 *
 * Local OSS model server. Same Codex-shaped stdout protocol as the other
 * subprocess agents. The default model is configurable; out-of-the-box
 * Ollama installations typically have llama3.1:8b available.
 */

import { asId } from "../contracts/ids.js";
import { registerDriver } from "./registry.js";
import {
  AbstractJsonLineDriver,
  defaultCodexShapedEmit,
  type JsonLineProtocolBinding,
} from "./json-line-driver.js";

export const OLLAMA_HARNESS_ID = asId("HarnessId", "hns_ollama");

const BINDING: JsonLineProtocolBinding = {
  discriminatorField: "kind",
  defaultModel: "llama3.1:8b",
  processName: "ollama",
  emit: defaultCodexShapedEmit,
};

export class OllamaDriver extends AbstractJsonLineDriver {
  protected binding(): JsonLineProtocolBinding {
    return BINDING;
  }
}

registerDriver(OLLAMA_HARNESS_ID, (config) => new OllamaDriver(config));

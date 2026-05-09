/**
 * MemoireNativeDriver — port of the Mémoire-native agent harness.
 *
 * Mémoire's own self-hosted agent path. Routes requests to internal MCP
 * tools and design-system operations rather than to a third-party CLI.
 * Built on JsonLineDriver because the runtime sidecar emits the same
 * Codex-shaped event protocol when serving native requests.
 */

import { asId } from "../contracts/ids.js";
import { registerDriver } from "./registry.js";
import {
  AbstractJsonLineDriver,
  defaultCodexShapedEmit,
  type JsonLineProtocolBinding,
} from "./json-line-driver.js";

export const MEMOIRE_NATIVE_HARNESS_ID = asId("HarnessId", "hns_memoire");

const BINDING: JsonLineProtocolBinding = {
  discriminatorField: "kind",
  defaultModel: "memoire-router",
  processName: "memoire",
  emit: defaultCodexShapedEmit,
};

export class MemoireNativeDriver extends AbstractJsonLineDriver {
  protected binding(): JsonLineProtocolBinding {
    return BINDING;
  }
}

registerDriver(MEMOIRE_NATIVE_HARNESS_ID, (config) => new MemoireNativeDriver(config));

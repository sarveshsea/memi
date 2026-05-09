/**
 * HermesDriver — port of the Hermes (NousResearch) agent harness.
 *
 * Built on JsonLineDriver. Default model is hermes-4-405b; the protocol
 * shape is Codex-compatible.
 */

import { asId } from "../contracts/ids.js";
import { registerDriver } from "./registry.js";
import {
  AbstractJsonLineDriver,
  defaultCodexShapedEmit,
  type JsonLineProtocolBinding,
} from "./json-line-driver.js";

export const HERMES_HARNESS_ID = asId("HarnessId", "hns_hermes");

const BINDING: JsonLineProtocolBinding = {
  discriminatorField: "kind",
  defaultModel: "hermes-4-405b",
  processName: "hermes",
  emit: defaultCodexShapedEmit,
};

export class HermesDriver extends AbstractJsonLineDriver {
  protected binding(): JsonLineProtocolBinding {
    return BINDING;
  }
}

registerDriver(HERMES_HARNESS_ID, (config) => new HermesDriver(config));

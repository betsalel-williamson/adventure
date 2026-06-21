import { createRequire } from "node:module";
import { readBuildMetadata } from "../../../../scripts/cloud-deploy/buildMetadata.js";

const require = createRequire(import.meta.url);
const { version } = require("../../../package.json") as { version: string };

export const buildMetadataWireFields = () => readBuildMetadata(version);

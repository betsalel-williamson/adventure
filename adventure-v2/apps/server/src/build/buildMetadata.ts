import { createRequire } from "node:module";
import { readBuildMetadata } from "../../../../../scripts/cloud-deploy/buildMetadata.mjs";

const require = createRequire(import.meta.url);
const { version } = require("../../../../package.json");

export const buildMetadataWireFields = () => readBuildMetadata(version);

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../../docs/contracts/domain.schema.json";
import { AppError } from "./errors";
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(schema);
export function validate<T>(name: string, value: unknown): T {
  const fn = ajv.getSchema(`${schema.$id}#/$defs/${name}`);
  if (!fn?.(value))
    throw new AppError(
      "INVALID_INPUT",
      `Invalid ${name}. Check required fields, lengths and formats.`,
      422,
    );
  return value as T;
}

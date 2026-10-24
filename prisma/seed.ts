// Each guest gets a private copy of the source fixture at sample creation.
// Seeding never creates shared user data or resets an existing project.
import { sample } from "../src/fixtures/sample";
import { validate } from "../src/domain/contracts";
import { ingest } from "../src/services/ingestion";
validate("ProjectUpload", sample);
ingest(sample);
console.log(
  "Campus Tickets fixture validated. Guest copies are created on demand.",
);

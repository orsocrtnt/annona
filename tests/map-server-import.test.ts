import assert from "node:assert/strict";
import test from "node:test";

// Client components are evaluated during Next's server rendering too. Importing
// either entry must stay safe without a browser (Leaflet itself reads window).

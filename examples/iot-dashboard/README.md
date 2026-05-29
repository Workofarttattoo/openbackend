# IoT Dashboard Example

This example sketches a local telemetry flow for devices that cannot depend on a paid cloud backend.

```ts
import { createOpenBackend } from "@openbackend/sdk-js";

const app = createOpenBackend({ url: "http://localhost:8787" });
const readings = app.database().collection("sensor_readings");

await readings.create({
  deviceId: "kiosk-01",
  temperatureC: 22.4,
  capturedAt: new Date().toISOString()
});
```

Planned next step: add API-key protected device ingestion and a realtime chart.


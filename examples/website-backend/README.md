# Website Backend Example

This example shows how a small content site can use OpenBackend collections.

```ts
import { createOpenBackend } from "@openbackend/sdk-js";

const app = createOpenBackend({ url: "http://localhost:8787" });
const posts = app.database().collection("posts");

await posts.create({
  title: "Launch note",
  status: "published",
  body: "OpenBackend is running locally."
});
```

Planned next step: add a static Vite site that watches the `posts` collection for live preview.


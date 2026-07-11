export interface Generator {
  generate(): string | object;
  generateToFile?(outputPath: string): Promise<void>;
}

const SCALAR_CDN = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest";
const SWAGGER_CDN_CSS = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@latest/swagger-ui.css";
const SWAGGER_CDN_JS = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@latest/swagger-ui-bundle.js";

export class DocUIGenerator implements Generator {
  constructor(private openapiSpec: object) {}

  generate(): string {
    return this.generateScalarUI();
  }

  generateToFile(outputPath: string): Promise<void> {
    const content = this.generateScalarUI();
    return Promise.resolve().then(() => {
      const fs = require("fs");
      fs.writeFileSync(outputPath, content, "utf-8");
    });
  }

  generateScalarUI(): string {
    const specJson = this.safeSerializeSpec();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>API Reference — Scalar UI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #app { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module">
    import { createApp } from '${SCALAR_CDN}';

    const spec = ${specJson};

    createApp('#app', {
      spec,
      theme: 'purple',
      layout: 'modern',
      darkMode: true,
      showSidebar: true,
      hideModels: false,
      hideDownloadButton: false,
      hideSearch: false,
      withDefaultFonts: true,
      customCss: ':root { --scalar-background-1: #0f0f11; --scalar-background-2: #1a1a1e; --scalar-background-3: #252529; --scalar-color-1: #f0f0f0; --scalar-color-2: #a0a0a8; --scalar-color-3: #6b6b76; }',
    });
  </script>
</body>
</html>`;
  }

  generateSwaggerUI(): string {
    const specJson = this.safeSerializeSpec();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>API Reference — Swagger UI</title>
  <link rel="stylesheet" href="${SWAGGER_CDN_CSS}" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { box-sizing: border-box; }
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
    #swagger-ui { max-width: 1460px; margin: 0 auto; padding: 20px; }
    @media (prefers-color-scheme: dark) {
      body { background: #1a1a1e; }
      .swagger-ui { color: #e0e0e0; filter: invert(0.9) hue-rotate(180deg); }
      .swagger-ui img { filter: invert(1) hue-rotate(180deg); }
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_CDN_JS}"></script>
  <script>
    const spec = ${specJson};

    SwaggerUIBundle({
      spec,
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset,
      ],
      layout: 'StandaloneLayout',
      showExtensions: true,
      showCommonExtensions: true,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true,
      syntaxHighlight: { activated: true, theme: 'monokai' },
    });
  </script>
</body>
</html>`;
  }

  private safeSerializeSpec(): string {
    try {
      return JSON.stringify(this.openapiSpec, null, 2);
    } catch {
      return JSON.stringify({ openapi: "3.1.0", info: { title: "API", version: "1.0.0" }, paths: {} });
    }
  }
}

export default DocUIGenerator;
